"""SiliconFlow AI video generation and ComfyUI fallback."""

import asyncio
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings


class AssetServiceError(Exception):
    pass


SILICONFLOW_BASE = "https://api.siliconflow.cn/v1"


async def submit_video_generation(
    prompt: str,
    image_size: str = "1280x720",
) -> str:
    settings = get_settings()
    if not settings.siliconflow_api_key:
        raise AssetServiceError("SILICONFLOW_API_KEY not configured")

    payload = {
        "model": settings.siliconflow_model,
        "prompt": prompt,
        "image_size": image_size,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{SILICONFLOW_BASE}/video/submit",
            headers={
                "Authorization": f"Bearer {settings.siliconflow_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise AssetServiceError(
                f"SiliconFlow submit failed ({response.status_code}): {response.text[:300]}"
            )
        data = response.json()
        request_id = data.get("requestId") or data.get("request_id")
        if not request_id:
            raise AssetServiceError("No requestId in SiliconFlow response")
        return str(request_id)


async def poll_video_status(request_id: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{SILICONFLOW_BASE}/video/status",
            headers={
                "Authorization": f"Bearer {settings.siliconflow_api_key}",
                "Content-Type": "application/json",
            },
            json={"requestId": request_id},
        )
        if response.status_code >= 400:
            raise AssetServiceError(
                f"SiliconFlow status failed ({response.status_code}): {response.text[:300]}"
            )
        return response.json()


async def generate_video_with_polling(
    prompt: str,
    output_dir: Path,
    *,
    image_size: str = "1280x720",
    poll_interval: float = 10.0,
    max_wait: float = 600.0,
    on_progress: Any = None,
) -> dict[str, Any]:
    request_id = await submit_video_generation(prompt, image_size)
    elapsed = 0.0
    while elapsed < max_wait:
        status_data = await poll_video_status(request_id)
        status = (
            status_data.get("status")
            or status_data.get("state")
            or ""
        ).lower()

        if on_progress:
            on_progress(status_data)

        if status in ("succeed", "success", "completed", "done"):
            video_url = (
                status_data.get("video_url")
                or status_data.get("url")
                or (status_data.get("results") or {}).get("url")
            )
            if not video_url and status_data.get("videos"):
                video_url = status_data["videos"][0].get("url")
            if not video_url:
                raise AssetServiceError("Generation succeeded but no video URL found")

            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"siliconflow_{request_id}.mp4"
            async with httpx.AsyncClient(timeout=120.0) as client:
                dl = await client.get(video_url, follow_redirects=True)
                dl.raise_for_status()
                output_path.write_bytes(dl.content)

            return {
                "request_id": request_id,
                "local_path": str(output_path),
                "video_url": video_url,
            }

        if status in ("failed", "error", "cancelled"):
            raise AssetServiceError(
                f"Video generation failed: {status_data.get('message', status)}"
            )

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise AssetServiceError(f"Video generation timed out after {max_wait}s")


async def check_comfyui_available() -> bool:
    settings = get_settings()
    if not settings.comfyui_enabled:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.comfyui_host}/system_stats")
            return response.status_code == 200
    except Exception:
        return False


async def generate_via_comfyui(
    prompt: str,
    output_dir: Path,
    workflow_path: Path | None = None,
) -> dict[str, Any]:
    """Basic ComfyUI generation via WebSocket queue."""
    import json
    import uuid

    import websocket

    settings = get_settings()
    if not settings.comfyui_enabled:
        raise AssetServiceError("ComfyUI is not enabled")

    workflow_path = workflow_path or settings.comfyui_workflow
    client_id = str(uuid.uuid4())
    ws_url = settings.comfyui_host.replace("http://", "ws://").replace(
        "https://", "wss://"
    ) + "/ws?clientId=" + client_id

    workflow: dict[str, Any]
    if workflow_path and workflow_path.exists():
        workflow = json.loads(workflow_path.read_text())
    else:
        raise AssetServiceError(
            "ComfyUI workflow file required. Set COMFYUI_WORKFLOW_PATH."
        )

    def _run() -> dict[str, Any]:
        ws = websocket.WebSocket()
        ws.connect(ws_url, timeout=30)
        try:
            import urllib.request

            payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode()
            req = urllib.request.Request(
                f"{settings.comfyui_host}/prompt",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=30)
            while True:
                msg = ws.recv()
                if isinstance(msg, str):
                    data = json.loads(msg)
                    if data.get("type") == "executing":
                        node = data.get("data", {}).get("node")
                        if node is None:
                            break
            return {"client_id": client_id, "status": "completed"}
        finally:
            ws.close()

    result = await asyncio.to_thread(_run)
    output_dir.mkdir(parents=True, exist_ok=True)
    return {"prompt": prompt, **result, "local_path": str(output_dir / "comfyui_output.mp4")}
