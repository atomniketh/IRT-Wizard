"""
In-memory analysis log storage for real-time progress updates.
"""

from collections import defaultdict
from datetime import datetime
from threading import Lock
from typing import Any
import uuid


class AnalysisLogger:
    """Thread-safe in-memory log storage for analysis progress."""

    def __init__(self, max_logs_per_analysis: int = 1000):
        self._logs: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._lock = Lock()
        self._max_logs = max_logs_per_analysis

    def log(self, analysis_id: str | uuid.UUID, message: str, level: str = "info") -> None:
        """Add a log entry for an analysis."""
        analysis_id_str = str(analysis_id)
        timestamp = datetime.utcnow().strftime("%H:%M:%S")

        entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message,
            "formatted": f"[{timestamp}] {message}",
        }

        with self._lock:
            logs = self._logs[analysis_id_str]
            logs.append(entry)
            if len(logs) > self._max_logs:
                self._logs[analysis_id_str] = logs[-self._max_logs:]

    def get_logs(self, analysis_id: str | uuid.UUID, since_index: int = 0) -> list[str]:
        """Get formatted log messages for an analysis."""
        analysis_id_str = str(analysis_id)
        with self._lock:
            logs = self._logs.get(analysis_id_str, [])
            return [log["formatted"] for log in logs[since_index:]]

    def get_all_entries(self, analysis_id: str | uuid.UUID) -> list[dict[str, Any]]:
        """Get all log entries with metadata."""
        analysis_id_str = str(analysis_id)
        with self._lock:
            return list(self._logs.get(analysis_id_str, []))

    def clear(self, analysis_id: str | uuid.UUID) -> None:
        """Clear logs for an analysis."""
        analysis_id_str = str(analysis_id)
        with self._lock:
            if analysis_id_str in self._logs:
                del self._logs[analysis_id_str]

    def info(self, analysis_id: str | uuid.UUID, message: str) -> None:
        """Log an info message."""
        self.log(analysis_id, message, "info")

    def warning(self, analysis_id: str | uuid.UUID, message: str) -> None:
        """Log a warning message."""
        self.log(analysis_id, f"⚠ WARNING: {message}", "warning")

    def error(self, analysis_id: str | uuid.UUID, message: str) -> None:
        """Log an error message."""
        self.log(analysis_id, f"✗ ERROR: {message}", "error")

    def success(self, analysis_id: str | uuid.UUID, message: str) -> None:
        """Log a success message."""
        self.log(analysis_id, f"✓ {message}", "success")

    def step(self, analysis_id: str | uuid.UUID, message: str) -> None:
        """Log a step/progress message."""
        self.log(analysis_id, f"→ {message}", "step")


analysis_logger = AnalysisLogger()
