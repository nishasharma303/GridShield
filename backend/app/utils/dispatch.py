def get_risk_level(prob: float) -> str:
    if prob >= 0.75:
        return "HIGH"
    if prob >= 0.40:
        return "MEDIUM"
    return "LOW"


def compute_dispatch(total_renewable_mu: float, failure_prob: float, demand_mu: float):
    safe_re_mu = max(0.0, round(total_renewable_mu * (1 - failure_prob), 4))
    re_withheld_mu = max(0.0, round(total_renewable_mu - safe_re_mu, 4))
    backup_needed_mu = max(0.0, round(demand_mu - safe_re_mu, 4))

    return {
        "safe_re_mu": safe_re_mu,
        "re_withheld_mu": re_withheld_mu,
        "backup_needed_mu": backup_needed_mu,
    }