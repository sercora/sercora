from pydantic import BaseModel


class EstimateQuantityUpdate(BaseModel):

    quantity: float
