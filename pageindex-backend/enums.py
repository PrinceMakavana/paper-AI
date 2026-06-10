from enum import Enum


class IndexStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    UNKNOWN = "unknown"
