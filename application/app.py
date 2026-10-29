"""Streamlit dashboard for classroom occupancy counting."""

from __future__ import annotations

import json
import csv
import io
import tempfile
from pathlib import Path

import cv2
import streamlit as st

from application.detector import PersonDetector
from application.video_processor import SUPPORTED_EXTENSIONS, process_video


st.set_page_config(page_title="Classroom Occupancy Counter", layout="wide")
st.title("Classroom Occupancy Counter")
st.caption("YOLO person detection with rolling-median occupancy smoothing.")

uploaded = st.file_uploader("Upload a classroom video", type=["mp4", "avi", "mov"])
with st.sidebar:
    st.header("Processing settings")
    model_path = st.text_input("YOLO weights", "models/yolo11n.pt")
    confidence = st.slider("Detection confidence", 0.0, 1.0, 0.25, 0.05)
    sample_every = st.number_input("Process every Nth frame", min_value=1, value=1)
    window_size = st.number_input("Rolling median window", min_value=1, value=5)
    zero_samples = st.number_input("Zero samples before empty", min_value=1, value=5)

if uploaded is not None and Path(uploaded.name).suffix.lower() not in SUPPORTED_EXTENSIONS:
    st.error("Unsupported file type. Upload an MP4, AVI, or MOV file.")

if uploaded is not None and st.button("Start processing", type="primary"):
    temp_path: Path | None = None
    try:
        suffix = Path(uploaded.name).suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(uploaded.getbuffer())
            temp_path = Path(temp_file.name)

        detector = PersonDetector(model_path, confidence)
        st.info("Loading model and processing frames; first model load may download weights.")
        progress = st.progress(0.0)
        preview = st.empty()
        metrics = st.empty()
        records: list[dict] = []

        def display_sample(frame, record, processed, total):
            records.append(record.as_dict())
            preview.image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), channels="RGB")
            detected_metric, estimate_metric = metrics.columns(2)
            detected_metric.metric("Detected people", record.detected_count)
            estimate_metric.metric("Occupancy estimate", record.occupancy_estimate)
            metrics.write(f"Status: **{record.occupancy_status}**")
            if total:
                progress.progress(min(processed * int(sample_every) / total, 1.0))

        process_video(
            temp_path, detector=detector, sample_every=int(sample_every),
            window_size=int(window_size), zero_confirmation_samples=int(zero_samples),
            on_sample=display_sample,
        )
        progress.progress(1.0)
        st.subheader("Occupancy over time")
        if records:
            st.line_chart(
                {
                    "timestamp_seconds": [record["timestamp_seconds"] for record in records],
                    "occupancy_estimate": [record["occupancy_estimate"] for record in records],
                },
                x="timestamp_seconds",
                y="occupancy_estimate",
            )
            csv_buffer = io.StringIO()
            writer = csv.DictWriter(csv_buffer, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
            st.download_button(
                "Download CSV", csv_buffer.getvalue(), "occupancy.csv", "text/csv"
            )
            st.download_button("Download JSON", json.dumps(records, indent=2), "occupancy.json", "application/json")
        else:
            st.warning("No frames were processed.")
    except (ValueError, FileNotFoundError, RuntimeError, cv2.error) as exc:
        st.error(f"Processing failed: {exc}")
    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)
