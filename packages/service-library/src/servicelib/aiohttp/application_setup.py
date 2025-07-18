import functools
import inspect
import logging
from collections.abc import Callable
from contextlib import ContextDecorator
from copy import deepcopy
from datetime import datetime
from enum import Enum
from types import TracebackType
from typing import Any, Final, Protocol

import arrow
from aiohttp import web
from pydantic import TypeAdapter
from typing_extensions import (  # https://docs.pydantic.dev/latest/api/standard_library_types/#typeddict
    TypedDict,
)

from .application_keys import APP_CONFIG_KEY, APP_SETTINGS_KEY

_logger = logging.getLogger(__name__)

APP_SETUP_COMPLETED_KEY: Final[str] = f"{__name__ }.setup"


class _SetupFunc(Protocol):
    __name__: str

    def __call__(self, app: web.Application, *args: Any, **kwds: Any) -> bool: ...


class _ApplicationSettings(Protocol):
    def is_enabled(self, field_name: str) -> bool: ...


class ModuleCategory(Enum):
    SYSTEM = 0
    ADDON = 1


# ERRORS ------------------------------------------------------------------


class SkipModuleSetupError(Exception):
    def __init__(self, *, reason) -> None:
        self.reason = reason
        super().__init__(reason)


class ApplicationSetupError(Exception): ...


class DependencyError(ApplicationSetupError): ...


class SetupMetadataDict(TypedDict):
    module_name: str
    dependencies: list[str]
    config_section: str | None
    config_enabled: str


# HELPERS ------------------------------------------------------------------


def _parse_and_validate_arguments(
    module_name: str,
    depends: list[str] | None = None,
    config_section: str | None = None,
    config_enabled: str | None = None,
) -> tuple[str, list[str], str | None, str]:
    module_name = module_name.replace(".__init__", "")
    depends = depends or []

    if config_section and config_enabled:
        msg = "Can only set config_section or config_enabled but not both"
        raise ValueError(msg)

    section: str | None = config_section or module_name.split(".")[-1]
    if config_enabled is None:
        config_enabled = f"{section}.enabled"
    else:
        # if passes config_enabled, invalidates info on section
        section = None

    return module_name, depends, section, config_enabled


def _is_addon_enabled_from_config(
    cfg: dict[str, Any], dotted_section: str, section
) -> bool:
    try:
        parts: list[str] = dotted_section.split(".")
        # navigates app_config (cfg) searching for section
        searched_config = deepcopy(cfg)
        for part in parts:
            if section and part == "enabled":
                # if section exists, no need to explicitly enable it
                return TypeAdapter(bool).validate_python(
                    searched_config.get(part, True)
                )
            searched_config = searched_config[part]

    except KeyError as ee:
        msg = f"Cannot find required option '{dotted_section}' in app config's section '{ee}'"
        raise ApplicationSetupError(msg) from ee

    assert isinstance(searched_config, bool)  # nosec
    return searched_config


def _get_app_settings_and_field_name(
    app: web.Application,
    arg_module_name: str,
    arg_settings_name: str | None,
    setup_func_name: str,
    logger: logging.Logger,
) -> tuple[_ApplicationSettings | None, str | None]:
    app_settings: _ApplicationSettings | None = app.get(APP_SETTINGS_KEY)
    settings_field_name = arg_settings_name

    if app_settings:
        if not settings_field_name:
            # FIXME: hard-coded WEBSERVER_ temporary
            settings_field_name = f"WEBSERVER_{arg_module_name.split('.')[-1].upper()}"

        logger.debug("Checking addon's %s ", f"{settings_field_name=}")

        if not hasattr(app_settings, settings_field_name):
            msg = f"Invalid option arg_settings_name={arg_settings_name!r} in module's setup {setup_func_name}. It must be a field in {app_settings.__class__}"
            raise ValueError(msg)

    return app_settings, settings_field_name


class _SetupTimingContext(ContextDecorator):
    """Context manager/decorator for timing and logging module setup operations."""

    def __init__(
        self,
        module_name: str,
        *,
        logger: logging.Logger,
        category: ModuleCategory | None = None,
        depends: list[str] | None = None,
    ) -> None:
        """Initialize timing context.

        :param module_name: Name of the module being set up
        :param category: Optional module category for detailed logging
        :param depends: Optional dependencies for detailed logging
        """
        self.module_name = module_name
        self.category = category
        self.depends = depends
        self.started: datetime | None = None
        self.head_msg = f"Setup of {module_name}"
        self.logger = logger

    def __enter__(self) -> None:
        self.started = arrow.utcnow().datetime
        if self.category is not None:
            self.logger.info(
                "%s (%s, %s) started ... ",
                self.head_msg,
                f"{self.category.name=}",
                f"{self.depends}",
            )
        else:
            self.logger.info("%s started ...", self.head_msg)

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if self.started:
            elapsed = (arrow.utcnow() - self.started).total_seconds()
            _logger.info("%s completed [Elapsed: %3.1f secs]", self.head_msg, elapsed)


# PUBLIC API ------------------------------------------------------------------


def is_setup_completed(module_name: str, app: web.Application) -> bool:
    return module_name in app[APP_SETUP_COMPLETED_KEY]


def ensure_single_setup(
    module_name: str,
    *,
    logger: logging.Logger,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Ensures a setup function is executed only once per application and handles completion.

    :param module_name: Name of the module being set up
    """

    def _log_skip(reason: str) -> bool:
        logger.info("Skipping '%s' setup: %s", module_name, reason)
        return False

    def decorator(setup_func: _SetupFunc) -> _SetupFunc:

        @functools.wraps(setup_func)
        def _wrapper(app: web.Application, *args: Any, **kwargs: Any) -> bool:

            # pre-setup init
            if APP_SETUP_COMPLETED_KEY not in app:
                app[APP_SETUP_COMPLETED_KEY] = []

            # check
            if is_setup_completed(module_name, app):
                _log_skip(
                    f"'{module_name}' was already initialized in {app}."
                    " Setup can only be executed once per app."
                )
                return False

            try:
                completed = setup_func(app, *args, **kwargs)

                # post-setup handling
                if completed is None:
                    completed = True

                if completed:  # registers completed setup
                    app[APP_SETUP_COMPLETED_KEY].append(module_name)
                    return completed

                assert not completed  # nosec
                _log_skip("Undefined (setup function returned false)")
                return False

            except SkipModuleSetupError as err:
                _log_skip(err.reason)
                return False

        return _wrapper

    return decorator


def app_module_setup(
    module_name: str,
    category: ModuleCategory,
    *,
    settings_name: str | None = None,
    depends: list[str] | None = None,
    logger: logging.Logger = _logger,
    # TODO: SEE https://github.com/ITISFoundation/osparc-simcore/issues/2008
    # TODO: - settings_name becomes module_name!!
    # TODO: - plugin base should be aware of setup and settings -> model instead of function?
    # TODO: - depends mechanism will call registered setups List[Union[str, _SetupFunc]]
    # TODO: - deprecate config options
    config_section: str | None = None,
    config_enabled: str | None = None,
) -> Callable:
    """Decorator that marks a function as 'a setup function' for a given module in an application

        - Marks a function as 'setup' of a given module in an application
        - Ensures setup executed ONLY ONCE per app
        - Addon modules:
            - toggles run using 'enabled' entry in config file
        - logs execution

    See packages/service-library/tests/test_application_setup.py

    :param module_name: typically __name__
    :param depends: list of module_names that must be called first, defaults to None
    :param config_section: explicit configuration section, defaults to None (i.e. the name of the module, or last entry of the name if dotted)
    :param config_enabled: option in config to enable, defaults to None which is '$(module-section).enabled' (config_section and config_enabled are mutually exclusive)
    :param settings_name: field name in the app's settings that corresponds to this module. Defaults to the name of the module with app prefix.
    :raises DependencyError
    :raises ApplicationSetupError
    :return: True if setup was completed or False if setup was skipped
    :rtype: bool

    :Example:
        from servicelib.aiohttp.application_setup import app_module_setup

        @app_module_setup('mysubsystem', ModuleCategory.SYSTEM, logger=log)
        def setup(app: web.Application):
            ...
    """
    # TODO: resilience to failure. if this setup fails, then considering dependencies, is it fatal or app can start?
    # TODO: enforce signature as def setup(app: web.Application, **kwargs) -> web.Application

    module_name, depends, section, config_enabled = _parse_and_validate_arguments(
        module_name, depends, config_section, config_enabled
    )

    # metadata info
    def _setup_metadata() -> SetupMetadataDict:
        return SetupMetadataDict(
            module_name=module_name,
            dependencies=depends,
            config_section=section,
            config_enabled=config_enabled,
        )

    def decorator(setup_func: _SetupFunc) -> _SetupFunc:

        assert (  # nosec
            "setup_" in setup_func.__name__
        ), f"Rename '{setup_func.__name__}' like 'setup_$(plugin-name)'"

        @functools.wraps(setup_func)
        @ensure_single_setup(module_name, logger=logger)
        @_SetupTimingContext(
            module_name, category=category, depends=depends, logger=logger
        )
        def _wrapper(app: web.Application, *args, **kargs) -> bool:
            if category == ModuleCategory.ADDON:
                # ONLY addons can be enabled/disabled

                if settings_name is None:
                    # Fall back to config if settings_name is not explicitly defined
                    # TODO: deprecate
                    cfg = app[APP_CONFIG_KEY]
                    is_enabled = _is_addon_enabled_from_config(
                        cfg, config_enabled, section
                    )
                    if not is_enabled:
                        logger.info(
                            "Skipping '%s' setup. Explicitly disabled in config",
                            module_name,
                        )
                        return False

                # NOTE: if not disabled by config, it can be disabled by settings (tmp while legacy maintained)
                app_settings, module_settings_name = _get_app_settings_and_field_name(
                    app,
                    module_name,
                    settings_name,
                    setup_func.__name__,
                    logger,
                )

                if (
                    app_settings
                    and module_settings_name
                    and not app_settings.is_enabled(module_settings_name)
                ):
                    logger.info(
                        "Skipping setup %s. %s disabled in settings",
                        f"{module_name=}",
                        f"{module_settings_name=}",
                    )
                    return False

            if depends:
                uninitialized = [
                    dep for dep in depends if not is_setup_completed(dep, app)
                ]
                if uninitialized:
                    msg = f"Cannot setup app module '{module_name}' because the following dependencies are still uninitialized: {uninitialized}"
                    raise DependencyError(msg)

            # execution of setup with module name
            completed: bool = setup_func(app, *args, **kargs)

            return completed

        assert (
            _wrapper.__wrapped__ == setup_func
        ), "this is added by functools.wraps decorator"  # nosec

        setattr(_wrapper, "metadata", _setup_metadata)  # noqa: B010
        setattr(_wrapper, "mark_as_simcore_servicelib_setup_func", True)  # noqa: B010

        return _wrapper

    return decorator


def is_setup_function(fun: Callable) -> bool:
    return (
        inspect.isfunction(fun)
        and hasattr(fun, "mark_as_simcore_servicelib_setup_func")
        and any(
            param.annotation == web.Application
            for _, param in inspect.signature(fun).parameters.items()
        )
    )
