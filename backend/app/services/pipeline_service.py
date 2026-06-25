"""Pipeline orchestrators for YouTube/MP4 to GIF conversion."""

import asyncio
import shutil
from pathlib import Path

from app.config import get_settings
from app.jobs.status import JobStatus, job_store
from app.services.gif_encoder_service import (
    encode_gif_from_png_sequence,
    encode_gif_from_video,
)
from app.services.rembg_service import process_video_matting
from app.services.yt_dlp_service import download_youtube_segment
from app.utils.temp_files import temp_workspace


async def run_youtube_to_gif_pipeline(
    job_id: str,
    *,
    url: str,
    start_time: float,
    end_time: float,
    remove_background: bool = False,
    width: int | None = None,
    fps: int | None = None,
    quality: str = "standard",
) -> None:
    settings = get_settings()
    gif_width = width or settings.default_gif_width
    gif_fps = fps or settings.default_gif_fps

    try:
        job_store.update(
            job_id,
            status=JobStatus.DOWNLOADING,
            progress=10,
            message="Downloading YouTube segment...",
        )

        with temp_workspace("yt-gif-") as workspace:
            mp4_path = await download_youtube_segment(
                url, start_time, end_time, workspace
            )

            job_store.update(
                job_id,
                progress=40,
                message="Segment downloaded, encoding GIF...",
            )

            output_gif = workspace / "output.gif"

            if remove_background:
                job_store.update(
                    job_id,
                    status=JobStatus.MATTING,
                    progress=50,
                    message="Removing background with BiRefNet...",
                )
                rgba_frames_dir = await process_video_matting(
                    mp4_path, workspace, gif_fps
                )
                job_store.update(
                    job_id,
                    status=JobStatus.ENCODING,
                    progress=75,
                    message="Encoding transparent GIF...",
                )
                await encode_gif_from_png_sequence(
                    rgba_frames_dir,
                    output_gif,
                    width=gif_width,
                    fps=gif_fps,
                    alpha_threshold=settings.alpha_threshold,
                    quality=quality,
                )
            else:
                job_store.update(
                    job_id,
                    status=JobStatus.ENCODING,
                    progress=70,
                    message="Encoding GIF with two-pass palette...",
                )
                await encode_gif_from_video(
                    mp4_path,
                    output_gif,
                    width=gif_width,
                    fps=gif_fps,
                    alpha_threshold=settings.alpha_threshold,
                    transparent=False,
                    quality=quality,
                )

            final_dir = settings.get_temp_base() / "outputs" / job_id
            final_dir.mkdir(parents=True, exist_ok=True)
            final_path = final_dir / "output.gif"
            shutil.copy2(output_gif, final_path)

            job_store.update(
                job_id,
                status=JobStatus.DONE,
                progress=100,
                message="GIF ready",
                result_path=str(final_path),
            )

    except Exception as exc:
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            progress=100,
            message="Pipeline failed",
            error=str(exc),
        )


async def run_mp4_to_gif_pipeline(
    job_id: str,
    *,
    mp4_path: Path,
    remove_background: bool = False,
    width: int | None = None,
    fps: int | None = None,
    quality: str = "standard",
) -> None:
    settings = get_settings()
    gif_width = width or settings.default_gif_width
    gif_fps = fps or settings.default_gif_fps

    try:
        if not mp4_path.exists():
            raise FileNotFoundError(f"MP4 not found: {mp4_path}")

        job_store.update(
            job_id,
            status=JobStatus.ENCODING,
            progress=20,
            message="Processing local MP4...",
        )

        with temp_workspace("mp4-gif-") as workspace:
            output_gif = workspace / "output.gif"

            if remove_background:
                job_store.update(
                    job_id,
                    status=JobStatus.MATTING,
                    progress=40,
                    message="Removing background...",
                )
                rgba_frames_dir = await process_video_matting(
                    mp4_path, workspace, gif_fps
                )
                job_store.update(
                    job_id,
                    status=JobStatus.ENCODING,
                    progress=70,
                    message="Encoding transparent GIF...",
                )
                await encode_gif_from_png_sequence(
                    rgba_frames_dir,
                    output_gif,
                    width=gif_width,
                    fps=gif_fps,
                    alpha_threshold=settings.alpha_threshold,
                    quality=quality,
                )
            else:
                await encode_gif_from_video(
                    mp4_path,
                    output_gif,
                    width=gif_width,
                    fps=gif_fps,
                    transparent=False,
                    quality=quality,
                )

            final_dir = settings.get_temp_base() / "outputs" / job_id
            final_dir.mkdir(parents=True, exist_ok=True)
            final_path = final_dir / "output.gif"
            shutil.copy2(output_gif, final_path)

            job_store.update(
                job_id,
                status=JobStatus.DONE,
                progress=100,
                message="GIF ready",
                result_path=str(final_path),
            )

    except Exception as exc:
        job_store.update(
            job_id,
            status=JobStatus.FAILED,
            progress=100,
            message="Pipeline failed",
            error=str(exc),
        )


def start_youtube_pipeline_background(**kwargs) -> str:
    job = job_store.create(type="youtube-to-gif", **kwargs)
    asyncio.create_task(run_youtube_to_gif_pipeline(job.id, **kwargs))
    return job.id


def start_mp4_pipeline_background(**kwargs) -> str:
    job = job_store.create(type="mp4-to-gif", **{
        k: v for k, v in kwargs.items() if k != "mp4_path"
    })
    mp4 = kwargs["mp4_path"]
    asyncio.create_task(
        run_mp4_to_gif_pipeline(
            job.id,
            mp4_path=mp4,
            remove_background=kwargs.get("remove_background", False),
            width=kwargs.get("width"),
            fps=kwargs.get("fps"),
            quality=kwargs.get("quality", "standard"),
        )
    )
    return job.id
