from typing import List
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    date: str
    region: str = Field(..., description="NR, WR, SR, ER, NER")
    solar_mu: float
    wind_mu: float
    hydro_mu: float
    demand_mu: float


class DriverItem(BaseModel):
    feature: str
    value: float


class CounterfactualItem(BaseModel):
    title: str
    description: str
    new_failure_probability: float
    new_risk_level: str
    safe_re_mu: float
    backup_needed_mu: float


class PredictResponse(BaseModel):
    region: str
    date: str
    total_renewable_mu: float
    failure_probability: float
    risk_level: str
    safe_re_mu: float
    re_withheld_mu: float
    backup_needed_mu: float
    top_failure_drivers: List[DriverItem]
    counterfactual_options: List[CounterfactualItem]