from typing import List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class AnomalyReading(BaseModel):
    meter_reading: float = Field(..., description="Electricity consumption in kWh")
    air_temperature: float = Field(..., description="Outdoor dry-bulb temperature in Celsius")
    dew_temperature: float = Field(..., description="Outdoor dew-point temperature in Celsius")
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Sun, 6=Sat or 0=Mon, 6=Sun)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    is_weekend: int = Field(..., ge=0, le=1, description="Weekend flag (0 or 1)")
    square_feet: float = Field(..., gt=0, description="Hall or building floor area in sq ft")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of reading")
    hall_id: Optional[str] = Field(None, description="Optional hall identifier")


class AnomalyDetectRequest(BaseModel):
    readings: List[AnomalyReading] = Field(..., description="List of hourly readings to evaluate")

    @field_validator("readings")
    @classmethod
    def validate_not_empty(cls, v):
        if not v:
            raise ValueError("Readings array cannot be empty")
        if len(v) > 20000:
            raise ValueError("Maximum 20,000 readings per request")
        return v


class AnomalyResultItem(BaseModel):
    timestamp: Optional[str] = None
    hall_id: Optional[str] = None
    meter_reading: float
    prediction: int  # 1: normal, -1: anomaly
    status: str  # "Normal" or "Anomaly"
    is_anomaly: bool
    anomaly_score: float


class AnomalyDetectResponse(BaseModel):
    total_readings: int
    anomaly_count: int
    anomaly_percentage: float
    model_version: str = "IsolationForest-v1.0"
    source: str = "simulated_proxy"
    disclaimer: str = (
        "Model 1 was trained on ASHRAE building-level data. "
        "Hall-level outputs are uncalibrated simulation proxies for integration demonstration."
    )
    results: List[AnomalyResultItem]


class BuildingInfoSchema(BaseModel):
    square_feet: int = Field(50000, ge=100, description="Gross floor area in square feet")
    primary_use_code: int = Field(0, ge=0, le=15, description="Categorical code for building primary use")
    year_built: Optional[float] = Field(1970.0, ge=1800, le=2026, description="Construction year")
    floor_count: Optional[float] = Field(3.0, ge=1, le=100, description="Number of stories")


class WeatherObservationSchema(BaseModel):
    timestamp: str = Field(..., description="Timestamp in ISO/string format YYYY-MM-DD HH:MM:SS")
    air_temperature: float = Field(20.0, ge=-50.0, le=60.0, description="Dry-bulb temperature in Celsius")
    dew_temperature: float = Field(12.0, ge=-50.0, le=60.0, description="Dew-point temperature in Celsius")
    wind_speed: float = Field(3.0, ge=0.0, le=50.0, description="Wind speed in m/s")


class ForecastRequest(BaseModel):
    building_id: int = Field(0, ge=0, description="Target building ID proxy")
    hall_id: Optional[str] = Field(None, description="Target hall identifier")
    forecast_start: str = Field(..., description="Forecast start timestamp (e.g. '2026-11-08 00:00:00')")
    horizon: Union[str, int] = Field("24H", description="Forecast horizon ('2H', '24H', '3D', '7D', or int hours <= 168)")
    historical_timestamps: List[str] = Field(..., description="List of timestamps for historical readings (min 168 hours)")
    historical_readings: List[float] = Field(..., description="List of historical electricity readings in kWh (min 168 values)")
    building_info: BuildingInfoSchema = Field(default_factory=BuildingInfoSchema)
    weather_forecast: Optional[List[WeatherObservationSchema]] = Field(None, description="Optional weather forecast")
    tariff_per_kwh: Optional[float] = Field(None, ge=0.0, description="Tariff rate in $/kWh or INR/kWh")

    @field_validator("historical_readings")
    @classmethod
    def check_history_length(cls, v):
        if len(v) < 168:
            raise ValueError(f"At least 168 historical hourly observations required for lag features, got {len(v)}.")
        return v


class HourlyPredictionItem(BaseModel):
    timestamp: str
    forecast_hour: int
    predicted_kwh: float


class DailySummaryItem(BaseModel):
    date: str
    total_kwh: float
    mean_hourly_kwh: float
    min_kwh: float
    max_kwh: float


class CostEstimateSchema(BaseModel):
    tariff_rate: float
    currency: str
    total_cost: float


class ForecastResponse(BaseModel):
    forecast_start: str
    forecast_end: str
    horizon_hours: int
    building_id: int
    hall_id: Optional[str] = None
    units: str = "kWh"
    total_predicted_energy_kwh: float
    hourly_predictions: List[HourlyPredictionItem]
    daily_breakdown: Optional[List[DailySummaryItem]] = None
    cost_estimate: Optional[CostEstimateSchema] = None
    model_version: str = "HistGradientBoosting-v1.0"
    source: str = "simulated_proxy"
    disclaimer: str = (
        "Predictions represent building-level model outputs applied to hall-level history. "
        "Outputs are uncalibrated simulation proxies for integration demonstration."
    )
