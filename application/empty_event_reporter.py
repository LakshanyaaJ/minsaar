"""Persist and asynchronously report confirmed-empty occupancy events."""

from __future__ import annotations

import json
import hashlib
import re
import shutil
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests

EVENT_FIELDS = (
    "room_id",
    "timestamp_seconds",
    "detected_count",
    "occupancy_estimate",
    "occupancy_status",
    "empty_confirmation_status",
)


class EmptyEventReporter:
    """Save each confirmed-empty transition once and POST it in a worker thread."""

    def __init__(
        self,
        storage_dir: str | Path,
        backend_url: str | None,
        timeout_seconds: float = 5.0,
        post: Callable[..., Any] = requests.post,
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be greater than zero")
        self.storage_dir = Path(storage_dir)
        self.pending_dir = self.storage_dir / "pending"
        self.sent_dir = self.storage_dir / "sent"
        self.backend_url = backend_url.strip() if backend_url else ""
        self.timeout_seconds = timeout_seconds
        self._post = post
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._lock = threading.Lock()
        self._empty_latched = False
        self._in_flight: set[Path] = set()
        self._futures: list[Future] = []
        self._status_updates: list[str] = []

    def observe(self, record: dict, room_id: str) -> Path | None:
        """Save and queue one event on transition into confirmed-empty state."""
        if record.get("occupancy_status") == "occupied":
            self._empty_latched = False
            return None
        if (
            record.get("occupancy_status") != "empty"
            or not record.get("empty_confirmation_status")
            or self._empty_latched
        ):
            return None

        self._empty_latched = True
        payload = {field: record[field] for field in EVENT_FIELDS if field != "room_id"}
        payload["room_id"] = room_id
        event_path, created = self._save_event(payload)
        if not created:
            return event_path
        with self._lock:
            if self.backend_url:
                self._queue_post(event_path)
                self._status_updates.append(
                    f"Backend delivery queued for confirmed-empty event ({room_id})."
                )
            else:
                self._status_updates.append(
                    "BACKEND_API_URL is not configured; event saved locally and not sent."
                )
        return event_path

    def retry_pending(self) -> int:
        """Queue locally saved events that have not yet been accepted."""
        if not self.backend_url:
            return 0
        queued = 0
        self.pending_dir.mkdir(parents=True, exist_ok=True)
        for event_path in sorted(self.pending_dir.glob("*.json")):
            with self._lock:
                if event_path not in self._in_flight:
                    self._queue_post(event_path)
                    queued += 1
        return queued

    def get_status_updates(self) -> list[str]:
        """Return and clear status messages produced by worker tasks."""
        with self._lock:
            updates = self._status_updates[:]
            self._status_updates.clear()
        return updates

    def wait_for_idle(self, timeout: float = 10.0) -> None:
        """Wait for currently submitted tasks; primarily useful for tests."""
        with self._lock:
            futures = self._futures[:]
        for future in futures:
            future.result(timeout=timeout)

    def close(self) -> None:
        """Stop accepting work without delaying the video-processing thread."""
        self._executor.shutdown(wait=False)

    def _save_event(self, payload: dict) -> tuple[Path, bool]:
        self.pending_dir.mkdir(parents=True, exist_ok=True)
        self.sent_dir.mkdir(parents=True, exist_ok=True)
        room_slug = re.sub(r"[^A-Za-z0-9_-]+", "_", payload["room_id"]).strip("_")
        timestamp = f"{float(payload['timestamp_seconds']):.6f}".replace(".", "_")
        content = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        fingerprint = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
        filename = f"{room_slug or 'room'}_{timestamp}_{fingerprint}.json"
        pending_path = self.pending_dir / filename
        sent_path = self.sent_dir / filename
        if sent_path.exists():
            return sent_path, False
        if pending_path.exists():
            return pending_path, False
        with pending_path.open("x", encoding="utf-8") as event_file:
            json.dump(payload, event_file, indent=2)
            event_file.write("\n")
        return pending_path, True

    def _queue_post(self, event_path: Path) -> None:
        self._in_flight.add(event_path)
        future = self._executor.submit(self._post_saved_event, event_path)
        self._futures.append(future)

    def _post_saved_event(self, event_path: Path) -> None:
        try:
            with event_path.open(encoding="utf-8") as event_file:
                payload = json.load(event_file)
            response = self._post(
                self.backend_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            self.sent_dir.mkdir(parents=True, exist_ok=True)
            sent_path = self.sent_dir / event_path.name
            if sent_path.exists():
                sent_path = self.sent_dir / (
                    f"{event_path.stem}_{datetime.now(timezone.utc).timestamp():.6f}.json"
                )
            shutil.move(str(event_path), str(sent_path))
            message = f"Backend accepted confirmed-empty event: {sent_path.name}."
        except requests.Timeout:
            message = (
                f"Backend request timed out; event remains pending for retry: {event_path.name}."
            )
        except requests.ConnectionError:
            message = (
                f"Backend connection failed; event remains pending for retry: {event_path.name}."
            )
        except requests.RequestException as exc:
            message = (
                f"Backend rejected or could not receive event ({exc}); "
                f"event remains pending for retry: {event_path.name}."
            )
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            message = f"Event delivery failed ({exc}); local event retained: {event_path.name}."
        finally:
            with self._lock:
                self._in_flight.discard(event_path)
                self._status_updates.append(message)