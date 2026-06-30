from pydantic import BaseModel, Field
from typing import Optional


class ContactTaskSave(BaseModel):
    id: Optional[int] = None
    code: str
    name: str
    active: bool = True


class ContactTypeSave(BaseModel):
    id: Optional[int] = None
    code: str
    name: str
    active: bool = True


class ContactSave(BaseModel):
    contact_type_id: int
    client_id: Optional[int] = None
    supplier_id: Optional[int] = None
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    active: bool = True
    task_ids: list[int] = Field(default_factory=list)


class SupplierSave(BaseModel):
    name: str
    federal_tax_number: Optional[str] = None
    provincial_tax_number: Optional[str] = None
    active: bool = True
