"""File upload routes for local media."""

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings

router = APIRouter(prefix="/api/v1/upload", tags=["upload"])


@router.post("/mp4")
async def upload_mp4(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    is_video = (
        "video" in content_type
        or filename.endswith((".mp4", ".mov", ".webm", ".m4v"))
    )
    if not is_video:
        raise HTTPException(
            status_code=400,
            detail="File must be a video (MP4, MOV, or WebM)",
        )

    settings = get_settings()
    upload_dir = settings.get_temp_base() / "uploads" / str(uuid4())
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / (file.filename or "upload.mp4")

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"local_path": str(dest), "filename": file.filename}
