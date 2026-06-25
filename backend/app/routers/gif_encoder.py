"""GIF encoding routes."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.gif_encoder_service import GifEncoderError, encode_gif_from_video
from app.utils.temp_files import temp_workspace

router = APIRouter(prefix="/api/v1/encode", tags=["encode"])


class EncodeGifRequest(BaseModel):
    local_path: str
    width: int | None = Field(default=None, ge=120, le=1920)
    fps: int | None = Field(default=None, ge=1, le=30)
    transparent: bool = False
    quality: str = Field(default="standard", pattern="^(standard|maximum)$")


@router.post("/gif")
async def encode_gif(body: EncodeGifRequest):
    settings = get_settings()
    video_path = Path(body.local_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    try:
        with temp_workspace("encode-") as workspace:
            output = workspace / "output.gif"
            await encode_gif_from_video(
                video_path,
                output,
                width=body.width or settings.default_gif_width,
                fps=body.fps or settings.default_gif_fps,
                alpha_threshold=settings.alpha_threshold,
                transparent=body.transparent,
                quality=body.quality,
            )
            final = settings.get_temp_base() / "encodes" / output.name
            final.parent.mkdir(parents=True, exist_ok=True)
            import shutil

            shutil.copy2(output, final)
            return {"output_path": str(final)}
    except GifEncoderError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
