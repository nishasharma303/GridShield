from copy import deepcopy
from app.utils.dispatch import get_risk_level, compute_dispatch
from app.utils.feature_builder import build_feature_row


def generate_counterfactuals(payload, master_df, feature_cols, scaler, model):
    scenarios = [
        {
            "title": "Reduce renewable dependency by 20%",
            "description": "Conservative dispatch using 20% less renewable exposure.",
            "solar_factor": 0.8,
            "wind_factor": 0.8,
            "hydro_factor": 0.8,
        },
        {
            "title": "Increase hydro reserve by 15%",
            "description": "Simulate higher dependable hydro support.",
            "solar_factor": 1.0,
            "wind_factor": 1.0,
            "hydro_factor": 1.15,
        },
    ]

    outputs = []

    for s in scenarios:
        new_payload = deepcopy(payload)
        new_payload.solar_mu = payload.solar_mu * s["solar_factor"]
        new_payload.wind_mu = payload.wind_mu * s["wind_factor"]
        new_payload.hydro_mu = payload.hydro_mu * s["hydro_factor"]

        X_cf, total_cf = build_feature_row(new_payload, master_df, feature_cols)
        X_cf_scaled = scaler.transform(X_cf)

        if hasattr(model, "predict_proba"):
            prob_cf = float(model.predict_proba(X_cf_scaled)[0][1])
        else:
            prob_cf = float(model.predict(X_cf_scaled)[0])

        dispatch_cf = compute_dispatch(total_cf, prob_cf, payload.demand_mu)

        outputs.append({
            "title": s["title"],
            "description": s["description"],
            "new_failure_probability": round(prob_cf, 4),
            "new_risk_level": get_risk_level(prob_cf),
            "safe_re_mu": dispatch_cf["safe_re_mu"],
            "backup_needed_mu": dispatch_cf["backup_needed_mu"],
        })

    return outputs