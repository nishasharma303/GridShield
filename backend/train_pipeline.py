"""
GridShield+ — Data Pipeline & Model Training
============================================
Run this ONCE to preprocess data, engineer features, train all models,
and save all artefacts to backend/artefacts/.

Usage:
    python train_pipeline.py

Requirements:
    - Place all 5 CSV files in backend/data/
    - pip install -r requirements.txt
"""

import os, json, time, warnings, logging
import numpy as np
import pandas as pd
import joblib
import requests
from pathlib import Path

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score,
    precision_score, recall_score, classification_report, confusion_matrix
)
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    log.warning("XGBoost not found, skipping.")

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    log.warning("SHAP not found, using built-in importance.")

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
DATA_DIR      = BASE_DIR / "data"
ARTEFACT_DIR  = BASE_DIR / "artefacts"
ARTEFACT_DIR.mkdir(exist_ok=True)

REGIONS = ['NR', 'WR', 'SR', 'ER', 'NER']

REGION_COORDS = {
    'NR':  {'lat': 28.7041, 'lon': 77.1025, 'label': 'North Region'},
    'WR':  {'lat': 21.1458, 'lon': 79.0882, 'label': 'West Region'},
    'SR':  {'lat': 15.3173, 'lon': 75.7139, 'label': 'South Region'},
    'ER':  {'lat': 22.5726, 'lon': 88.3639, 'label': 'East Region'},
    'NER': {'lat': 26.2006, 'lon': 92.9376, 'label': 'North-East Region'},
}

# ─── JSON Serialization Helper ───────────────────────────────────────────────
def to_serializable(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(i) for i in obj]
    elif isinstance(obj, tuple):
        return tuple(to_serializable(i) for i in obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, pd.Timestamp):
        return str(obj)
    return obj

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: LOAD RAW DATA
# ═══════════════════════════════════════════════════════════════════════════════

def load_raw_data():
    log.info("Loading raw CSV data...")
    hydro    = pd.read_csv(DATA_DIR / "POSOCO_reported_hydro_MU_daily.csv",  parse_dates=['Date'])
    solar    = pd.read_csv(DATA_DIR / "POSOCO_reported_solar_MU_daily.csv",  parse_dates=['Date'])
    wind     = pd.read_csv(DATA_DIR / "POSOCO_reported_wind_MU_daily.csv",   parse_dates=['Date'])
    cap_dt   = pd.read_csv(DATA_DIR / "tabulated-installed-by-date.csv")
    cap_st   = pd.read_csv(DATA_DIR / "installed-by-state-oct2022.csv")

    # Rename region columns with prefix
    def _rename(df, prefix):
        rename_map = {r: f'{prefix}_{r}' for r in REGIONS}
        rename_map['Total'] = f'{prefix}_Total'
        return df.rename(columns=rename_map)

    hydro = _rename(hydro, 'hydro')
    solar = _rename(solar, 'solar')
    wind  = _rename(wind,  'wind')

    # Fix known null: wind Total on 2017-10-12
    mask = wind['wind_Total'].isna()
    wind.loc[mask, 'wind_Total'] = wind.loc[mask, [f'wind_{r}' for r in REGIONS]].sum(axis=1)

    log.info(f"  Hydro: {hydro.Date.min().date()} → {hydro.Date.max().date()} ({len(hydro)} rows)")
    log.info(f"  Solar: {solar.Date.min().date()} → {solar.Date.max().date()} ({len(solar)} rows)")
    log.info(f"  Wind : {wind.Date.min().date()} → {wind.Date.max().date()} ({len(wind)} rows)")

    return hydro, solar, wind, cap_dt, cap_st


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: MERGE & ALIGN
# ═══════════════════════════════════════════════════════════════════════════════

def merge_and_align(hydro, solar, wind, cap_dt):
    log.info("Merging datasets and aligning on solar date range (2017-08-01+)...")

    hw     = pd.merge(hydro, wind, on='Date', how='inner')
    master = pd.merge(hw, solar, on='Date', how='inner')
    master = master.sort_values('Date').reset_index(drop=True)

    # ── Capacity timeline ──────────────────────────────────────────────────────
    cap_dt = cap_dt.rename(columns={'Unnamed: 0': 'date_str'}).dropna(subset=['date_str'])
    cap_dt['date'] = pd.to_datetime(cap_dt['date_str'], dayfirst=True, errors='coerce')
    cap_dt = cap_dt.dropna(subset=['date']).sort_values('date').reset_index(drop=True)
    for c in ['Hydro', 'Small Hydro', 'Wind', 'Solar']:
        cap_dt[c] = pd.to_numeric(cap_dt[c], errors='coerce')

    cap_dt['cap_hydro_MW'] = cap_dt['Hydro'] + cap_dt['Small Hydro']
    cap_dt['cap_wind_MW']  = cap_dt['Wind']
    cap_dt['cap_solar_MW'] = cap_dt['Solar']

    all_dates = pd.DataFrame({'Date': pd.date_range(master.Date.min(), master.Date.max(), freq='D')})
    cap_daily = pd.merge_asof(
        all_dates.sort_values('Date'),
        cap_dt[['date', 'cap_hydro_MW', 'cap_wind_MW', 'cap_solar_MW']].rename(columns={'date': 'Date'}),
        on='Date', direction='backward'
    )

    master = pd.merge(master, cap_daily, on='Date', how='left')

    # ── National capacity factors ───────────────────────────────────────────────
    master['cf_hydro_national'] = (master['hydro_Total'] * 1000) / (master['cap_hydro_MW'] * 24)
    master['cf_wind_national']  = (master['wind_Total']  * 1000) / (master['cap_wind_MW']  * 24)
    master['cf_solar_national'] = (master['solar_Total'] * 1000) / (master['cap_solar_MW'] * 24)

    # ── Regional RE totals ─────────────────────────────────────────────────────
    for r in REGIONS:
        master[f're_total_{r}'] = master[f'solar_{r}'] + master[f'wind_{r}'] + master[f'hydro_{r}']
    master['re_total_national'] = master['solar_Total'] + master['wind_Total'] + master['hydro_Total']

    log.info(f"  Master shape: {master.shape} | {master.Date.min().date()} → {master.Date.max().date()}")
    return master


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: WEATHER FETCH (Open-Meteo Historical Archive — Free, No API Key)
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_region_weather(lat, lon, start_date, end_date, retries=3):
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        'latitude': lat, 'longitude': lon,
        'start_date': str(start_date)[:10],
        'end_date':   str(end_date)[:10],
        'daily': 'temperature_2m_mean,precipitation_sum,windspeed_10m_max,cloudcover_mean',
        'timezone': 'Asia/Kolkata'
    }
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=45)
            r.raise_for_status()
            data = r.json()['daily']
            df = pd.DataFrame(data)
            df['time'] = pd.to_datetime(df['time'])
            return df.rename(columns={'time': 'Date'})
        except Exception as e:
            log.warning(f"  Attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)
    return None


def load_or_fetch_weather(master):
    cache = ARTEFACT_DIR / "weather_cache.parquet"
    if cache.exists():
        log.info("Loading weather from cache...")
        return pd.read_parquet(cache)

    log.info("Fetching historical weather from Open-Meteo (ERA5)...")
    start, end = master['Date'].min(), master['Date'].max()
    frames = []

    for region, coords in REGION_COORDS.items():
        log.info(f"  Fetching {region} ({coords['label']})...")
        wdf = fetch_region_weather(coords['lat'], coords['lon'], start, end)
        if wdf is not None:
            wdf = wdf.rename(columns={
                'temperature_2m_mean': f'weather_temp_{region}',
                'precipitation_sum':   f'weather_precip_{region}',
                'windspeed_10m_max':   f'weather_wind_{region}',
                'cloudcover_mean':     f'weather_cloud_{region}',
            })
            frames.append(wdf)
            time.sleep(1)

    weather_wide = frames[0]
    for df in frames[1:]:
        weather_wide = pd.merge(weather_wide, df, on='Date', how='outer')

    weather_wide = weather_wide.sort_values('Date').reset_index(drop=True)
    weather_wide.to_parquet(cache, index=False)
    log.info(f"  Weather cached to {cache} | shape: {weather_wide.shape}")
    return weather_wide


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: MELT TO LONG FORMAT
# ═══════════════════════════════════════════════════════════════════════════════

def melt_to_long(master, weather_df):
    log.info("Melting to long format (Date × Region)...")
    master = pd.merge(master, weather_df, on='Date', how='left')
    rows = []
    for _, day in master.iterrows():
        for r in REGIONS:
            row = {
                'Date': day['Date'], 'Region': r,
                'solar_MU':  day[f'solar_{r}'],
                'wind_MU':   day[f'wind_{r}'],
                'hydro_MU':  day[f'hydro_{r}'],
                're_total_MU': day[f're_total_{r}'],
                'solar_national': day['solar_Total'],
                'wind_national':  day['wind_Total'],
                'hydro_national': day['hydro_Total'],
                're_national':    day['re_total_national'],
                'cf_hydro_national': day['cf_hydro_national'],
                'cf_wind_national':  day['cf_wind_national'],
                'cf_solar_national': day['cf_solar_national'],
                'cap_hydro_MW': day['cap_hydro_MW'],
                'cap_wind_MW':  day['cap_wind_MW'],
                'cap_solar_MW': day['cap_solar_MW'],
                'weather_temp':  day.get(f'weather_temp_{r}', np.nan),
                'weather_precip':day.get(f'weather_precip_{r}', np.nan),
                'weather_wind':  day.get(f'weather_wind_{r}', np.nan),
                'weather_cloud': day.get(f'weather_cloud_{r}', np.nan),
            }
            rows.append(row)

    long_df = pd.DataFrame(rows).sort_values(['Region', 'Date']).reset_index(drop=True)
    log.info(f"  Long format shape: {long_df.shape}")
    return long_df


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: FEATURE ENGINEERING (per region)
# ═══════════════════════════════════════════════════════════════════════════════

def engineer_features_region(df):
    df = df.copy().sort_values('Date').reset_index(drop=True)

    # ── Temporal ──────────────────────────────────────────────────────────────
    df['month']        = df['Date'].dt.month
    df['dayofweek']    = df['Date'].dt.dayofweek
    df['dayofyear']    = df['Date'].dt.dayofyear
    df['quarter']      = df['Date'].dt.quarter
    df['year']         = df['Date'].dt.year
    df['month_sin']    = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos']    = np.cos(2 * np.pi * df['month'] / 12)
    df['dow_sin']      = np.sin(2 * np.pi * df['dayofweek'] / 7)
    df['dow_cos']      = np.cos(2 * np.pi * df['dayofweek'] / 7)
    df['is_monsoon']    = df['month'].between(6, 9).astype(int)
    df['is_solar_peak'] = df['month'].isin([10,11,12,1,2,3]).astype(int)
    df['is_wind_season']= df['month'].between(5, 9).astype(int)

    # ── Lags ──────────────────────────────────────────────────────────────────
    for fuel, col in [('solar','solar_MU'),('wind','wind_MU'),('hydro','hydro_MU'),('re','re_total_MU')]:
        for lag in [1, 3, 7, 14, 30]:
            df[f'{fuel}_lag{lag}'] = df[col].shift(lag)

    # ── Rolling stats (REDUCED: only mean and std) ───────────────────────────
    for fuel, col in [('solar','solar_MU'),('wind','wind_MU'),('hydro','hydro_MU'),('re','re_total_MU')]:
        for win in [7, 14, 30]:
            roll = df[col].shift(1).rolling(win, min_periods=max(1, win//2))
            df[f'{fuel}_roll_mean_{win}'] = roll.mean()
            df[f'{fuel}_roll_std_{win}']  = roll.std()

    # ── Volatility ────────────────────────────────────────────────────────────
    for fuel, col in [('solar','solar_MU'),('wind','wind_MU'),('hydro','hydro_MU'),('re','re_total_MU')]:
        df[f'{fuel}_delta_1d']      = df[col].diff(1)
        df[f'{fuel}_pct_change_1d'] = df[col].pct_change(1).replace([np.inf,-np.inf], np.nan)

    roll7 = df['re_total_MU'].shift(1).rolling(7, min_periods=3)
    df['re_cv_7d'] = roll7.std() / (roll7.mean() + 1e-6)

    # ── Ratio features ────────────────────────────────────────────────────────
    df['solar_share']     = df['solar_MU'] / (df['re_total_MU'] + 1e-6)
    df['wind_share']      = df['wind_MU']  / (df['re_total_MU'] + 1e-6)
    df['hydro_share']     = df['hydro_MU'] / (df['re_total_MU'] + 1e-6)
    df['region_re_share'] = df['re_total_MU'] / (df['re_national'] + 1e-6)
    df['hydro_cap_util']  = df['cf_hydro_national']
    df['wind_cap_util']   = df['cf_wind_national']
    df['solar_cap_util']  = df['cf_solar_national']

    # ── REMOVED: percentile_rank (caused instability) ────────────────────────

    # ── Weather-derived ───────────────────────────────────────────────────────
    df['cloud_solar_interaction'] = df['weather_cloud'] * df['solar_MU']
    df['wind_speed_gen_ratio']    = df['weather_wind'] / (df['wind_MU'] + 1e-6)
    df['precip_lag1']             = df['weather_precip'].shift(1)
    df['precip_roll7']            = df['weather_precip'].shift(1).rolling(7, min_periods=3).mean()

    # ── Deficit flags (region-local quantiles) ────────────────────────────────
    q20_re    = df['re_total_MU'].quantile(0.20)
    q20_hydro = df['hydro_MU'].quantile(0.20)
    q20_solar = df['solar_MU'].quantile(0.20)
    q20_wind  = df['wind_MU'].quantile(0.20)

    df['re_below_q20']    = (df['re_total_MU'] < q20_re).astype(int)
    df['hydro_below_q20'] = (df['hydro_MU']    < q20_hydro).astype(int)
    df['solar_below_q20'] = (df['solar_MU']    < q20_solar).astype(int)
    df['wind_below_q20']  = (df['wind_MU']     < q20_wind).astype(int)

    return df


def engineer_all_regions(long_df):
    log.info("Engineering features per region...")
    parts = []
    for r in REGIONS:
        log.info(f"  Region {r}...")
        rdf = long_df[long_df['Region'] == r].copy()
        parts.append(engineer_features_region(rdf))
    feat_df = pd.concat(parts, ignore_index=True).sort_values(['Date','Region']).reset_index(drop=True)
    log.info(f"  Feature-engineered shape: {feat_df.shape}")
    return feat_df


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: LABEL CREATION
# ═══════════════════════════════════════════════════════════════════════════════

def create_labels_region(df):
    df = df.copy().sort_values('Date').reset_index(drop=True)

    c1 = df['re_below_q20'].fillna(0)
    c2 = (df['re_cv_7d'].fillna(0) > 0.35).astype(int)
    c3 = df['hydro_below_q20'].fillna(0)

    roll3  = df['re_total_MU'].shift(1).rolling(3, min_periods=2).mean()
    roll7_ = df['re_total_MU'].shift(1).rolling(7, min_periods=4).mean()
    c4 = (roll7_ < roll3).astype(int).fillna(0)

    c5 = ((df['solar_below_q20'].fillna(0) == 1) & (df['weather_cloud'].fillna(50) > 60)).astype(int)

    df['stress_score']    = c1 + c2 + c3 + c4 + c5
    df['GridStressEvent'] = (df['stress_score'] >= 3).astype(int)

    def risk_level(s):
        if s <= 1:   return 'Low'
        elif s <= 2: return 'Medium'
        else:        return 'High'

    df['RiskLevel'] = df['stress_score'].apply(risk_level)
    return df


def label_all_regions(feat_df):
    log.info("Creating GridStressEvent labels...")
    parts = []
    for r in REGIONS:
        rdf = feat_df[feat_df['Region'] == r].copy()
        parts.append(create_labels_region(rdf))
    labelled = pd.concat(parts, ignore_index=True).sort_values(['Date','Region']).reset_index(drop=True)
    rate = labelled['GridStressEvent'].mean()
    log.info(f"  Label distribution: {labelled['GridStressEvent'].value_counts().to_dict()} | stress_rate={rate:.3f}")
    return labelled


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: FINAL FEATURE SET (REDUCED for stability)
# ═══════════════════════════════════════════════════════════════════════════════

FEATURE_GROUPS = {
    'generation_raw': [
        'solar_MU','wind_MU','hydro_MU','re_total_MU',
        'solar_national','wind_national','hydro_national','re_national',
    ],
    'capacity_factor': [
        'cf_hydro_national','cf_wind_national','cf_solar_national',
        'cap_hydro_MW','cap_wind_MW','cap_solar_MW',
    ],
    'lag_features': [
        f'{fuel}_lag{lag}'
        for fuel in ['solar','wind','hydro','re']
        for lag in [1,3,7,14,30]
    ],
    'rolling_stats': [  # Only mean and std (removed min/max)
        f'{fuel}_roll_{stat}_{win}'
        for fuel in ['solar','wind','hydro','re']
        for win in [7,14,30]
        for stat in ['mean','std']
    ],
    'volatility': [
        're_cv_7d',
        'solar_delta_1d','wind_delta_1d','hydro_delta_1d','re_delta_1d',
        'solar_pct_change_1d','wind_pct_change_1d','hydro_pct_change_1d','re_pct_change_1d',
    ],
    'ratio_features': [
        'solar_share','wind_share','hydro_share',
        'hydro_cap_util','wind_cap_util','solar_cap_util','region_re_share',
    ],
    'temporal': [
        'month_sin','month_cos','dow_sin','dow_cos',
        'dayofyear','quarter','year',
        'is_monsoon','is_solar_peak','is_wind_season',
    ],
    'deficit_flags': [
        're_below_q20','hydro_below_q20','solar_below_q20','wind_below_q20',
    ],
    'weather': [
        'weather_temp','weather_precip','weather_wind','weather_cloud',
        'cloud_solar_interaction','wind_speed_gen_ratio','precip_lag1','precip_roll7',
    ],
    'region_encoded': ['Region_encoded'],
}


def prepare_model_dataset(labelled_df):
    log.info("Preparing final model dataset...")

    le = LabelEncoder()
    labelled_df['Region_encoded'] = le.fit_transform(labelled_df['Region'])
    region_encoding = dict(zip(le.classes_, le.transform(le.classes_).tolist()))

    all_features = []
    seen = set()
    for grp, cols in FEATURE_GROUPS.items():
        for c in cols:
            if c in labelled_df.columns and c not in seen:
                all_features.append(c)
                seen.add(c)

    TARGET = 'GridStressEvent'
    keep   = ['Date','Region'] + all_features + [TARGET,'RiskLevel','stress_score']
    model_df = labelled_df[keep].copy()

    # Drop rows with >30% features missing (first ~30 rows per region due to rolling)
    nan_thresh = int(0.70 * len(all_features))
    before = len(model_df)
    model_df = model_df.dropna(subset=all_features, thresh=nan_thresh)
    after  = len(model_df)
    log.info(f"  Dropped {before - after} rows with excessive NaN")

    # 🔥 STRONG NaN CLEANING - Region-wise median fill
    for feat in all_features:
        if model_df[feat].isna().any():
            model_df[feat] = model_df.groupby('Region')[feat].transform(
                lambda x: x.fillna(x.median())
            )

    # 🔥 GLOBAL fallback for any remaining NaNs
    for feat in all_features:
        if model_df[feat].isna().any():
            global_median = model_df[feat].median()
            model_df[feat] = model_df[feat].fillna(global_median)

    # 🔥 FINAL HARD SAFETY - replace any remaining with 0
    model_df[all_features] = model_df[all_features].fillna(0)

    remaining = model_df[all_features].isnull().sum().sum()
    log.info(f"  Remaining nulls AFTER FIX: {remaining}")
    
    if remaining > 0:
        log.warning(f"  WARNING: Still have {remaining} NaNs! Applying final fill...")
        model_df[all_features] = model_df[all_features].fillna(0)

    log.info(f"  Final shape: {model_df.shape}")
    log.info(f"  Stress rate: {model_df[TARGET].mean():.3f}")

    return model_df, all_features, region_encoding, le


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: TRAIN MODELS
# ═══════════════════════════════════════════════════════════════════════════════

def train_models(model_df, all_features):
    TARGET = 'GridStressEvent'

    # Temporal split at 80th percentile of dates
    split_date = model_df['Date'].quantile(0.80)
    train_df = model_df[model_df['Date'] <= split_date]
    test_df  = model_df[model_df['Date'] >  split_date]

    log.info(f"Train: {train_df.Date.min().date()} → {train_df.Date.max().date()} ({len(train_df)} rows)")
    log.info(f"Test : {test_df.Date.min().date()} → {test_df.Date.max().date()} ({len(test_df)} rows)")

    X_train_raw = train_df[all_features]
    y_train     = train_df[TARGET]
    X_test_raw  = test_df[all_features]
    y_test      = test_df[TARGET]

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_test  = scaler.transform(X_test_raw)

    # 🔥 MUST ADD: Replace any NaN that somehow survived
    X_train = np.nan_to_num(X_train)
    X_test = np.nan_to_num(X_test)
    
    log.info(f"  NaNs after cleaning: Train={np.isnan(X_train).sum()}, Test={np.isnan(X_test).sum()}")

    # SMOTE
    stress_rate = y_train.mean()
    log.info(f"Train stress rate: {stress_rate:.3f}")
    if stress_rate < 0.35:
        smote = SMOTE(random_state=42, k_neighbors=min(5, y_train.sum()))
        X_train_bal, y_train_bal = smote.fit_resample(X_train, y_train)
        log.info(f"SMOTE applied. Balanced size: {len(X_train_bal)}")
    else:
        X_train_bal, y_train_bal = X_train, y_train

    # Candidate models
    candidates = {
        'LogisticRegression': LogisticRegression(
            max_iter=1000, C=0.5, class_weight='balanced', random_state=42
        ),
        'RandomForest': RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=5,
            class_weight='balanced', random_state=42, n_jobs=-1
        ),
        'ExtraTrees': ExtraTreesClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=5,
            class_weight='balanced', random_state=42, n_jobs=-1
        ),
        'GradientBoosting': GradientBoostingClassifier(
            n_estimators=200, learning_rate=0.05, max_depth=5,
            subsample=0.8, random_state=42
        ),
    }
    if HAS_XGB:
        spw = (y_train_bal == 0).sum() / max((y_train_bal == 1).sum(), 1)
        candidates['XGBoost'] = xgb.XGBClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=spw, eval_metric='logloss',
            random_state=42, n_jobs=-1
        )

    # 5-fold CV
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_results = {}
    for name, model in candidates.items():
        log.info(f"  CV {name}...")
        scores = cross_val_score(model, X_train_bal, y_train_bal, cv=cv, scoring='roc_auc', n_jobs=-1)
        cv_results[name] = {'mean': float(scores.mean()), 'std': float(scores.std()), 'scores': scores.tolist()}
        log.info(f"    ROC-AUC = {scores.mean():.4f} ± {scores.std():.4f}")

    # Train final models on full training set
    trained = {}
    metrics = {}
    for name, model in candidates.items():
        log.info(f"  Training {name} (full)...")
        model.fit(X_train_bal, y_train_bal)
        trained[name] = model

        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        metrics[name] = {
            'roc_auc':   round(float(roc_auc_score(y_test, y_prob)), 4),
            'pr_auc':    round(float(average_precision_score(y_test, y_prob)), 4),
            'f1':        round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
            'precision': round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
            'recall':    round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        }
        log.info(f"    ROC-AUC={metrics[name]['roc_auc']} PR-AUC={metrics[name]['pr_auc']} F1={metrics[name]['f1']}")

    # Best model by ROC-AUC
    best_name  = max(metrics, key=lambda n: metrics[n]['roc_auc'])
    best_model = trained[best_name]
    log.info(f"Best model: {best_name} (ROC-AUC={metrics[best_name]['roc_auc']})")

    # Calibrate probabilities for best model
    calibrated = CalibratedClassifierCV(best_model, cv='prefit', method='sigmoid')
    calibrated.fit(X_test, y_test)

    split_info = {
        'train_start': str(train_df.Date.min())[:10],
        'train_end':   str(train_df.Date.max())[:10],
        'test_start':  str(test_df.Date.min())[:10],
        'test_end':    str(test_df.Date.max())[:10],
    }

    return trained, calibrated, best_name, scaler, metrics, cv_results, split_info, (X_test, y_test)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: SHAP IMPORTANCE (FIXED for multi-class)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_importance(best_model, best_name, X_test, all_features, n_sample=500):
    log.info("Computing feature importance...")

    if HAS_SHAP and best_name in ['RandomForest','ExtraTrees','GradientBoosting','XGBoost']:
        idx = np.random.choice(len(X_test), min(n_sample, len(X_test)), replace=False)
        explainer = shap.TreeExplainer(best_model)
        sv = explainer.shap_values(X_test[idx])
        
        # 🔥 FIX: Handle multi-class SHAP output
        if isinstance(sv, list):
            # Binary classification: sv[1] is for class 1
            shap_values = sv[1] if len(sv) > 1 else sv[0]
        else:
            shap_values = sv
        
        # Handle 3D arrays
        if len(shap_values.shape) == 3:
            shap_values = shap_values[:, :, 1] if shap_values.shape[2] > 1 else shap_values[:, :, 0]
        
        importance = np.abs(shap_values).mean(axis=0)
        importance = np.ravel(importance)
        method = 'shap'
    elif hasattr(best_model, 'feature_importances_'):
        importance = best_model.feature_importances_
        method = 'gini'
    else:
        importance = np.abs(best_model.coef_[0])
        method = 'coef'
    
    # Ensure length matches
    if len(importance) != len(all_features):
        log.warning(f"  Importance length mismatch: {len(importance)} vs {len(all_features)}")
        # Pad or truncate
        if len(importance) < len(all_features):
            importance = np.pad(importance, (0, len(all_features) - len(importance)))
        else:
            importance = importance[:len(all_features)]

    fi_df = pd.DataFrame({'feature': all_features, 'importance': importance})
    fi_df = fi_df.sort_values('importance', ascending=False).reset_index(drop=True)
    log.info(f"  Method: {method} | Top feature: {fi_df.iloc[0]['feature']}")
    return fi_df, method


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10: REGION PROFILES (FIXED: month column recreated)
# ═══════════════════════════════════════════════════════════════════════════════

def build_region_profiles(model_df):
    log.info("Building region profiles...")
    
    profiles = {}

    for r in REGIONS:
        rdf = model_df[model_df['Region'] == r].copy()

        # 🔥 FIX: recreate month safely (not in model features)
        rdf['month'] = pd.to_datetime(rdf['Date']).dt.month

        recent_90 = rdf.sort_values('Date').tail(90)

        monthly_stress = (
            rdf.groupby('month')['GridStressEvent']
            .mean()
            .round(3)
            .to_dict()
        )

        driver_cols = ['re_below_q20', 'hydro_below_q20', 'solar_below_q20', 'wind_below_q20']
        
        driver_rates = {}
        for col in driver_cols:
            if col in rdf.columns:
                driver_rates[col] = round(float(rdf[col].mean()), 3)

        if 're_cv_7d' in rdf.columns:
            driver_rates['high_volatility'] = round(float((rdf['re_cv_7d'] > 0.35).mean()), 3)

        profiles[r] = {
            'region': r,
            'label': REGION_COORDS[r]['label'],
            'lat': REGION_COORDS[r]['lat'],
            'lon': REGION_COORDS[r]['lon'],
            'total_days': int(len(rdf)),
            'stress_event_rate': round(float(rdf['GridStressEvent'].mean()), 3),
            'recent_stress_rate_90d': round(float(recent_90['GridStressEvent'].mean()), 3),
            'mean_re_MU': round(float(rdf['re_total_MU'].mean()), 2),
            'std_re_MU': round(float(rdf['re_total_MU'].std()), 2),
            'cv_re': round(float(rdf['re_total_MU'].std() / (rdf['re_total_MU'].mean() + 1e-6)), 3),
            'mean_solar_MU': round(float(rdf['solar_MU'].mean()), 2),
            'mean_wind_MU': round(float(rdf['wind_MU'].mean()), 2),
            'mean_hydro_MU': round(float(rdf['hydro_MU'].mean()), 2),
            'monthly_stress_rate': {str(k): v for k, v in monthly_stress.items()},
            'driver_rates': driver_rates,
            'dominant_fuel': max(['solar_MU', 'wind_MU', 'hydro_MU'], key=lambda f: rdf[f].mean()),
        }
    
    log.info("  Region profiles built.")
    return profiles


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 11: SAVE ALL ARTEFACTS (FIXED JSON serialization)
# ═══════════════════════════════════════════════════════════════════════════════

def save_artefacts(trained_models, calibrated_model, best_name, scaler,
                   all_features, region_encoding, metrics, cv_results,
                   split_info, fi_df, fi_method, region_profiles, model_df):

    log.info("Saving artefacts...")

    # Models
    joblib.dump(calibrated_model, ARTEFACT_DIR / "best_model.pkl")
    for name, model in trained_models.items():
        joblib.dump(model, ARTEFACT_DIR / f"model_{name}.pkl")

    # Scaler
    joblib.dump(scaler, ARTEFACT_DIR / "scaler.pkl")

    # Feature columns
    with open(ARTEFACT_DIR / "feature_columns.json", "w") as f:
        json.dump(to_serializable(all_features), f, indent=2)

    # Feature groups
    with open(ARTEFACT_DIR / "feature_groups.json", "w") as f:
        json.dump(to_serializable(FEATURE_GROUPS), f, indent=2)

    # Region encoding
    with open(ARTEFACT_DIR / "region_encoding.json", "w") as f:
        json.dump(to_serializable(region_encoding), f, indent=2)

    # Region profiles
    with open(ARTEFACT_DIR / "region_profiles.json", "w") as f:
        json.dump(to_serializable(region_profiles), f, indent=2)

    # Region coords
    with open(ARTEFACT_DIR / "region_coords.json", "w") as f:
        json.dump(to_serializable(REGION_COORDS), f, indent=2)

    # Metrics
    with open(ARTEFACT_DIR / "model_metrics.json", "w") as f:
        json.dump(to_serializable(metrics), f, indent=2)

    # CV results
    with open(ARTEFACT_DIR / "cv_results.json", "w") as f:
        json.dump(to_serializable(cv_results), f, indent=2)

    # Feature importance
    fi_df.to_csv(ARTEFACT_DIR / "feature_importance.csv", index=False)
    fi_records = fi_df.head(30).to_dict(orient='records')
    with open(ARTEFACT_DIR / "feature_importance.json", "w") as f:
        json.dump(to_serializable({'method': fi_method, 'features': fi_records}), f, indent=2)

    # Historical dataset (for analytics endpoints)
    model_df.to_parquet(ARTEFACT_DIR / "model_dataset.parquet", index=False)

    # Master config
    config = {
        'best_model_name': best_name,
        'n_features': len(all_features),
        'regions': REGIONS,
        'target': 'GridStressEvent',
        'label_method': 'multi-criteria derived (3 of 5 evidence criteria)',
        'weather_source': 'Open-Meteo Historical Archive (ERA5) — free, no API key',
        'importance_method': fi_method,
        'split_info': split_info,
        'best_model_metrics': metrics[best_name],
        'all_model_names': list(trained_models.keys()),
    }
    with open(ARTEFACT_DIR / "config.json", "w") as f:
        json.dump(to_serializable(config), f, indent=2)

    log.info(f"All artefacts saved to: {ARTEFACT_DIR.resolve()}")
    for fp in sorted(ARTEFACT_DIR.iterdir()):
        size_kb = fp.stat().st_size / 1024
        log.info(f"  {fp.name:<45} {size_kb:.1f} KB")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    log.info("=" * 60)
    log.info("GridShield+ Training Pipeline")
    log.info("=" * 60)

    try:
        hydro, solar, wind, cap_dt, cap_st = load_raw_data()
        master  = merge_and_align(hydro, solar, wind, cap_dt)
        weather = load_or_fetch_weather(master)
        long_df = melt_to_long(master, weather)
        feat_df = engineer_all_regions(long_df)
        labelled = label_all_regions(feat_df)
        model_df, all_features, region_encoding, le = prepare_model_dataset(labelled)

        trained, calibrated, best_name, scaler, metrics, cv_results, split_info, (X_test, y_test) = \
            train_models(model_df, all_features)

        fi_df, fi_method = compute_importance(trained[best_name], best_name, X_test, all_features)
        region_profiles  = build_region_profiles(model_df)

        save_artefacts(
            trained, calibrated, best_name, scaler,
            all_features, region_encoding, metrics, cv_results,
            split_info, fi_df, fi_method, region_profiles, model_df
        )

        log.info("=" * 60)
        log.info("✅ Pipeline complete successfully!")
        log.info("Run: uvicorn app.main:app --reload")
        log.info("=" * 60)
        
    except Exception as e:
        log.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        raise