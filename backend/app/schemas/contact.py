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
    phone: Optional[str] = None
    fax: Optional[str] = None
    mobile: Optional[str] = None
    billing_address: Optional[str] = None
    billing_postal_code: Optional[str] = None
    email: Optional[str] = None
    contact_name: Optional[str] = None
    account_number: Optional[str] = None
    website: Optional[str] = None
    company_name: Optional[str] = None
    tax_identification_number: Optional[str] = None
    federal_tax_number: Optional[str] = None
    provincial_tax_number: Optional[str] = None
    active: bool = True
