from pydantic import BaseModel
from typing import Optional


class ClientSave(BaseModel):
    name: str
    client_type_id: Optional[int] = None
    active: bool = True
