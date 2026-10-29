import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional, Union, List

try:
    from .features import (
        add_calendar_features,
        add_building_features,
        add_weather_features,
        get_feature_columns,
    )
except ImportError:
    from features import (
        add_calendar_features,
        add_building_features,
        add_weather_features,
        get_feature_columns,
    )

SUPPORTED_HORIZONS = {
    "2H": 2,
    "24H": 24,
    "3D": 72,
    "7D": 168,
}
MAX_HORIZON_HOURS = 168


class MultiHorizonForecaster:
    def __init__(self, model_path: Path, metadata_path: Optional[Path] = None):
        self.model_path = model_path
        self.metadata_path = metadata_path
        self.model = None
        self.feature_columns = None
        self.load_artifacts()

    def load_artifacts(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model artifact not found at {self.model_path}")
        self.model = joblib.load(self.model_path)

        if self.metadata_path and self.metadata_path.exists():
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                self.feature_columns = meta.get("feature_columns", get_feature_columns())
        else:
            self.feature_columns = get_feature_columns()

    def validate_horizon(self, horizon: Union[str, int]) -> int:
        if isinstance(horizon, str):
            horizon_upper = horizon.strip().upper()
            if horizon_upper in SUPPORTED_HORIZONS:
                return SUPPORTED_HORIZONS[horizon_upper]
            try:
                horizon_int = int(horizon_upper.rstrip("H").rstrip("D"))
                if horizon_upper.endswith("D"):
                    horizon_int *= 24
                return horizon_int
            except ValueError:
                raise ValueError(
                    f"Invalid horizon '{horizon}'. Supported presets: {list(SUPPORTED_HORIZONS.keys())} or int hours (1 to 168)."
                )
        elif isinstance(horizon, (int, np.integer)):
            if horizon < 1:
                raise ValueError(f"Horizon must be >= 1 hour, got {horizon}.")
            if horizon > MAX_HORIZON_HOURS:
                raise ValueError(
                    f"Requested horizon {horizon}h exceeds maximum supported horizon of {MAX_HORIZON_HOURS}h (7 days)."
                )
            return int(horizon)
        else:
            raise TypeError(f"Unsupported horizon type: {type(horizon)}")

    def forecast(
        self,
        building_id: int,
        start_time: Union[str, pd.Timestamp],
        horizon: Union[str, int],
        historical_readings: pd.Series,
        building_info: Dict[str, Any],
        weather_forecast: Optional[pd.DataFrame] = None,
        tariff_per_kwh: Optional[float] = None,
        hall_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        horizon_hours = self.validate_horizon(horizon)
        start_dt = pd.to_datetime(start_time)
        forecast_timestamps = pd.date_range(start=start_dt, periods=horizon_hours, freq="1h")

        if len(historical_readings) < 168:
            raise ValueError(
                f"Historical readings buffer must contain at least 168 hours prior to start_time (got {len(historical_readings)})."
            )

        buffer = {ts: val for ts, val in historical_readings.items()}
        predictions = []

        for step_idx, cur_time in enumerate(forecast_timestamps, start=1):
            row = {
                "timestamp": cur_time,
                "building_id": building_id,
                "log_square_feet": np.log1p(building_info.get("square_feet", 50000)),
                "primary_use_code": building_info.get("primary_use_code", 0),
                "year_built": building_info.get("year_built", 1970.0),
                "floor_count": building_info.get("floor_count", 3.0),
            }

            if weather_forecast is not None and not weather_forecast.empty:
                w_match = weather_forecast[weather_forecast["timestamp"] == cur_time]
                if not w_match.empty:
                    w_row = w_match.iloc[0]
                    row["air_temperature"] = float(w_row.get("air_temperature", 20.0))
                    row["dew_temperature"] = float(w_row.get("dew_temperature", 12.0))
                    row["wind_speed"] = float(w_row.get("wind_speed", 3.0))
                else:
                    row["air_temperature"] = 20.0
                    row["dew_temperature"] = 12.0
                    row["wind_speed"] = 3.0
            else:
                row["air_temperature"] = 20.0
                row["dew_temperature"] = 12.0
                row["wind_speed"] = 3.0

            row_df = pd.DataFrame([row])
            row_df = add_calendar_features(row_df)
            row_df = add_weather_features(row_df)

            lag_24_ts = cur_time - pd.Timedelta(hours=24)
            lag_48_ts = cur_time - pd.Timedelta(hours=48)
            lag_168_ts = cur_time - pd.Timedelta(hours=168)

            val_24h = buffer.get(lag_24_ts, np.nan)
            val_48h = buffer.get(lag_48_ts, val_24h)
            val_168h = buffer.get(lag_168_ts, val_24h)

            past_window_vals = [
                buffer.get(lag_24_ts - pd.Timedelta(hours=i), val_24h)
                for i in range(24)
            ]
            past_window_vals = [v for v in past_window_vals if not np.isnan(v)]
            rolling_mean_24h = float(np.mean(past_window_vals)) if past_window_vals else val_24h
            rolling_std_24h = float(np.std(past_window_vals)) if past_window_vals else 0.0

            row_df["lag_24h"] = np.float32(val_24h)
            row_df["lag_48h"] = np.float32(val_48h)
            row_df["lag_168h"] = np.float32(val_168h)
            row_df["rolling_mean_24h"] = np.float32(rolling_mean_24h)
            row_df["rolling_std_24h"] = np.float32(rolling_std_24h)

            X = row_df[self.feature_columns]
            pred_log = self.model.predict(X)[0]
            pred_kwh = float(np.maximum(0.0, np.expm1(pred_log)))

            buffer[cur_time] = pred_kwh

            predictions.append({
                "timestamp": str(cur_time),
                "forecast_hour": step_idx,
                "predicted_kwh": round(pred_kwh, 2)
            })

        pred_df = pd.DataFrame(predictions)
        total_energy_kwh = round(float(pred_df["predicted_kwh"].sum()), 2)

        daily_breakdown = None
        if horizon_hours >= 24:
            pred_df["date"] = pd.to_datetime(pred_df["timestamp"]).dt.strftime("%Y-%m-%d")
            daily_series = pred_df.groupby("date")["predicted_kwh"].agg(["sum", "mean", "min", "max"])
            daily_breakdown = [
                {
                    "date": date_str,
                    "total_kwh": round(row["sum"], 2),
                    "mean_hourly_kwh": round(row["mean"], 2),
                    "min_kwh": round(row["min"], 2),
                    "max_kwh": round(row["max"], 2)
                }
                for date_str, row in daily_series.iterrows()
            ]
            pred_df = pred_df.drop(columns=["date"])

        cost_estimate = None
        if tariff_per_kwh is not None:
            cost_estimate = {
                "tariff_rate": tariff_per_kwh,
                "currency": "INR",
                "total_cost": round(total_energy_kwh * tariff_per_kwh, 2)
            }

        return {
            "forecast_start": str(start_dt),
            "forecast_end": str(forecast_timestamps[-1]),
            "horizon_hours": horizon_hours,
            "building_id": building_id,
            "hall_id": hall_id,
            "units": "kWh",
            "total_predicted_energy_kwh": total_energy_kwh,
            "hourly_predictions": pred_df.to_dict(orient="records"),
            "daily_breakdown": daily_breakdown,
            "cost_estimate": cost_estimate,
            "model_version": "HistGradientBoosting-v1.0"
        }
