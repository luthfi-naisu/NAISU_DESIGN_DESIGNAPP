"""High-fidelity GIF encoding via FFmpeg two-pass palettegen/paletteuse."""

import asyncio
import shutil
from pathlib import Path


class GifEncoderError(Exception):
    pass


async def _run_ffmpeg(args: list[str]) -> None:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise GifEncoderError(f"FFmpeg failed: {stderr.decode()[-800:]}")


async def encode_gif_from_video(
    video_path: Path,
    output_path: Path,
    *,
    width: int = 480,
    fps: int = 12,
    alpha_threshold: int = 128,
    transparent: bool = False,
    quality: str = "standard",
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    palette_path = output_path.parent / "palette.png"

    if quality == "maximum" and shutil.which("gifski"):
        return await _encode_with_gifski(video_path, output_path, width, fps)

    reserve = "reserve_transparent=1" if transparent else ""
    palettegen_filter = f"fps={fps},scale={width}:-1:flags=lanczos,palettegen={reserve}".rstrip("=")
    if not reserve:
        palettegen_filter = f"fps={fps},scale={width}:-1:flags=lanczos,palettegen"

    await _run_ffmpeg([
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", palettegen_filter,
        str(palette_path),
    ])

    if transparent:
        paletteuse = (
            f"fps={fps},scale={width}:-1:flags=lanczos[x];"
            f"[x][1:v]paletteuse=alpha_threshold={alpha_threshold}:dither=bayer:bayer_scale=3"
        )
    else:
        paletteuse = (
            f"fps={fps},scale={width}:-1:flags=lanczos[x];"
            f"[x][1:v]paletteuse=dither=bayer:bayer_scale=3"
        )

    await _run_ffmpeg([
        "ffmpeg", "-y", "-i", str(video_path), "-i", str(palette_path),
        "-lavfi", paletteuse,
        str(output_path),
    ])
    return output_path


async def encode_gif_from_png_sequence(
    frames_dir: Path,
    output_path: Path,
    *,
    width: int = 480,
    fps: int = 12,
    alpha_threshold: int = 128,
    quality: str = "standard",
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    palette_path = output_path.parent / "palette.png"
    pattern = str(frames_dir / "frame_%05d.png")

    if quality == "maximum" and shutil.which("gifski"):
        return await _encode_png_sequence_gifski(frames_dir, output_path, width, fps)

    palettegen_filter = (
        f"fps={fps},scale={width}:-1:flags=lanczos,palettegen=reserve_transparent=1"
    )
    await _run_ffmpeg([
        "ffmpeg", "-y", "-framerate", str(fps), "-i", pattern,
        "-vf", palettegen_filter,
        str(palette_path),
    ])

    paletteuse = (
        f"fps={fps},scale={width}:-1:flags=lanczos[x];"
        f"[x][1:v]paletteuse=alpha_threshold={alpha_threshold}:dither=bayer:bayer_scale=3"
    )
    await _run_ffmpeg([
        "ffmpeg", "-y", "-framerate", str(fps), "-i", pattern,
        "-i", str(palette_path),
        "-lavfi", paletteuse,
        str(output_path),
    ])
    return output_path


async def _encode_with_gifski(
    video_path: Path,
    output_path: Path,
    width: int,
    fps: int,
) -> Path:
    ffmpeg_proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", f"fps={fps},scale={width}:-1:flags=lanczos",
        "-f", "yuv4mpegpipe", "-",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    gifski_proc = await asyncio.create_subprocess_exec(
        "gifski", "-o", str(output_path), "--fps", str(fps), "-",
        stdin=ffmpeg_proc.stdout,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if ffmpeg_proc.stdout:
        ffmpeg_proc.stdout.close()
    _, gifski_err = await gifski_proc.communicate()
    await ffmpeg_proc.wait()
    if gifski_proc.returncode != 0:
        raise GifEncoderError(f"gifski failed: {gifski_err.decode()[-500:]}")
    return output_path


async def _encode_png_sequence_gifski(
    frames_dir: Path,
    output_path: Path,
    width: int,
    fps: int,
) -> Path:
    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        raise GifEncoderError("No PNG frames for gifski")

    resized_dir = frames_dir.parent / "resized_frames"
    resized_dir.mkdir(exist_ok=True)
    for frame in frames:
        out = resized_dir / frame.name
        await _run_ffmpeg([
            "ffmpeg", "-y", "-i", str(frame),
            "-vf", f"scale={width}:-1:flags=lanczos",
            str(out),
        ])

    resized = sorted(resized_dir.glob("frame_*.png"))
    cmd = ["gifski", "-o", str(output_path), "--fps", str(fps), "--quality", "100"]
    cmd.extend(str(f) for f in resized)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise GifEncoderError(f"gifski failed: {stderr.decode()[-500:]}")
    return output_path
