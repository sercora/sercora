from sqlalchemy import Column, BigInteger, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Product(Base):
    __tablename__ = "product"

    id = Column(BigInteger, primary_key=True)
    name = Column(String)
