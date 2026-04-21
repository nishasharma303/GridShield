# GridShield+ 🔋⚡
## Explainable Failure-Aware Renewable Dispatch & Grid Decision Support System

A full-stack ML system for India's regional power grid — predicts renewable failure risk,
explains why, and recommends safe dispatch + backup actions for POSOCO grid operators.

---

## 📁 Complete Project Structure

```
gridshield/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py              ← FastAPI server (all API endpoints)
│   ├── data/                    ← Place all 5 CSVs here (see below)
│   ├── artefacts/               ← Auto-generated after training
│   ├── train_pipeline.py        ← Full data pipeline + model training
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── IndiaRegionMap.jsx     ← Interactive SVG India map
│   │   │   ├── InputPanel.jsx         ← RE inputs + weather auto-fill
│   │   │   ├── RiskCard.jsx           ← Risk level + probability display
│   │   │   ├── DispatchPanel.jsx      ← Safe RE + backup recommendation
│   │   │   ├── DriverExplanation.jsx  ← Top failure drivers (SHAP-based)
│   │   │   ├── CounterfactualPanel.jsx← What-if risk reduction actions
│   │   │   ├── RegionProfileCard.jsx  ← Region stats + monthly chart
│   │   │   └── HistoryChart.jsx       ← Historical RE + stress events
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    ← Main operator screen
│   │   │   ├── Analytics.jsx    ← Model metrics + feature importance
│   │   │   ├── ScenarioLab.jsx  ← Interactive what-if simulator
│   │   │   └── About.jsx        ← Methodology documentation
│   │   ├── utils/
│   │   │   ├── api.js           ← All axios API calls
│   │   │   └── helpers.js       ← Constants, formatters
│   │   ├── App.jsx              ← Router + nav
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── README.md
```

---

## 🗂 Step 1 — Place Your CSV Files

Copy all 5 CSV files into `backend/data/` with these exact names:

```
backend/data/
├── POSOCO_reported_hydro_MU_daily.csv
├── POSOCO_reported_solar_MU_daily.csv
├── POSOCO_reported_wind_MU_daily.csv
├── tabulated-installed-by-date.csv
└── installed-by-state-oct2022.csv
```

---

## 🐍 Step 2 — Backend Setup

```bash
cd gridshield/backend

# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate             # Windows

# Install dependencies
pip install -r requirements.txt
```

### Optional but recommended: XGBoost + SHAP

```bash
pip install xgboost shap
```

---

## 🏋️ Step 3 — Run Training Pipeline

This is the most important step. It:
- Loads all 5 CSVs
- Fetches historical weather from Open-Meteo ERA5 (free, no API key needed)
- Engineers all features (lags, rolling stats, capacity factors, weather interactions)
- Creates GridStressEvent labels (multi-criteria)
- Trains 5 ML models with 5-fold CV
- Saves all artefacts to `backend/artefacts/`

```bash
cd gridshield/backend
python train_pipeline.py
```

**Expected output:**
```
2024-01-01 10:00:00 INFO Loading raw CSV data...
2024-01-01 10:00:01 INFO   Hydro: 2012-04-01 → 2022-10-31 (3866 rows)
2024-01-01 10:00:01 INFO   Solar: 2017-08-01 → 2022-10-31 (1918 rows)
...
2024-01-01 10:00:05 INFO [API] Fetching weather from Open-Meteo (ERA5)...
2024-01-01 10:01:30 INFO   Weather cached to artefacts/weather_cache.parquet
...
2024-01-01 10:04:00 INFO Best model: XGBoost (ROC-AUC=0.87)
2024-01-01 10:04:05 INFO All artefacts saved to: .../backend/artefacts
2024-01-01 10:04:05 INFO Pipeline complete. Run: uvicorn app.main:app --reload
```

⏱ First run: ~3–5 minutes (weather fetch takes ~1 min)
⚡ Subsequent runs: ~2 minutes (weather loaded from cache)

### What gets saved to `artefacts/`:

| File | Used By |
|------|---------|
| `best_model.pkl` | `/api/predict` |
| `scaler.pkl` | Feature normalization |
| `feature_columns.json` | Input validation |
| `region_profiles.json` | `/api/region/<r>` |
| `region_coords.json` | Weather API calls |
| `model_metrics.json` | Analytics page |
| `feature_importance.json` | Feature importance chart |
| `config.json` | System metadata |
| `model_dataset.parquet` | Historical charts |
| `weather_cache.parquet` | Cached ERA5 weather |

---

## 🚀 Step 4 — Start FastAPI Backend

```bash
cd gridshield/backend
source venv/bin/activate

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Test it:**
```bash
curl http://localhost:8000/api/health
```

Expected:
```json
{"status": "ok", "model_loaded": true, "best_model": "XGBoost"}
```

**API docs:**
```
http://localhost:8000/docs      ← Interactive Swagger UI
http://localhost:8000/redoc     ← ReDoc
```

---

## ⚛️ Step 5 — Start React Frontend

Open a new terminal:

```bash
cd gridshield/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

App opens at: **http://localhost:5173**

---

## 🌐 All API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/predict` | Main prediction + dispatch + explanation |
| `GET`  | `/api/region/{region}` | Region profile stats |
| `GET`  | `/api/weather/{region}` | Live weather (Open-Meteo Forecast API) |
| `GET`  | `/api/history/{region}?days=90&fuel=re_total` | Historical time series |
| `GET`  | `/api/metrics` | All model performance metrics |
| `GET`  | `/api/importance?top_n=20` | Feature importance |
| `GET`  | `/api/regions` | All regions with summary |
| `GET`  | `/api/analytics/stress-timeline?days=180` | National stress timeline |
| `GET`  | `/api/analytics/region-heatmap` | Monthly stress heatmap data |
| `GET`  | `/api/health` | Health check |

### Example predict request:
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "region": "SR",
    "solar_MU": 45.0,
    "wind_MU": 60.0,
    "hydro_MU": 150.0,
    "re_cv_7d": 0.28,
    "weather_cloud": 35,
    "weather_temp": 32,
    "weather_wind": 18,
    "weather_precip": 2.5,
    "date": "2024-06-15"
  }'
```

---

## 🏗 Production Build

```bash
# Build frontend
cd gridshield/frontend
npm run build
# Output in frontend/dist/

# Serve with uvicorn (mount static files) or nginx
```

For production, serve React static files from Nginx and proxy `/api` to uvicorn.

---

## ⚠️ Notes

1. **Weather fetch** — Open-Meteo is free and requires no API key. Rate limit: ~10 req/min. The training pipeline respects this with `time.sleep(1)` between regions.

2. **Artefacts are required** — The backend will return 503 if `train_pipeline.py` hasn't been run yet.

3. **Labels are synthetic** — GridStressEvent labels are derived from multi-criteria renewable weakness indicators, not actual SLDC outage records. Clearly documented in the About page.

4. **CORS** — Backend allows all origins during development. Restrict in production.

5. **Port conflicts** — Backend: 8000. Frontend dev server: 5173. Both can be changed.

---

## 🔬 System Capabilities

| Feature | Status |
|---------|--------|
| Region-wise failure risk prediction | ✅ Real ML model |
| Safe dispatch recommendation | ✅ Risk-tiered engine |
| Feature explanation (SHAP/Gini) | ✅ Top 5 drivers per prediction |
| Counterfactual what-if actions | ✅ 4 alternatives per prediction |
| Live weather auto-fill | ✅ Open-Meteo Forecast API |
| Historical RE time series | ✅ From training dataset |
| Model comparison metrics | ✅ 5 models × 5 metrics |
| Monthly stress heatmap | ✅ Region × month matrix |
| Interactive scenario simulator | ✅ Presets + sliders |
| India region SVG map | ✅ Click-to-select, stress-coloured |
| No hardcoded values | ✅ All data from real sources |

---

*GridShield+ — Built for academic and research demonstration. Human operator review required before any operational dispatch action.*
