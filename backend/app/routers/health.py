"""Health and job status routes."""

import asyncio
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.jobs.status import job_store

router = APIRouter(tags=["system"])


@router.get("/health")
async def health_check():
    ffmpeg_ok = shutil.which("ffmpeg") is not None
    gifski_ok = shutil.which("gifski") is not None
    rembg_ok = False
    try:
        import rembg  # noqa: F401

        rembg_ok = True
    except ImportError:
        pass

    ffmpeg_version = None
    if ffmpeg_ok:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if stdout:
            ffmpeg_version = stdout.decode().split("\n")[0]

    return {
        "status": "ok" if ffmpeg_ok else "degraded",
        "ffmpeg": ffmpeg_ok,
        "ffmpeg_version": ffmpeg_version,
        "rembg": rembg_ok,
        "gifski": gifski_ok,
    }


@router.get("/api/v1/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
        "error": job.error,
        "result_path": job.result_path,
        "meta": job.meta,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.get("/api/v1/files/{job_id}/output.gif")
async def download_gif(job_id: str):
    job = job_store.get(job_id)
    if not job or not job.result_path:
        raise HTTPException(status_code=404, detail="Output not found")
    path = Path(job.result_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")
    return FileResponse(
        path,
        media_type="image/gif",
        filename=f"output-{job_id[:8]}.gif",
    )
