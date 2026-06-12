from pydantic import BaseModel


class RoomCreate(BaseModel):
    estimate_id: int
    phase_name: str
    floor_name: str
    room_name: str


class RoomResponse(BaseModel):
    id: int
    estimate_id: int
    phase_name: str
    floor_name: str
    room_name: str
