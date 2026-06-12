from pydantic import BaseModel


class ProductResponse(BaseModel):
    id: int
    name: str


class ProductCreate(BaseModel):
    product_type_id: int
    name: str
