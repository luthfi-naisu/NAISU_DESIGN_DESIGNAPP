"""YouTube ingestion routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.services.yt_dlp_service import YtDlpError, download_youtube_segment
from app.utils.temp_files import temp_workspace

router = APIRouter(prefix="/api/v1/ingest", tags=["ingestion"])


class YouTubeSegmentRequest(BaseModel):
    url: HttpUrl
    start_time: float = Field(ge=0)
    end_time: float = Field(gt=0)


@router.post("/youtube-segment")
async def ingest_youtube_segment(body: YouTubeSegmentRequest):
    try:
        with temp_workspace("ingest-") as workspace:
            path = await download_youtube_segment(
                str(body.url),
                body.start_time,
                body.end_time,
                workspace,
            )
            return {"local_path": str(path), "message": "Segment downloaded"}
    except YtDlpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
