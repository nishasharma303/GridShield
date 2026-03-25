import joblib
import pandas as pd
from functools import lru_cache
from app.config import MODEL_PATH, SCALER_PATH, FEATURES_PATH, MASTER_DATA_PATH, METRICS_PATH


@lru_cache
def load_model():
    return joblib.load(MODEL_PATH)


@lru_cache
def load_scaler():
    return joblib.load(SCALER_PATH)


@lru_cache
def load_feature_columns():
    df = pd.read_csv(FEATURES_PATH)
    if "feature" in df.columns:
        return df["feature"].tolist()
    return df.iloc[:, 0].tolist()


@lru_cache
def load_master_data():
    df = pd.read_csv(MASTER_DATA_PATH)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values(["region", "date"]).reset_index(drop=True)


@lru_cache
def load_metrics():
    return pd.read_csv(METRICS_PATH)