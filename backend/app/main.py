from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.products import router as products_router
from app.api.projects import router as projects_router
from app.api.estimates import router as estimates_router
from app.api.rooms import router as rooms_router
from app.api.estimate_lines import router as estimate_lines_router
from app.api.estimate_quantities import router as estimate_quantities_router
from app.api.matrix import router as matrix_router


app = FastAPI(
    title="Sercora",
    version="0.1"
)


#
# CORS
#
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


#
# Routers
#
app.include_router(products_router)
app.include_router(projects_router)
app.include_router(estimates_router)
app.include_router(rooms_router)
app.include_router(estimate_lines_router)
app.include_router(estimate_quantities_router)
app.include_router(matrix_router)


@app.get("/")
def root():

    return {
        "application": "Sercora",
        "version": "0.1"
    }


@app.get("/health")
def health():

    return {
        "status": "ok"
    }


@app.get("/version")
def version():

    return {
        "application": "Sercora",
        "version": "0.1"
    }
