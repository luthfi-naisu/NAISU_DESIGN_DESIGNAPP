"""Replicate Real-ESRGAN image upscaling."""

import asyncio
import base64
from io import BytesIO
from pathlib import Path

from app.config import get_settings


class UpscaleError(Exception):
    pass


async def upscale_image(
    image_bytes: bytes,
    output_dir: Path,
    scale: int = 4,
) -> dict[str, str]:
    settings = get_settings()
    if not settings.replicate_api_token:
        raise UpscaleError("REPLICATE_API_TOKEN not configured")

    def _run() -> str:
        import os

        import replicate

        os.environ["REPLICATE_API_TOKEN"] = settings.replicate_api_token
        b64 = base64.b64encode(image_bytes).decode()
        data_uri = f"data:image/png;base64,{b64}"
        output = replicate.run(
            "nightmareai/real-esrgan:928360997668da244053ae5435b243e1d2e23c679c0c0276d12ad439a0553eb",
            input={"image": data_uri, "scale": scale, "face_enhance": False},
        )
        if isinstance(output, str):
            return output
        if hasattr(output, "read"):
            return output.read()
        raise UpscaleError("Unexpected Replicate output format")

    try:
        result = await asyncio.to_thread(_run)
    except Exception as exc:
        raise UpscaleError(str(exc)) from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "upscaled.png"

    if isinstance(result, bytes):
        output_path.write_bytes(result)
        b64_out = base64.b64encode(result).decode()
    elif isinstance(result, str) and result.startswith("http"):
        import httpx

        async def _download() -> bytes:
            async with httpx.AsyncClient() as client:
                r = await client.get(result)
                r.raise_for_status()
                return r.content

        data = await _download()
        output_path.write_bytes(data)
        b64_out = base64.b64encode(data).decode()
    else:
        raise UpscaleError("Could not process upscale result")

    return {
        "local_path": str(output_path),
        "base64": b64_out,
    }
