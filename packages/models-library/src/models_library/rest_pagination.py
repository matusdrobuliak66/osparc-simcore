from typing import Any, ClassVar, Final, Generic, TypeVar

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConstrainedInt,
    Extra,
    Field,
    NonNegativeInt,
    PositiveInt,
    parse_obj_as,
    validator,
)
from pydantic.generics import GenericModel

from .utils.common_validators import none_to_empty_list_pre_validator

# Default limit values
#  - Using same values across all pagination entrypoints simplifies
#    interconnecting paginated calls
MAXIMUM_NUMBER_OF_ITEMS_PER_PAGE: Final[int] = 50


class PageLimitInt(ConstrainedInt):
    ge = 1
    lt = MAXIMUM_NUMBER_OF_ITEMS_PER_PAGE


DEFAULT_NUMBER_OF_ITEMS_PER_PAGE: Final[PageLimitInt] = parse_obj_as(PageLimitInt, 20)


class PageQueryParameters(BaseModel):
    """Use as pagination options in query parameters"""

    limit: PageLimitInt = Field(
        default=parse_obj_as(PageLimitInt, DEFAULT_NUMBER_OF_ITEMS_PER_PAGE),
        description="maximum number of items to return (pagination)",
    )
    offset: NonNegativeInt = Field(
        default=0, description="index to the first item to return (pagination)"
    )


class PageMetaInfoLimitOffset(BaseModel):
    limit: PositiveInt = DEFAULT_NUMBER_OF_ITEMS_PER_PAGE
    total: NonNegativeInt
    offset: NonNegativeInt = 0
    count: NonNegativeInt

    @validator("offset")
    @classmethod
    def _check_offset(cls, v, values):
        if v > 0 and v >= values["total"]:
            msg = f"offset {v} cannot be equal or bigger than total {values['total']}, please check"
            raise ValueError(msg)
        return v

    @validator("count")
    @classmethod
    def _check_count(cls, v, values):
        if v > values["limit"]:
            msg = f"count {v} bigger than limit {values['limit']}, please check"
            raise ValueError(msg)
        if v > values["total"]:
            msg = (
                f"count {v} bigger than expected total {values['total']}, please check"
            )
            raise ValueError(msg)
        if "offset" in values and (values["offset"] + v) > values["total"]:
            msg = f"offset {values['offset']} + count {v} is bigger than allowed total {values['total']}, please check"
            raise ValueError(msg)
        return v

    class Config:
        extra = Extra.forbid

        schema_extra: ClassVar[dict[str, Any]] = {
            "examples": [
                {"total": 7, "count": 4, "limit": 4, "offset": 0},
            ]
        }


RefT = TypeVar("RefT")


class PageRefs(BaseModel, Generic[RefT]):
    self: RefT
    first: RefT
    prev: RefT | None
    next: RefT | None
    last: RefT

    class Config:
        extra = Extra.forbid


class PageLinks(PageRefs[AnyHttpUrl]):
    ...


ItemT = TypeVar("ItemT")


class Page(GenericModel, Generic[ItemT]):
    """
    Paginated response model of ItemTs
    """

    meta: PageMetaInfoLimitOffset = Field(alias="_meta")
    links: PageLinks = Field(alias="_links")
    data: list[ItemT]

    _none_is_empty = validator("data", allow_reuse=True, pre=True)(
        none_to_empty_list_pre_validator
    )

    @validator("data")
    @classmethod
    def _check_data_compatible_with_meta(cls, v, values):
        if "meta" not in values:
            # if the validation failed in meta this happens
            msg = "meta not in values"
            raise ValueError(msg)
        if len(v) != values["meta"].count:
            msg = f"container size [{len(v)}] must be equal to count [{values['meta'].count}]"
            raise ValueError(msg)
        return v

    class Config:
        extra = Extra.forbid

        schema_extra: ClassVar[dict[str, Any]] = {
            "examples": [
                # first page Page[str]
                {
                    "_meta": {"total": 7, "count": 4, "limit": 4, "offset": 0},
                    "_links": {
                        "self": "https://osparc.io/v2/listing?offset=0&limit=4",
                        "first": "https://osparc.io/v2/listing?offset=0&limit=4",
                        "prev": None,
                        "next": "https://osparc.io/v2/listing?offset=1&limit=4",
                        "last": "https://osparc.io/v2/listing?offset=1&limit=4",
                    },
                    "data": ["data 1", "data 2", "data 3", "data 4"],
                },
                # second and last page
                {
                    "_meta": {"total": 7, "count": 3, "limit": 4, "offset": 1},
                    "_links": {
                        "self": "https://osparc.io/v2/listing?offset=1&limit=4",
                        "first": "https://osparc.io/v2/listing?offset=0&limit=4",
                        "prev": "https://osparc.io/v2/listing?offset=0&limit=4",
                        "next": None,
                        "last": "https://osparc.io/v2/listing?offset=1&limit=4",
                    },
                    "data": ["data 5", "data 6", "data 7"],
                },
            ]
        }
