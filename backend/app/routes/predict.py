from fastapi import APIRouter, HTTPException
from app.schemas import PredictRequest, PredictResponse
from app.model_loader import load_model, load_scaler, load_feature_columns, load_master_data
from app.utils.feature_builder import build_feature_row
from app.utils.dispatch import compute_dispatch, get_risk_level
from app.utils.explain import generate_top_drivers
from app.utils.counterfactual import generate_counterfactuals
import traceback

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    try:
        model = load_model()
        scaler = load_scaler()
        feature_cols = load_feature_columns()
        master_df = load_master_data()

        X_input, total_renewable = build_feature_row(payload, master_df, feature_cols)
        X_scaled = scaler.transform(X_input)

        if hasattr(model, "predict_proba"):
            prob = float(model.predict_proba(X_scaled)[0][1])
        else:
            prob = float(model.predict(X_scaled)[0])

        risk_level = get_risk_level(prob)
        dispatch = compute_dispatch(total_renewable, prob, payload.demand_mu)
        drivers = generate_top_drivers(X_input)
        counterfactuals = generate_counterfactuals(payload, master_df, feature_cols, scaler, model)

        return {
            "region": payload.region.upper(),
            "date": payload.date,
            "total_renewable_mu": round(total_renewable, 4),
            "failure_probability": round(prob, 4),
            "risk_level": risk_level,
            "safe_re_mu": dispatch["safe_re_mu"],
            "re_withheld_mu": dispatch["re_withheld_mu"],
            "backup_needed_mu": dispatch["backup_needed_mu"],
            "top_failure_drivers": drivers,
            "counterfactual_options": counterfactuals,
        }

    except Exception as e:
        print("PREDICT ERROR:", str(e))
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))