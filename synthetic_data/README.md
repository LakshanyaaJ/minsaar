# Synthetic Hall-Level AC Optimization Demo

## Files to upload in the Simulation tab

1. **`synthetic_demo.csv`** — one week of one-minute telemetry for five halls, Sunday 1 November 2026 through Saturday 7 November 2026 inclusive. It contains 50,400 rows (10,080 per hall).
2. **`weekly_schedule.csv`** — the upcoming week’s hall schedule, Sunday 8 November through Saturday 14 November 2026. It includes explicit `CLOSED` rows for Sunday; Tuesday and Friday have explicitly extended/additional hours.

These are the two intended UI uploads. In `weekly_schedule.csv`, `schedule_status=CLOSED` with blank start/end times means no session that day. The other files are validation/adapter helpers for backend integration and testing.

## Support files

- `model1_hourly_input.csv`: the minute data aggregated to one row per hall per hour, retaining the exact feature names required by the anomaly API plus non-feature identifiers for grouping.
- `model2_hourly_history.csv`: the 168 hourly historical readings for each hall, with supporting weather and hall metadata.
- `target_week_weather_forecast.csv`: synthetic hourly weather values for the forecast/schedule week.
- `controller_config.json`: illustrative rule thresholds for the simulation engine (editable demo settings, not a safety-certified HVAC controller).
- `model2_forecast_requests.json`: ready-to-adapt request examples for the existing `/predict/forecast` API, one per hall, each with 168 historical readings and a 168-hour forecast horizon.
- `expected_demo_events.csv`: ground-truth scenario labels for manual/test validation. **Never pass this file into Model 1, Model 2 or the controller as an input feature.**
- `model1_smoke_test_predictions.csv` and `model2_smoke_test_forecast.csv`: preview outputs from actually running the saved artifacts in this environment; use only as reference, not as uploaded inputs.
- `smoke_test_results.md`: smoke-test counts, event-window behavior and runtime warnings.
- `demo_manifest.json`: row counts, schemas and limitations.

## Data meaning and units

- `timestamp`: local naive timestamp. For the demo UI, interpret it as Asia/Kolkata; the file intentionally omits timezone offsets to match the existing model APIs.
- `meter`: `0` means electricity.
- `meter_reading`: **energy consumed during this one-minute interval in kWh** for the hall’s total electrical load (AC plus non-AC loads). It is not an instantaneous kW value.
- `whole_hall_power_kw`: instantaneous synthetic hall electrical power, including AC and non-AC load.
- `ac_power_kw`: instantaneous synthetic AC electrical power only.
- `ac_energy_kwh_min`: AC energy consumed during that one-minute interval.
- `air_temperature`, `dew_temperature`, `wind_speed`, `cloud_coverage`: synthetic outdoor conditions.
- `square_feet`, `year_built`, `floor_count`, `primary_use`, `primary_use_code`: hall-proxy metadata supplied to keep the existing feature contract usable.
- `indoor_temperature_c`, `indoor_relative_humidity_pct`, `occupancy_count`, `observed_ac_on`, `observed_setpoint_c`: additional simulated sensor/control fields. They are **not** features of either saved model.
- `simulated_cooling_effectiveness_pct`: synthetic diagnostic value inserted to demonstrate equipment degradation. It is not sent to either trained model; in a real system, estimate effectiveness from temperature response and power, or supply a validated equipment telemetry signal.

## How the models should receive data

### Model 1 — anomaly detector

The uploaded minute CSV must first be aggregated by `hall_id` into hourly buckets. Sum `meter_reading` over the 60 one-minute records to obtain hourly kWh; average outdoor weather values; use the hour-start timestamp for calendar fields. Then send only these eight numeric columns to the existing model:

`meter_reading, air_temperature, dew_temperature, hour_of_day, day_of_week, month, is_weekend, square_feet`

`timestamp` may be included as optional API context. `hall_id`, `building_id`, `meter`, site/meta fields and indoor/occupancy/AC fields are not model features; they are used for grouping or by the rule engine. The file `model1_hourly_input.csv` demonstrates the correct field set and hourly cadence.

### Model 2 — energy forecaster

The uploaded week produces exactly 168 hourly readings per hall. Send each hall’s ordered timestamps/readings to `POST /predict/forecast`, with that hall’s `building_info` and target-week hourly weather. See `model2_forecast_requests.json` for the request schema used by this package. The forecaster returns hourly predictions; do not pretend those predictions are minute-level.

The actual runtime feature list in `src/features.py` and `artifacts/pipeline_metadata.json` contains **26** features. The prose in the supplied `MODEL_DETAILS.md` that says 22 is inconsistent with the executable feature code and metadata. Use the public inference API/request schema rather than manually assembling a 22-column feature matrix.

## Timeline relationship

The telemetry week is the prior week used for anomaly diagnostics and the forecaster's required 168-hour warm-up. `weekly_schedule.csv` describes the next Sunday-Saturday week and is used for the upcoming schedule/control simulation. The historical `scheduled_open` and `expected_occupancy` columns describe the historical synthetic week; use them when reviewing the embedded historical events. Do not compare the upcoming schedule's calendar dates directly against prior-week telemetry as if the dates were the same.

## Control engine and dashboard interpretation

Use the model outputs as one signal alongside explicit rules:

- outside scheduled time + empty hall + AC on -> propose simulated `OFF` after a configurable grace period;
- occupied hall + indoor temperature above the target/deadband -> propose `ON` or increase inverter modulation if supported;
- indoor temperature inside comfort band -> maintain/reduce modulation or avoid excessive cooling;
- anomaly classification -> create an alert for investigation; do not shut the AC off solely because a row is anomalous;
- temperature failing to approach setpoint despite high power -> create a cooling-performance alert;
- model forecast -> provide hourly demand context, while hall-level energy/cost/savings are calculated by the separate simulation/controller logic.

For simulated savings, compare a baseline policy against the optimized policy under the same schedule, occupancy and weather. Use `₹8/kWh` only as an **editable demo assumption**; it is not a tariff sourced from the dataset. Calculate INR cost from simulated hall-level energy in the controller. The packaged forecast API returns its own cost currency as USD, so the request examples disable that cost estimate (`tariff_per_kwh: null`).

## Known limitations — important

1. Both saved models were trained on **ASHRAE facility/building-level hourly data**, not individual college halls or AC-only submeter data. Aggregating one-minute records into hourly buckets solves the time-resolution mismatch only; it does **not** prove hall-level model accuracy. The actual artifact smoke test is summarized in `smoke_test_results.md`; notably, Model 1 did not flag the injected scenario windows in that run.
2. Model 1 was fit on the raw ASHRAE `meter_reading` values. The package does not normalize all ASHRAE sites to a single physical energy unit in that model pipeline. The demo uses synthetic kWh, so its anomaly output is for integration demonstration and is not a calibrated accuracy claim.
3. Model 2’s predictions when fed hall-level history are **demo-only hall proxies**. For production use, validate/retrain with real hall-level hourly electricity data and correct unit normalization.
4. Synthetic sensor values, weather, occupancy, equipment behavior, anomalies and cost savings are generated for demonstration. Do not describe simulated savings as measured savings.
5. Loading the forecasting artifact in the smoke-test runtime emitted a scikit-learn version warning: the saved objects report 1.9.0, but the runtime is 1.8.0. Inference completed, but use a matching compatible runtime and rerun tests before relying on the result.
6. The `building_id` values in this package are proxy IDs taken from compatible ASHRAE metadata rows. They are not IDs for the user’s actual college, and the hall data is not the original data belonging to those IDs.
7. This is telemetry for a **hall-level product view only**; do not present combined building totals as the product’s target output.

## Validation checklist

- `synthetic_demo.csv`: 50,400 rows; five halls; 10,080 timestamps per hall; no duplicate `(hall_id, timestamp)`; one-minute cadence.
- `model1_hourly_input.csv`: 840 rows; 168 hourly records per hall; exactly eight numerical model features plus timestamp and grouping metadata.
- `model2_forecast_requests.json`: five requests, each with 168 ordered history timestamps/readings and 168 future weather observations; each forecast begins at `2026-11-08 00:00:00`.
- `weekly_schedule.csv`: contains Tuesday and Friday extended sessions; end times are exclusive.
