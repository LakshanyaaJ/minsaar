"""Rolling occupancy estimation independent of video and UI frameworks."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from numbers import Integral
from statistics import median
from typing import Deque, Iterable, Optional


@dataclass(frozen=True)
class OccupancyRecord:
    """The integration record emitted for one processed video sample."""

    timestamp_seconds: float
    detected_count: int
    occupancy_estimate: int
    occupancy_status: str
    is_empty: bool

    def as_dict(self) -> dict:
        return {
            "timestamp_seconds": self.timestamp_seconds,
            "detected_count": self.detected_count,
            "occupancy_estimate": self.occupancy_estimate,
            "occupancy_status": self.occupancy_status,
            "is_empty": self.is_empty,
        }


class OccupancyEstimator:
    """Smooth frame counts and confirm emptiness only after sustained zeros.

    A rolling median may delay recognition of genuine arrivals and departures.
    ``zero_confirmation_samples`` prevents a single missed-detection frame from
    declaring the room empty.
    """

    def __init__(self, window_size: int = 5, zero_confirmation_samples: int = 5):
        if window_size < 1:
            raise ValueError("window_size must be at least 1")
        if zero_confirmation_samples < 1:
            raise ValueError("zero_confirmation_samples must be at least 1")
        self.window_size = window_size
        self.zero_confirmation_samples = zero_confirmation_samples
        self._counts: Deque[int] = deque(maxlen=window_size)
        self._consecutive_zeros = 0
        self._is_empty = False

    def reset(self) -> None:
        """Reset all state before processing a new video."""
        self._counts.clear()
        self._consecutive_zeros = 0
        self._is_empty = False

    def update(self, detected_count: int, timestamp_seconds: float) -> OccupancyRecord:
        """Add one count and return its smoothed integration record."""
        if isinstance(detected_count, bool) or not isinstance(detected_count, Integral):
            raise ValueError("detected_count must be a non-negative integer")
        if detected_count < 0:
            raise ValueError("detected_count cannot be negative")
        if timestamp_seconds < 0:
            raise ValueError("timestamp_seconds cannot be negative")

        detected_count = int(detected_count)
        self._counts.append(detected_count)
        if detected_count == 0:
            self._consecutive_zeros += 1
        else:
            self._consecutive_zeros = 0
            self._is_empty = False

        estimate = int(median(self._counts))
        if self._consecutive_zeros >= self.zero_confirmation_samples:
            self._is_empty = True

        if self._is_empty:
            status = "empty"
        elif detected_count > 0:
            status = "occupied"
        else:
            status = "possibly_empty"
        return OccupancyRecord(
            timestamp_seconds=float(timestamp_seconds),
            detected_count=detected_count,
            occupancy_estimate=estimate,
            occupancy_status=status,
            is_empty=self._is_empty,
        )

    def process(self, counts: Iterable[int], timestamps: Optional[Iterable[float]] = None) -> list[OccupancyRecord]:
        """Process count samples, optionally paired with timestamps."""
        values = list(counts)
        times = list(timestamps) if timestamps is not None else list(range(len(values)))
        if len(values) != len(times):
            raise ValueError("counts and timestamps must have the same length")
        return [self.update(count, timestamp) for count, timestamp in zip(values, times)]
