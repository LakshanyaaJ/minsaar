# Minsaar ML Inference Service (`minsaar-ml`)

High-performance Python FastAPI microservice providing real-time inference for Minsaar's AI-powered AC optimization system.

## Models Integrated

### Model 1: Electricity Usage Anomaly Detection
- **Algorithm**: scikit-learn `Pipeline` (`SimpleImputer` + `StandardScaler` + `IsolationForest(n_estimators=100, contamination=0.05)`)
- **Trained Artifact**: `anamoly/models/isolation_forest.joblib`
- **Features (Strict 8-feature order)**:
  1. `meter_reading` (Hourly energy in kWh)
  2. `air_temperature` (Dry-bulb temperature in °C)
  3. `dew_temperature` (Dew-point temperature in °C)
  4. `hour_of_day` (0–23)
  5. `day_of_week` (0–6)
  6. `month` (1–12)
  7. `is_weekend` (0 or 1)
  8. `square_feet` (Area in sq ft)
- **Output**:
  - `prediction`: `1` (Normal) or `-1` (Anomaly)
  - `status`: `"Normal"` or `"Anomaly"`
  - `anomaly_score`: Raw `decision_function` score

### Model 2: Multi-Horizon Energy Forecasting
- **Algorithm**: `HistGradientBoostingRegressor`
- **Trained Artifact**: `energy_prediction/artifacts/forecast_model.joblib`
- **Metadata**: `energy_prediction/artifacts/pipeline_metadata.json`
- **Engine**: Recursive roll-forward multi-horizon forecasting (supports 2H, 24H, 3D, 7D or custom hour horizons up to 168 hours).
- **Requirements**: At least 168 hours of sequential hourly historical observations for lag feature calculations (`lag_24h`, `lag_48h`, `lag_168h`, `rolling_mean_24h`, `rolling_std_24h`).
- **Output**: Hourly predicted kWh energy, daily summaries, and optional cost estimation.

## API Endpoints

- `GET /health`: Health status and artifact readiness.
- `POST /predict/anomaly`: Batch anomaly detection.
- `POST /predict/forecast`: Multi-horizon energy forecasting.

## Running Locally

```bash
cd minsaar/ml_service
pip install -r requirements.txt
python main.py
```
The service will start on port `5001`.
