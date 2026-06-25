"""Design App FastAPI backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import assets, gif_encoder, health, ingestion, matting, pipeline, upload, upscale

settings = get_settings()

app = FastAPI(
    title="Design App API",
    description="Local-first media processing: YouTube to GIF, Shutterstock, AI video",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(ingestion.router)
app.include_router(matting.router)
app.include_router(gif_encoder.router)
app.include_router(pipeline.router)
app.include_router(assets.router)
app.include_router(upload.router)
app.include_router(upscale.router)


@app.get("/")
async def root():
    return {"name": "Design App API", "docs": "/docs"}
