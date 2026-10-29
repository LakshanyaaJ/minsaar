import os
import sys
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# Ensure package imports resolve
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from .schemas import (
        AnomalyDetectRequest,
        AnomalyDetectResponse,
        AnomalyResultItem,
        ForecastRequest,
        ForecastResponse,
    )
    from .forecaster import MultiHorizonForecaster
except ImportError:
    from schemas import (
        AnomalyDetectRequest,
        AnomalyDetectResponse,
        AnomalyResultItem,
        ForecastRequest,
        ForecastResponse,
    )
    from forecaster import MultiHorizonForecaster

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("minsaar-ml")

app = FastAPI(
    title="Minsaar ML Inference Service",
    description="Unified ML inference service for Anomaly Detection (Model 1) and Energy Forecasting (Model 2)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = CURRENT_DIR.parent.parent

# Model Artifact Locations - prioritizes minsaar/ml_service/models/ so external folders are not required
def resolve_model_path(env_var: str, filename: str) -> Path:
    env_val = os.environ.get(env_var)
    if env_val and Path(env_val).exists():
        return Path(env_val)
    candidates = [
        CURRENT_DIR / "models" / filename,
        Path("/models") / filename,
        CURRENT_DIR.parent / "models" / filename,
        ROOT_DIR / "anamoly" / "models" / filename,
        ROOT_DIR / "energy_prediction" / "artifacts" / filename,
    ]
    for c in candidates:
        if c.exists():
            return c
    return CURRENT_DIR / "models" / filename

ANOMALY_MODEL_PATH = resolve_model_path("ANOMALY_MODEL_PATH", "isolation_forest.joblib")
FORECAST_MODEL_PATH = resolve_model_path("FORECAST_MODEL_PATH", "forecast_model.joblib")
FORECAST_META_PATH = resolve_model_path("FORECAST_META_PATH", "pipeline_metadata.json")

anomaly_pipeline = None
anomaly_load_error = None
forecaster = None
forecast_load_error = None

# Model 1 exact feature order
MODEL1_FEATURES = [
    "meter_reading",
    "air_temperature",
    "dew_temperature",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "square_feet",
]


@app.on_event("startup")
def load_models():
    global anomaly_pipeline, anomaly_load_error, forecaster, forecast_load_error

    # 1. Load Model 1 (Anomaly Detection)
    try:
        if ANOMALY_MODEL_PATH.exists():
            anomaly_pipeline = joblib.load(ANOMALY_MODEL_PATH)
            logger.info("Model 1 (Isolation Forest) loaded successfully from %s", ANOMALY_MODEL_PATH)
        else:
            anomaly_load_error = f"Artifact not found at {ANOMALY_MODEL_PATH}"
            logger.warning(anomaly_load_error)
    except Exception as exc:
        anomaly_load_error = f"Failed to load Model 1: {exc}"
        logger.exception("Error loading Model 1")

    # 2. Load Model 2 (Forecasting)
    try:
        if FORECAST_MODEL_PATH.exists():
            forecaster = MultiHorizonForecaster(model_path=FORECAST_MODEL_PATH, metadata_path=FORECAST_META_PATH)
            logger.info("Model 2 (MultiHorizonForecaster) loaded successfully from %s", FORECAST_MODEL_PATH)
        else:
            forecast_load_error = f"Artifact not found at {FORECAST_MODEL_PATH}"
            logger.warning(forecast_load_error)
    except Exception as exc:
        forecast_load_error = f"Failed to load Model 2: {exc}"
        logger.exception("Error loading Model 2")


@app.get("/health", tags=["Health"])
def health_check():
    m1_ready = anomaly_pipeline is not None
    m2_ready = forecaster is not None
    is_healthy = m1_ready and m2_ready

    return {
        "status": "healthy" if is_healthy else ("degraded" if (m1_ready or m2_ready) else "unhealthy"),
        "models": {
            "model1_anomaly": {
                "loaded": m1_ready,
                "artifact": str(ANOMALY_MODEL_PATH),
                "error": anomaly_load_error,
                "features": MODEL1_FEATURES,
            },
            "model2_forecaster": {
                "loaded": m2_ready,
                "artifact": str(FORECAST_MODEL_PATH),
                "error": forecast_load_error,
            },
        },
    }


@app.post("/predict/anomaly", response_model=AnomalyDetectResponse, tags=["Inference"])
def detect_anomalies(request: AnomalyDetectRequest):
    if anomaly_pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model 1 (Anomaly Detection) is unavailable: {anomaly_load_error}",
        )

    readings = request.readings
    records = []
    metadata = []

    for r in readings:
        records.append({
            "meter_reading": r.meter_reading,
            "air_temperature": r.air_temperature,
            "dew_temperature": r.dew_temperature,
            "hour_of_day": r.hour_of_day,
            "day_of_week": r.day_of_week,
            "month": r.month,
            "is_weekend": r.is_weekend,
            "square_feet": r.square_feet,
        })
        metadata.append({"timestamp": r.timestamp, "hall_id": r.hall_id, "meter_reading": r.meter_reading})

    df = pd.DataFrame(records, columns=MODEL1_FEATURES)

    try:
        preds = anomaly_pipeline.predict(df)
        scores = anomaly_pipeline.decision_function(df)
    except Exception as exc:
        logger.exception("Inference failed for anomaly detection")
        raise HTTPException(status_code=500, detail=f"Inference failure: {exc}")

    results = []
    anomaly_count = 0
    total = len(preds)

    for meta, pred, score in zip(metadata, preds, scores, strict=True):
        pred_int = int(pred)
        is_anom = pred_int == -1
        if is_anom:
            anomaly_count += 1
        results.append(
            AnomalyResultItem(
                timestamp=meta["timestamp"],
                hall_id=meta["hall_id"],
                meter_reading=float(meta["meter_reading"]),
                prediction=pred_int,
                status="Anomaly" if is_anom else "Normal",
                is_anomaly=is_anom,
                anomaly_score=float(score),
            )
        )

    return AnomalyDetectResponse(
        total_readings=total,
        anomaly_count=anomaly_count,
        anomaly_percentage=round((anomaly_count / max(1, total)) * 100, 2),
        model_version="IsolationForest-v1.0",
        source="simulated_proxy",
        results=results,
    )


@app.post("/predict/forecast", response_model=ForecastResponse, tags=["Inference"])
def generate_forecast(request: ForecastRequest):
    if forecaster is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model 2 (Forecasting) is unavailable: {forecast_load_error}",
        )

    try:
        hist_ts = pd.to_datetime(request.historical_timestamps)
        hist_series = pd.Series(data=request.historical_readings, index=hist_ts)

        weather_df = None
        if request.weather_forecast:
            weather_records = [w.model_dump() for w in request.weather_forecast]
            weather_df = pd.DataFrame(weather_records)
            weather_df["timestamp"] = pd.to_datetime(weather_df["timestamp"])

        b_info = request.building_info.model_dump()

        raw_res = forecaster.forecast(
            building_id=request.building_id,
            start_time=request.forecast_start,
            horizon=request.horizon,
            historical_readings=hist_series,
            building_info=b_info,
            weather_forecast=weather_df,
            tariff_per_kwh=request.tariff_per_kwh,
            hall_id=request.hall_id,
        )

        return ForecastResponse(**raw_res)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.exception("Inference failed for energy forecast")
        raise HTTPException(status_code=500, detail=f"Forecasting failure: {exc}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "5001")))
