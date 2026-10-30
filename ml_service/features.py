import numpy as np
import pandas as pd
from typing import List, Optional


def compute_relative_humidity(air_temp: np.ndarray, dew_temp: np.ndarray) -> np.ndarray:
    dew_clipped = np.minimum(air_temp, dew_temp)
    a = 17.27
    b = 237.7
    alpha = ((a * air_temp) / (b + air_temp))
    beta = ((a * dew_clipped) / (b + dew_clipped))
    rh = 100.0 * np.exp(beta - alpha)
    return np.clip(rh, 0.0, 100.0)


def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if not np.issubdtype(df["timestamp"].dtype, np.datetime64):
        df["timestamp"] = pd.to_datetime(df["timestamp"])

    df["hour"] = df["timestamp"].dt.hour.astype("int8")
    df["dayofweek"] = df["timestamp"].dt.dayofweek.astype("int8")
    df["month"] = df["timestamp"].dt.month.astype("int8")
    df["day"] = df["timestamp"].dt.day.astype("int8")
    df["is_weekend"] = (df["dayofweek"] >= 5).astype("int8")

    df["sin_hour"] = np.sin(2 * np.pi * df["hour"] / 24.0).astype("float32")
    df["cos_hour"] = np.cos(2 * np.pi * df["hour"] / 24.0).astype("float32")

    df["sin_dayofweek"] = np.sin(2 * np.pi * df["dayofweek"] / 7.0).astype("float32")
    df["cos_dayofweek"] = np.cos(2 * np.pi * df["dayofweek"] / 7.0).astype("float32")

    df["sin_month"] = np.sin(2 * np.pi * (df["month"] - 1) / 12.0).astype("float32")
    df["cos_month"] = np.cos(2 * np.pi * (df["month"] - 1) / 12.0).astype("float32")

    return df


def add_building_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "square_feet" in df.columns:
        df["log_square_feet"] = np.log1p(df["square_feet"]).astype("float32")
    if "primary_use" in df.columns:
        df["primary_use_code"] = df["primary_use"].astype("category").cat.codes.astype("int8")
    return df


def add_weather_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "air_temperature" in df.columns and "dew_temperature" in df.columns:
        air_t = df["air_temperature"].values
        dew_t = df["dew_temperature"].values

        df["relative_humidity"] = compute_relative_humidity(air_t, dew_t).astype("float32")
        cdh = np.maximum(0.0, air_t - 18.0)
        df["cooling_degree_hours"] = cdh.astype("float32")
        hdh = np.maximum(0.0, 18.0 - air_t)
        df["heating_degree_hours"] = hdh.astype("float32")
    return df


def add_lag_and_rolling_features(
    df: pd.DataFrame,
    lags: List[int] = [24, 48, 168],
    rolling_windows: List[int] = [24],
    target_col: str = "meter_reading"
) -> pd.DataFrame:
    df = df.copy()
    if target_col in df.columns:
        for lag in lags:
            df[f"lag_{lag}h"] = df[target_col].shift(lag).astype("float32")
        for w in rolling_windows:
            rolled = df[target_col].shift(1).rolling(window=w, min_periods=1)
            df[f"rolling_mean_{w}h"] = rolled.mean().astype("float32")
            df[f"rolling_std_{w}h"] = rolled.std().fillna(0.0).astype("float32")
    return df


def get_feature_columns() -> List[str]:
    return [
        "building_id",
        "log_square_feet",
        "primary_use_code",
        "year_built",
        "floor_count",
        "hour",
        "dayofweek",
        "month",
        "is_weekend",
        "sin_hour",
        "cos_hour",
        "sin_dayofweek",
        "cos_dayofweek",
        "sin_month",
        "cos_month",
        "air_temperature",
        "dew_temperature",
        "wind_speed",
        "relative_humidity",
        "cooling_degree_hours",
        "heating_degree_hours",
        "lag_24h",
        "lag_48h",
        "lag_168h",
        "rolling_mean_24h",
        "rolling_std_24h"
    ]
