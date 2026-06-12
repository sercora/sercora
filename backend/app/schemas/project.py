from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    project_number: Optional[str] = None
    project_name: str
    status: str = "PENDING"
    warranty_years: int = 1
    tile_holdback_percent: float = 10


class ProjectResponse(BaseModel):
    id: int
    project_number: Optional[str]
    project_name: str
    status: str
