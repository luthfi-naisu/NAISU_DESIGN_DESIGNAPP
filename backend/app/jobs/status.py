"""In-memory job status tracking."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from threading import Lock
from typing import Any
from uuid import uuid4


class JobStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    MATTING = "matting"
    ENCODING = "encoding"
    GENERATING = "generating"
    LICENSING = "licensing"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    message: str = ""
    result_path: str | None = None
    error: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def create(self, **meta: Any) -> Job:
        job = Job(id=str(uuid4()), meta=meta)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: float | None = None,
        message: str | None = None,
        result_path: str | None = None,
        error: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message
            if result_path is not None:
                job.result_path = result_path
            if error is not None:
                job.error = error
            if meta is not None:
                job.meta.update(meta)
            job.updated_at = datetime.now(timezone.utc).isoformat()
            return job


job_store = JobStore()
