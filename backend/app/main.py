from fastapi import FastAPI
from app.api.products import router as products_router

app = FastAPI(
    title="Sercora",
    version="0.1"
)

app.include_router(products_router)


@app.get("/")
def root():
    return {
        "application": "Sercora",
        "version": "0.1"
    }
