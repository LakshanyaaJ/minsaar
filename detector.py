"""YOLO person detector wrapper."""

from __future__ import annotations

from pathlib import Path
from typing import Any


class PersonDetector:
    """Detect COCO people (class 0) using an Ultralytics YOLO model."""

    def __init__(self, model_path: str = "yolo11n.pt", confidence: float = 0.25):
        if not 0 <= confidence <= 1:
            raise ValueError("confidence must be between 0 and 1")
        self.model_path = model_path
        self.confidence = confidence
        self._model: Any = None

    def load(self) -> None:
        """Load weights on demand, allowing tests and imports without YOLO."""
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError(
                "Ultralytics is not installed. Install requirements.txt first."
            ) from exc
        except OSError as exc:
            raise RuntimeError(
                "PyTorch could not load its Windows DLLs. Application Control "
                "blocked a native dependency. Create the virtual environment "
                "outside OneDrive (for example C:\\venvs\\people_count) or ask "
                "your administrator to allow the PyTorch DLLs, then reinstall "
                "the requirements."
            ) from exc
        try:
            self._model = YOLO(self.model_path)
        except OSError as exc:
            raise RuntimeError(
                "The YOLO/PyTorch native runtime could not load. Windows "
                "Application Control may be blocking a DLL. Use a virtual "
                "environment outside OneDrive or request an allow-list rule "
                "for the PyTorch DLLs."
            ) from exc

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def detect(self, frame: Any) -> tuple[Any, int]:
        """Return an annotated frame and the number of detected people."""
        if self._model is None:
            self.load()
        results = self._model.predict(
            source=frame, classes=[0], conf=self.confidence, verbose=False
        )
        result = results[0]
        count = int(len(result.boxes)) if result.boxes is not None else 0
        annotated = result.plot()
        return annotated, count
