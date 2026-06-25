"""Background removal via rembg with persistent ONNX session."""

import asyncio
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

from app.config import get_settings


class RembgError(Exception):
    pass


async def extract_frames(
    video_path: Path,
    frames_dir: Path,
    fps: int,
) -> list[Path]:
    import subprocess

    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(frames_dir / "frame_%05d.png")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-an",
        "-vf",
        f"fps={fps}",
        pattern,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RembgError(f"Frame extraction failed: {stderr.decode()[-500:]}")
    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        raise RembgError("No frames extracted from video")
    return frames


async def remove_background_from_frames(
    input_frames: list[Path],
    output_dir: Path,
) -> list[Path]:
    settings = get_settings()
    output_dir.mkdir(parents=True, exist_ok=True)

    def _process() -> list[Path]:
        session = new_session(settings.rembg_model)
        output_paths: list[Path] = []
        for i, frame_path in enumerate(input_frames):
            with Image.open(frame_path) as img:
                result = remove(img, session=session)
            out_path = output_dir / f"frame_{i:05d}.png"
            result.save(out_path, "PNG")
            output_paths.append(out_path)
        return output_paths

    return await asyncio.to_thread(_process)


async def process_video_matting(
    video_path: Path,
    workspace: Path,
    fps: int,
) -> Path:
    raw_frames_dir = workspace / "raw_frames"
    rgba_frames_dir = workspace / "rgba_frames"
    frames = await extract_frames(video_path, raw_frames_dir, fps)
    await remove_background_from_frames(frames, rgba_frames_dir)
    return rgba_frames_dir
