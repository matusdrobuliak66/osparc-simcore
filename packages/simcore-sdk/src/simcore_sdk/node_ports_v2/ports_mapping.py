from collections.abc import ItemsView, Iterator, KeysView, ValuesView

from models_library.services_types import ServicePortKey
from pydantic import BaseModel

from ..node_ports_common.exceptions import UnboundPortError
from .port import Port


class BasePortsMapping(BaseModel):
    __root__: dict[ServicePortKey, Port]

    def __getitem__(self, key: int | ServicePortKey) -> Port:
        if isinstance(key, int):
            if key < len(self.__root__):
                key = list(self.__root__.keys())[key]
        if key not in self.__root__:
            raise UnboundPortError(key)
        assert isinstance(key, str)  # nosec
        return self.__root__[key]

    def __iter__(self) -> Iterator[ServicePortKey]:  # type: ignore
        return iter(self.__root__)

    def keys(self) -> KeysView[ServicePortKey]:
        return self.__root__.keys()

    def items(self) -> ItemsView[ServicePortKey, Port]:
        return self.__root__.items()

    def values(self) -> ValuesView[Port]:
        return self.__root__.values()

    def __len__(self) -> int:
        return self.__root__.__len__()


class InputsList(BasePortsMapping):
    pass


class OutputsList(BasePortsMapping):
    pass
