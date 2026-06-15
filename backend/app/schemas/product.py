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
    prosol_product_id: int | None = None
    prosol_uuid: str | None = None
    prosol_sku: str | None = None
    manufacturer_sku: str | None = None
    category_name: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    default_purchase_price: float | None = None
    msrp_price: float | None = None
    active: bool = True
