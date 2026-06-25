"""Pipeline orchestration routes."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.config import get_settings
from app.jobs.status import job_store
from app.services.pipeline_service import (
    start_mp4_pipeline_background,
    start_youtube_pipeline_background,
)

router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"])


class YouTubeToGifRequest(BaseModel):
    url: HttpUrl
    start_time: float = Field(ge=0)
    end_time: float = Field(gt=0)
    remove_background: bool = False
    width: int | None = Field(default=None, ge=120, le=1920)
    fps: int | None = Field(default=None, ge=1, le=30)
    quality: str = Field(default="standard", pattern="^(standard|maximum)$")


class Mp4ToGifRequest(BaseModel):
    local_path: str
    remove_background: bool = False
    width: int | None = Field(default=None, ge=120, le=1920)
    fps: int | None = Field(default=None, ge=1, le=30)
    quality: str = Field(default="standard", pattern="^(standard|maximum)$")


@router.post("/youtube-to-gif")
async def youtube_to_gif(body: YouTubeToGifRequest):
    settings = get_settings()
    duration = body.end_time - body.start_time
    if duration > settings.max_segment_duration:
        raise HTTPException(
            status_code=400,
            detail=f"Segment exceeds max {settings.max_segment_duration}s",
        )

    job_id = start_youtube_pipeline_background(
        url=str(body.url),
        start_time=body.start_time,
        end_time=body.end_time,
        remove_background=body.remove_background,
        width=body.width,
        fps=body.fps,
        quality=body.quality,
    )
    job = job_store.get(job_id)
    return {"job_id": job_id, "status": job.status.value if job else "queued"}


@router.post("/mp4-to-gif")
async def mp4_to_gif(body: Mp4ToGifRequest):
    mp4_path = Path(body.local_path)
    if not mp4_path.exists():
        raise HTTPException(status_code=404, detail="Local MP4 file not found")

    job_id = start_mp4_pipeline_background(
        mp4_path=mp4_path,
        remove_background=body.remove_background,
        width=body.width,
        fps=body.fps,
        quality=body.quality,
    )
    job = job_store.get(job_id)
    return {"job_id": job_id, "status": job.status.value if job else "queued"}
