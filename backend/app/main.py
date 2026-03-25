from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.predict import router as predict_router
from app.routes.metrics import router as metrics_router
from app.routes.regions import router as regions_router
from app.routes.weather import router as weather_router

app = FastAPI(title="GridShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(regions_router, prefix="/api")
app.include_router(weather_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "GridShield API running"}