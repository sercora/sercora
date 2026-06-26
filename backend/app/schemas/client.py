from pydantic import BaseModel
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
    active: bool = True
    estimators: list[ClientEstimatorSave] = []
