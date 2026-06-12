from pydantic import BaseModel
from typing import Optional


class EstimateCreate(BaseModel):
    project_id: int
    revision_number: int
    estimate_type: str
    description: Optional[str] = None


class EstimateResponse(BaseModel):
    id: int
    project_id: int
    revision_number: int
    estimate_type: str
    description: Optional[str]
