from pydantic import BaseModel, Field
from typing import Optional


class ClientEstimatorSave(BaseModel):
    id: Optional[int] = None
    name: str
    cell: Optional[str] = None
    email: Optional[str] = None
    active: bool = True


class ClientSave(BaseModel):
    name: str
    client_type_id: Optional[int] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    mobile: Optional[str] = None
    billing_address: Optional[str] = None
    billing_postal_code: Optional[str] = None
    rbq: Optional[str] = None
    federal_tax_number: Optional[str] = None
    provincial_tax_number: Optional[str] = None
    active: bool = True
    estimators: list[ClientEstimatorSave] = Field(default_factory=list)


class ClientBulkUpdate(BaseModel):
    client_ids: list[int] = Field(default_factory=list)
    name: Optional[str] = None
    client_type_id: Optional[int] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    mobile: Optional[str] = None
    billing_address: Optional[str] = None
    billing_postal_code: Optional[str] = None
    rbq: Optional[str] = None
    federal_tax_number: Optional[str] = None
    provincial_tax_number: Optional[str] = None
    active: Optional[bool] = None
