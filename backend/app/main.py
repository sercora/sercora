from fastapi import FastAPI

app = FastAPI(
    title="Sercora",
    version="0.1"
)


@app.get("/")
def root():
    return {
        "application": "Sercora",
        "version": "0.1"
    }
