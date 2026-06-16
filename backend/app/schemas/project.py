from datetime import date

from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    project_number: Optional[str] = None
    bsdq_project_number: Optional[str] = None
    project_name: str
    status: str = "PENDING"
    client_id: Optional[int] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    bid_due_date: Optional[date] = None
    bsdq_due_time: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    architect_name: Optional[str] = None
    probable_schedule: Optional[str] = None
    source_template_path: Optional[str] = None
    warranty_years: int = 1
    tile_holdback_percent: float = 10


class ProjectResponse(BaseModel):
    id: int
    project_number: Optional[str]
    project_name: str
    status: str
