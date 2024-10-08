# pylint: disable=redefined-outer-name
# pylint: disable=too-many-positional-arguments
# pylint: disable=unused-argument
# pylint: disable=unused-variable

import logging
import sys
from collections import namedtuple
from itertools import chain
from os.path import exists, relpath
from pathlib import Path

import pytest
from utils import is_json_schema, load_specs

log = logging.getLogger(__name__)

# Conventions
COMMON = "common"
OPENAPI_MAIN_FILENAME = "openapi.yaml"

current_dir = Path(sys.argv[0] if __name__ == "__main__" else __file__).resolve().parent


@pytest.fixture(scope="session")
def this_repo_root_dir() -> Path:
    root_dir = current_dir.parent.parent
    assert root_dir
    assert any(root_dir.glob(".git"))
    return root_dir


@pytest.fixture(scope="session")
def api_specs_dir() -> Path:
    return current_dir.parent / "specs"


@pytest.fixture(scope="session")
def webserver_api_dir(api_specs_dir) -> Path:
    return api_specs_dir / "webserver"


@pytest.fixture(scope="session")
def api_specs_info(api_specs_dir):
    """
    Returns a namedtuple with info on every
    """
    service_dirs = [
        d for d in api_specs_dir.iterdir() if d.is_dir() and not d.name.endswith(COMMON)
    ]

    info_cls = namedtuple(
        "ApiSpecsInfo", "service version openapi_path url_path".split()
    )
    info = []
    for srv_dir in service_dirs:
        version_dirs = [
            d for d in srv_dir.iterdir() if d.is_dir() and not d.name.endswith(COMMON)
        ]
        for ver_dir in version_dirs:
            openapi_path = ver_dir / OPENAPI_MAIN_FILENAME
            if openapi_path.exists():
                info.append(
                    info_cls(
                        service=srv_dir.name,
                        version=ver_dir.name,
                        openapi_path=openapi_path,
                        url_path=relpath(
                            openapi_path, srv_dir
                        ),  # ${version}/openapi.yaml
                    )
                )
    # https://yarl.readthedocs.io/en/stable/api.html#yarl.URL
    # [scheme:]//[user[:password]@]host[:port][/path][?query][#fragment]
    return info


@pytest.fixture(scope="session")
def all_api_specs_tails(api_specs_dir):
    """Returns openapi/jsonschema spec files path relative to specs_dir"""
    return _all_api_specs_tails_impl(api_specs_dir)


def _all_api_specs_tails_impl(api_specs_dir):
    tails = []
    for fpath in chain(
        *[api_specs_dir.rglob(wildcard) for wildcard in ("*.json", "*.y*ml")]
    ):
        tail = relpath(fpath, api_specs_dir)
        tails.append(Path(tail))
    return tails


def list_openapi_tails():
    """Returns relative path to all non-jsonschema (i.e. potential openapi)

    SEE api_specs_tail to get one at a time
    """
    tails = []
    specs_dir = current_dir.parent / "specs"
    for tail in _all_api_specs_tails_impl(specs_dir):
        specs = load_specs(specs_dir / tail)
        if not is_json_schema(specs):
            tails.append(str(tail))
    return tails


@pytest.fixture(scope="session", params=list_openapi_tails())
def api_specs_tail(request, api_specs_dir):
    """Returns api specs file path relative to api_specs_dir

    NOTE: this is a parametrized fixture that
      represents one api-specs tail at a time!
    NOTE: as_str==True, so it gets printed
    """
    specs_tail = request.param
    assert exists(api_specs_dir / specs_tail)
    return Path(specs_tail)
