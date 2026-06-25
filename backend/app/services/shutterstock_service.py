"""Shutterstock API integration: search, license, download."""

from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings


class ShutterstockError(Exception):
    pass


BASE_URL = "https://api.shutterstock.com/v2"


def _headers(use_oauth: bool = True) -> dict[str, str]:
    settings = get_settings()
    if use_oauth and settings.shutterstock_api_token:
        return {"Authorization": f"Bearer {settings.shutterstock_api_token}"}
    if settings.shutterstock_client_id and settings.shutterstock_client_secret:
        import base64

        creds = f"{settings.shutterstock_client_id}:{settings.shutterstock_client_secret}"
        encoded = base64.b64encode(creds.encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    raise ShutterstockError("Shutterstock credentials not configured")


def _normalize_video(item: dict[str, Any]) -> dict[str, Any]:
    assets = item.get("assets", {})
    preview_mp4 = assets.get("preview_mp4", {}) or {}
    thumb_jpg = assets.get("thumb_jpg", {}) or {}
    contributor = item.get("contributor", {}) or {}
    return {
        "id": str(item.get("id", "")),
        "description": item.get("description", ""),
        "duration": item.get("duration"),
        "aspect_ratio": item.get("aspect_ratio"),
        "preview_url": preview_mp4.get("url"),
        "thumbnail_url": thumb_jpg.get("url"),
        "contributor": contributor.get("id"),
        "asset_page": f"https://www.shutterstock.com/video/clip/{item.get('id', '')}",
    }


async def search_videos(
    query: str,
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/videos/search",
            headers=_headers(),
            params={
                "query": query,
                "page": page,
                "per_page": per_page,
                "sort": "popular",
                "safe": "true",
            },
        )
        if response.status_code == 429:
            raise ShutterstockError("Rate limit exceeded. Try again later.")
        if response.status_code >= 400:
            raise ShutterstockError(
                f"Search failed ({response.status_code}): {response.text[:300]}"
            )
        data = response.json()
        search_id = response.headers.get("search-id") or data.get("search_id")
        videos = [_normalize_video(v) for v in data.get("data", [])]
        return {
            "search_id": search_id,
            "total_count": data.get("total_count", len(videos)),
            "page": page,
            "per_page": per_page,
            "videos": videos,
        }


async def license_and_download(
    video_id: str,
    output_dir: Path,
    *,
    size: str | None = None,
    search_id: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.shutterstock_api_token:
        raise ShutterstockError("OAuth token required for licensing")
    if not settings.shutterstock_subscription_id:
        raise ShutterstockError("SHUTTERSTOCK_SUBSCRIPTION_ID not configured")

    license_size = size or settings.shutterstock_license_size
    params: dict[str, str] = {
        "subscription_id": settings.shutterstock_subscription_id,
        "size": license_size,
    }
    if search_id:
        params["search_id"] = search_id

    body = {"videos": [{"video_id": video_id}]}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/videos/licenses",
            headers={**_headers(), "Content-Type": "application/json"},
            params=params,
            json=body,
        )
        if response.status_code in (402, 403):
            raise ShutterstockError(
                "Subscription quota exceeded or licensing not permitted."
            )
        if response.status_code >= 400:
            raise ShutterstockError(
                f"License failed ({response.status_code}): {response.text[:300]}"
            )

        data = response.json()
        items = data.get("data", [])
        if not items:
            raise ShutterstockError("No license data returned")

        item = items[0]
        download_info = item.get("download", {}) or {}
        download_url = download_info.get("url")
        license_id = item.get("id") or item.get("license_id")
        if not download_url:
            raise ShutterstockError("No download URL in license response")

        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"shutterstock_{video_id}.mp4"

        dl_response = await client.get(download_url, follow_redirects=True)
        if dl_response.status_code >= 400:
            raise ShutterstockError(f"Download failed: {dl_response.status_code}")
        output_path.write_bytes(dl_response.content)

        return {
            "video_id": video_id,
            "license_id": str(license_id),
            "local_path": str(output_path),
            "size": license_size,
        }


async def redownload_video(
    license_id: str,
    output_dir: Path,
) -> dict[str, Any]:
    settings = get_settings()
    body = {"videos": [{"license_id": license_id}]}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/videos/licenses/{license_id}/downloads",
            headers={**_headers(), "Content-Type": "application/json"},
            json=body,
        )
        if response.status_code >= 400:
            raise ShutterstockError(
                f"Redownload failed ({response.status_code}): {response.text[:300]}"
            )
        data = response.json()
        items = data.get("data", [])
        if not items:
            raise ShutterstockError("No redownload data returned")
        download_url = (items[0].get("download") or {}).get("url")
        if not download_url:
            raise ShutterstockError("No download URL in redownload response")

        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"redownload_{license_id}.mp4"
        dl_response = await client.get(download_url, follow_redirects=True)
        dl_response.raise_for_status()
        output_path.write_bytes(dl_response.content)
        return {"license_id": license_id, "local_path": str(output_path)}
