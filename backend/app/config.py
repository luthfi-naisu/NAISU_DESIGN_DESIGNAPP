"""Application configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    temp_dir: Path | None = None
    max_segment_duration: float = 30.0
    default_gif_width: int = 480
    default_gif_fps: int = 12
    alpha_threshold: int = 128
    rembg_model: str = "birefnet-general"

    shutterstock_client_id: str = ""
    shutterstock_client_secret: str = ""
    shutterstock_api_token: str = ""
    shutterstock_subscription_id: str = ""
    shutterstock_license_size: str = "hd"

    siliconflow_api_key: str = ""
    siliconflow_model: str = "Wan-AI/Wan2.1-I2V-14B-720P-Turbo"

    replicate_api_token: str = ""

    comfyui_enabled: bool = False
    comfyui_host: str = "http://127.0.0.1:8188"
    comfyui_workflow_path: str | None = None

    @property
    def comfyui_workflow(self) -> Path | None:
        if self.comfyui_workflow_path:
            return Path(self.comfyui_workflow_path)
        return None

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def get_temp_base(self) -> Path:
        if self.temp_dir:
            base = Path(self.temp_dir)
        else:
            base = Path.cwd() / ".tmp"
        base.mkdir(parents=True, exist_ok=True)
        return base


@lru_cache
def get_settings() -> Settings:
    return Settings()
