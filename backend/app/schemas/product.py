from pydantic import BaseModel


class ProductResponse(BaseModel):
    id: int
    name: str


class ProductCreate(BaseModel):
    product_type_id: int
    name: str
    manufacturer_name: str | None = None
    collection_name: str | None = None
    color_name: str | None = None
    finish_name: str | None = None
    size_name: str | None = None
    default_unit_id: int | None = None
    default_grout_color: str | None = None
    supplier_name: str | None = None
    supplier_product_code: str | None = None
    active: bool = True
