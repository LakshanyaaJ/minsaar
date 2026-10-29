# Classroom Occupancy Counter

This project detects visible people in uploaded classroom videos using a
pretrained Ultralytics YOLO model and estimates occupancy with a rolling median.
The dashboard does not require pandas; CSV output uses Python's standard
library, which is useful on Windows systems where pandas native DLL loading
may be restricted by application-control policy.
It does not implement AC control, energy prediction, weather analysis, or
unique-person tracking.

## Run on Windows

```powershell
py -m venv C:\venvs\people_count
C:\venvs\people_count\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m streamlit run app.py
pytest
```

The virtual environment is intentionally outside the OneDrive workspace.
Windows Application Control policies can block native PyTorch DLLs when they
are installed under synchronized or restricted folders. If a different Python
installation is used, replace the interpreter path in the first command.
From the project directory, install and run with the external environment:

```powershell
C:\venvs\people_count\Scripts\python.exe -m pip install -r requirements.txt
C:\venvs\people_count\Scripts\python.exe -m streamlit run app.py
C:\venvs\people_count\Scripts\python.exe -m pytest
```

Using `python -m streamlit` also avoids a blocked generated `streamlit.exe`
launcher. Ultralytics downloads `yolo11n.pt` through its standard model
mechanism on first use; set another weights path in the sidebar when needed.

## Reusable interface

```python
from video_processor import process_video

records = process_video("classroom.mp4", sample_every=2)
```

`process_video` reads frames incrementally, releases OpenCV resources, and
returns one record per sampled frame. Each record has:

| Field | Meaning |
|---|---|
| `timestamp_seconds` | Source-video timestamp derived from frame index and FPS |
| `detected_count` | Visible COCO person detections in this frame |
| `occupancy_estimate` | Rolling median estimate, integer |
| `occupancy_status` | `occupied`, `possibly empty`, or confirmed `empty` |
| `is_empty` | True only after the configured consecutive zero threshold |

The default five-sample rolling median reduces occasional missed detections,
but can delay recognition of genuine arrivals and departures. A single
zero-detection frame never confirms an empty room. Counts are visible people
per frame, not unique people seen over the whole video; no tracked IDs are
added together.

The Streamlit dashboard provides annotated previews, progress, current counts,
an estimate chart, and CSV/JSON downloads. Invalid formats, unreadable videos,
and model-loading errors are reported in the UI.
