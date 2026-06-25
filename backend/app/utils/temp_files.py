"""Temporary file and workspace utilities."""

import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import get_settings


@contextmanager
def temp_workspace(prefix: str = "design-app-") -> Iterator[Path]:
    """Create an isolated temp directory, always cleaned up."""
    settings = get_settings()
    parent = settings.get_temp_base()
    workspace = Path(tempfile.mkdtemp(prefix=prefix, dir=parent))
    try:
        yield workspace
    finally:
        if workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True)


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path
