"""Frame-by-frame video processing and reusable occupancy API."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Optional

import cv2

from detector import PersonDetector
from occupancy import OccupancyEstimator, OccupancyRecord

SUPPORTED_EXTENSIONS = {".mp4", ".avi", ".mov"}


def validate_video_path(video_path: str | Path) -> Path:
    """Validate extension and existence of a video path."""
    path = Path(video_path)
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError("Supported video formats are MP4, AVI, and MOV")
    if not path.is_file():
        raise FileNotFoundError(f"Video file does not exist: {path}")
    return path


def process_video(
    video_path: str | Path,
    detector: Optional[PersonDetector] = None,
    model_path: str = "yolo11n.pt",
    confidence: float = 0.25,
    sample_every: int = 1,
    window_size: int = 5,
    zero_confirmation_samples: int = 3,
    on_sample: Optional[Callable[[Any, OccupancyRecord, int, int], None]] = None,
) -> list[dict]:
    """Process a video without loading it into memory and return occupancy records.

    ``on_sample`` receives ``(annotated_frame, record, processed_frames,
    total_frames)`` after each sampled frame, which the UI uses for previews
    and progress.
    """
    if sample_every < 1:
        raise ValueError("sample_every must be at least 1")
    path = validate_video_path(video_path)
    estimator = OccupancyEstimator(window_size, zero_confirmation_samples)
    detector = detector or PersonDetector(model_path, confidence)
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        capture.release()
        raise ValueError(f"OpenCV could not open video: {path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    records: list[dict] = []
    frame_index = 0
    try:
        while True:
            success, frame = capture.read()
            if not success:
                break
            if frame_index % sample_every == 0:
                annotated, count = detector.detect(frame)
                timestamp = frame_index / fps if fps > 0 else (
                    capture.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                )
                record = estimator.update(count, timestamp).as_dict()
                records.append(record)
                if on_sample:
                    on_sample(annotated, OccupancyRecord(**record), len(records), total_frames)
            frame_index += 1
    finally:
        capture.release()
    return records
