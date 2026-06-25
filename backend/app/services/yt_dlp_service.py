"""YouTube segment ingestion via yt-dlp + FFmpeg byte-range download."""

import asyncio
from pathlib import Path

import yt_dlp

from app.config import get_settings


class YtDlpError(Exception):
    pass


async def download_youtube_segment(
    url: str,
    start_time: float,
    end_time: float,
    output_dir: Path,
) -> Path:
    settings = get_settings()
    duration = end_time - start_time
    if duration <= 0:
        raise YtDlpError("end_time must be greater than start_time")
    if duration > settings.max_segment_duration:
        raise YtDlpError(
            f"Segment duration {duration:.1f}s exceeds max "
            f"{settings.max_segment_duration}s"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(output_dir / "segment.%(ext)s")

    ffmpeg_args = {
        "ffmpeg_i": ["-ss", str(start_time), "-to", str(end_time)],
    }
    opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
        "external_downloader": "ffmpeg",
        "external_downloader_args": ffmpeg_args,
        "merge_output_format": "mp4",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
    }

    def _download() -> Path:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise YtDlpError("Failed to extract video info")
            prepared = ydl.prepare_filename(info)
            path = Path(prepared)
            if path.suffix != ".mp4":
                mp4_path = path.with_suffix(".mp4")
                if mp4_path.exists():
                    return mp4_path
            if not path.exists():
                candidates = list(output_dir.glob("segment.*"))
                if candidates:
                    return candidates[0]
                raise YtDlpError("Download completed but output file not found")
            return path

    return await asyncio.to_thread(_download)
