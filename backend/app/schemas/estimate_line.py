from pydantic import BaseModel, Field
from typing import Optional


class EstimateLineCreate(BaseModel):
    estimate_id: int
    product_id: int
    surface_type_id: int
    unit_id: int
    insert_position: Optional[int] = None
    plan_code: Optional[str] = None

    grout_color: Optional[str] = None

    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float


class EstimateLineUpdate(BaseModel):
    surface_type_id: int
    plan_code: Optional[str] = None
    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float
    installation_link_source_line_id: Optional[int] = None
    installation_link_multiplier: float = 1
    quantity_link_source_line_ids: list[int] = Field(default_factory=list)
    quantity_link_multiplier: float = 1
    manpower_multiplier: float = 1


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
    plan_code: Optional[str]

    grout_color: Optional[str]

    loss_percent: float
    purchase_price: float
    profit_percent: float
    installation_cost: float
