"""Image upscaling routes."""

import base64

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import get_settings
from app.services.upscale_service import UpscaleError, upscale_image

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class UpscaleBase64Request(BaseModel):
    image_base64: str
    scale: int = 4


@router.post("/upscale")
async def upscale_upload(file: UploadFile = File(...), scale: int = 4):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    data = await file.read()
    settings = get_settings()
    output_dir = settings.get_temp_base() / "upscaled"
    try:
        result = await upscale_image(data, output_dir, scale=scale)
        return result
    except UpscaleError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/upscale/base64")
async def upscale_base64(body: UpscaleBase64Request):
    try:
        raw = body.image_base64
        if "," in raw:
            raw = raw.split(",", 1)[1]
        data = base64.b64decode(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc

    settings = get_settings()
    output_dir = settings.get_temp_base() / "upscaled"
    try:
        return await upscale_image(data, output_dir, scale=body.scale)
    except UpscaleError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
