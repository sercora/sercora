from pydantic import BaseModel


class EstimateQuantityCreate(BaseModel):
    estimate_line_id: int
    room_id: int
    quantity: float


class EstimateQuantityResponse(BaseModel):
    id: int
    estimate_line_id: int
    room_id: int
    quantity: float
