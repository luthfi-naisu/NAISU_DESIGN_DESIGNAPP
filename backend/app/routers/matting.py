"""Background matting routes."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.rembg_service import RembgError, process_video_matting
from app.utils.temp_files import temp_workspace

router = APIRouter(prefix="/api/v1/matting", tags=["matting"])


class MattingRequest(BaseModel):
    local_path: str
    fps: int = Field(default=12, ge=1, le=30)


@router.post("/remove-background")
async def remove_background(body: MattingRequest):
    video_path = Path(body.local_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    try:
        with temp_workspace("matting-") as workspace:
            rgba_dir = await process_video_matting(
                video_path, workspace, body.fps
            )
            frames = sorted(rgba_dir.glob("frame_*.png"))
            return {
                "frames_dir": str(rgba_dir),
                "frame_count": len(frames),
            }
    except RembgError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
