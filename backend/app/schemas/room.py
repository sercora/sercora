from pydantic import BaseModel


class RoomCreate(BaseModel):
    estimate_id: int
    phase_name: str
    phase_label: str | None = None
    floor_name: str
    floor_label: str | None = None
    room_name: str


class RoomUpdate(BaseModel):
    phase_name: str
    phase_label: str | None = None
    floor_name: str
    floor_label: str | None = None
    room_name: str


class RoomResponse(BaseModel):
    id: int
    estimate_id: int
    phase_name: str
    phase_label: str | None = None
    floor_name: str
    floor_label: str | None = None
    room_name: str
