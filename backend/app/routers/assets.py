"""Shutterstock and AI asset routes."""

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings
from app.jobs.status import JobStatus, job_store
from app.services.asset_service import (
    AssetServiceError,
    check_comfyui_available,
    generate_video_with_polling,
    generate_via_comfyui,
)
from app.services.shutterstock_service import (
    ShutterstockError,
    license_and_download,
    redownload_video,
    search_videos,
)

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])

_licensed_files: dict[str, str] = {}


class LicenseRequest(BaseModel):
    video_id: str
    size: str | None = Field(default=None, pattern="^(web|sd|hd|4k)$")
    search_id: str | None = None


class RedownloadRequest(BaseModel):
    license_id: str


class GenerateVideoRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    image_size: str = "1280x720"
    use_comfyui: bool = False


@router.get("/search")
async def asset_search(
    q: str = Query(min_length=1),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        return await search_videos(q, page=page, per_page=per_page)
    except ShutterstockError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/license")
async def asset_license(body: LicenseRequest):
    job = job_store.create(type="shutterstock-license", video_id=body.video_id)
    job_store.update(
        job.id,
        status=JobStatus.LICENSING,
        progress=10,
        message="Licensing video from Shutterstock...",
    )
    try:
        settings = get_settings()
        output_dir = settings.get_temp_base() / "licensed"
        result = await license_and_download(
            body.video_id,
            output_dir,
            size=body.size,
            search_id=body.search_id,
        )
        _licensed_files[body.video_id] = result["local_path"]
        job_store.update(
            job.id,
            status=JobStatus.DONE,
            progress=100,
            message="Licensed and downloaded",
            result_path=result["local_path"],
            meta=result,
        )
        return {"job_id": job.id, **result}
    except ShutterstockError as exc:
        job_store.update(
            job.id,
            status=JobStatus.FAILED,
            error=str(exc),
            message="License failed",
        )
        status = 402 if "quota" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/redownload")
async def asset_redownload(body: RedownloadRequest):
    try:
        settings = get_settings()
        output_dir = settings.get_temp_base() / "licensed"
        return await redownload_video(body.license_id, output_dir)
    except ShutterstockError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


async def _run_generation(job_id: str, prompt: str, image_size: str, use_comfyui: bool):
    try:
        job_store.update(
            job_id,
            status=JobStatus.GENERATING,
            progress=10,
            message="Submitting generation request...",
        )
        settings = get_settings()
        output_dir = settings.get_temp_base() / "generated"

        if use_comfyui and await check_comfyui_available():
            result = await generate_via_comfyui(prompt, output_dir)
        else:
            def on_progress(data):
                job_store.update(
                    job_id,
                    progress=50,
                    message=f"Generating... status={data.get('status', 'processing')}",
                )

            result = await generate_video_with_polling(
                prompt,
                output_dir,
                image_size=image_size,
                on_progress=on_progress,
            )

        job_store.update(
            job_id,
            status=JobStatus.DONE,
            progress=100,
            message="Video generated",
            result_path=result.get("local_path"),
            meta=result,
        )
    except AssetServiceError as exc:
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            error=str(exc),
            message="Generation failed",
        )


@router.post("/generate-video")
async def generate_video(body: GenerateVideoRequest):
    job = job_store.create(type="ai-video", prompt=body.prompt)
    asyncio.create_task(
        _run_generation(job.id, body.prompt, body.image_size, body.use_comfyui)
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/comfyui/status")
async def comfyui_status():
    available = await check_comfyui_available()
    settings = get_settings()
    return {
        "enabled": settings.comfyui_enabled,
        "available": available,
        "host": settings.comfyui_host,
    }
