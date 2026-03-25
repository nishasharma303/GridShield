from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "trained_models"
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"

MODEL_PATH = MODEL_DIR / "gridshield_best_model.pkl"
SCALER_PATH = MODEL_DIR / "gridshield_scaler.pkl"
FEATURES_PATH = MODEL_DIR / "feature_cols.csv"
MASTER_DATA_PATH = PROCESSED_DIR / "master_2017plus_v2.csv"
METRICS_PATH = PROCESSED_DIR / "model_metrics_final.csv"
load_dotenv(BASE_DIR / ".env")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")