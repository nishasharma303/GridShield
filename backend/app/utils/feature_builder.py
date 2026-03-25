import pandas as pd
import numpy as np


REGION_LIST = ["NR", "WR", "SR", "ER", "NER"]


def _safe_mean(series, default=0.0):
    if len(series) == 0:
        return default
    val = series.mean()
    return default if pd.isna(val) else float(val)


def _safe_std(series, default=0.0):
    if len(series) == 0:
        return default
    val = series.std()
    return default if pd.isna(val) else float(val)


def _safe_cv(series, default=0.0):
    if len(series) == 0:
        return default
    mean_val = series.mean()
    std_val = series.std()
    if pd.isna(mean_val) or pd.isna(std_val) or mean_val == 0:
        return default
    return float(std_val / mean_val)


def build_feature_row(payload, master_df, feature_cols):
    region = payload.region.upper()
    target_date = pd.to_datetime(payload.date)

    region_df = master_df[master_df["region"] == region].copy()
    history_df = region_df[region_df["date"] < target_date].sort_values("date")

    if history_df.empty:
        raise ValueError(f"No prior historical data available for region {region} before {payload.date}")

    total_renewable = payload.solar_mu + payload.wind_mu + payload.hydro_mu

    row = {
        "solar_mu": payload.solar_mu,
        "wind_mu": payload.wind_mu,
        "hydro_mu": payload.hydro_mu,
        "total_renewable_mu": total_renewable,
        "day_of_week": target_date.dayofweek,
        "month": target_date.month,
        "quarter": (target_date.month - 1) // 3 + 1,
        "day_of_year": target_date.dayofyear,
        "is_monsoon": 1 if target_date.month in [6, 7, 8, 9] else 0,
        "is_summer": 1 if target_date.month in [3, 4, 5, 6] else 0,
        "is_winter": 1 if target_date.month in [11, 12, 1, 2] else 0,
        "month_sin": np.sin(2 * np.pi * target_date.month / 12),
        "month_cos": np.cos(2 * np.pi * target_date.month / 12),
    }

    for r in REGION_LIST:
        row[f"region_{r}"] = 1 if r == region else 0

    # Recent histories
    solar_hist = history_df["solar_mu"]
    wind_hist = history_df["wind_mu"]
    hydro_hist = history_df["hydro_mu"]
    total_hist = history_df["total_renewable_mu"]

    # Lags from actual history
    lag_map = [1, 3, 7, 14]
    for lag in lag_map:
        if len(history_df) >= lag:
            lag_row = history_df.iloc[-lag]
            row[f"solar_mu_lag{lag}"] = float(lag_row["solar_mu"])
            row[f"wind_mu_lag{lag}"] = float(lag_row["wind_mu"])
            row[f"hydro_mu_lag{lag}"] = float(lag_row["hydro_mu"])
            row[f"total_renewable_mu_lag{lag}"] = float(lag_row["total_renewable_mu"])
        else:
            row[f"solar_mu_lag{lag}"] = _safe_mean(solar_hist)
            row[f"wind_mu_lag{lag}"] = _safe_mean(wind_hist)
            row[f"hydro_mu_lag{lag}"] = _safe_mean(hydro_hist)
            row[f"total_renewable_mu_lag{lag}"] = _safe_mean(total_hist)

    # Rolling stats from real history
    last7 = history_df.tail(7)
    last14 = history_df.tail(14)

    windows = [(7, last7), (14, last14)]
    for n, dfw in windows:
        for col in ["solar_mu", "wind_mu", "hydro_mu", "total_renewable_mu"]:
            series = dfw[col]
            row[f"{col}_rollmean{n}"] = _safe_mean(series)
            row[f"{col}_rollstd{n}"] = _safe_std(series)
            row[f"{col}_cv{n}"] = _safe_cv(series)

    # Fill any other training columns from latest known valid historical row
    latest_hist = history_df.iloc[-1].to_dict()

    for col in feature_cols:
        if col not in row:
            row[col] = float(latest_hist[col]) if col in latest_hist and pd.notna(latest_hist[col]) else 0.0

    row_df = pd.DataFrame([row])

    for col in feature_cols:
        if col not in row_df.columns:
            row_df[col] = 0.0

    row_df = row_df[feature_cols]
    return row_df, total_renewable