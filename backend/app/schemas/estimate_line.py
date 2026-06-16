from pydantic import BaseModel
from typing import Optional


class EstimateLineCreate(BaseModel):
    estimate_id: int
    product_id: int
    surface_type_id: int
    unit_id: int
    insert_position: Optional[int] = None

    grout_color: Optional[str] = None

    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float


class EstimateLineUpdate(BaseModel):
    surface_type_id: int
    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float


class EstimateLinePositionUpdate(BaseModel):
    position: int


class EstimateLineProductUpdate(BaseModel):
    product_id: int
    surface_type_id: int
    unit_id: int
    grout_color: Optional[str] = None
    purchase_price: float
    apply_matching_product: bool = False


class EstimateLineResponse(BaseModel):
    id: int
    estimate_id: int
    product_id: int
    surface_type_id: int
    unit_id: int

    grout_color: Optional[str]

    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float
