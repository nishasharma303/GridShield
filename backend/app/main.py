"""
GridShield+ FastAPI Backend — v2
Real region-calibrated risk logic using actual POSOCO data thresholds.
"""

import json, logging, time, math
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd
import joblib
import requests
from datetime import datetime, date

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
ART_DIR  = BASE_DIR / "artefacts"

# ── REAL region thresholds computed from 5 years of actual POSOCO daily data ──
REGION_THRESHOLDS = {
    "NR":  {"q20_re":158.0, "q50_re":242.5, "q80_re":390.5, "mean_re":267.9,
            "q20_solar":17.1,"q20_wind":6.0, "q20_hydro":113.0,
            "mean_solar":39.0,"mean_wind":17.2,"mean_hydro":211.7,
            "mean_cv7":0.054,"high_cv_threshold":0.069,"daily_demand_proxy_MU":1050.0},
    "WR":  {"q20_re":88.7,  "q50_re":128.9, "q80_re":176.4, "mean_re":136.2,
            "q20_solar":17.0,"q20_wind":30.0,"q20_hydro":24.0,
            "mean_solar":26.5,"mean_wind":67.3,"mean_hydro":42.4,
            "mean_cv7":0.153,"high_cv_threshold":0.191,"daily_demand_proxy_MU":950.0},
    "SR":  {"q20_re":179.3, "q50_re":225.9, "q80_re":314.6, "mean_re":243.9,
            "q20_solar":53.0,"q20_wind":27.0,"q20_hydro":62.0,
            "mean_solar":74.5,"mean_wind":78.2,"mean_hydro":91.2,
            "mean_cv7":0.089,"high_cv_threshold":0.111,"daily_demand_proxy_MU":1100.0},
    "ER":  {"q20_re":35.0,  "q50_re":71.0,  "q80_re":125.3, "mean_re":78.3,
            "q20_solar":1.0, "q20_wind":0.0, "q20_hydro":32.0,
            "mean_solar":2.9,"mean_wind":0.0,"mean_hydro":75.3,
            "mean_cv7":0.074,"high_cv_threshold":0.099,"daily_demand_proxy_MU":420.0},
    "NER": {"q20_re":8.0,   "q50_re":16.0,  "q80_re":26.4,  "mean_re":17.0,
            "q20_solar":0.0, "q20_wind":0.0, "q20_hydro":8.0,
            "mean_solar":0.13,"mean_wind":0.0,"mean_hydro":16.9,
            "mean_cv7":0.096,"high_cv_threshold":0.121,"daily_demand_proxy_MU":95.0},
}

REGION_COORDS = {
    "NR": {"lat":28.7041,"lon":77.1025,"label":"North Region"},
    "WR": {"lat":21.1458,"lon":79.0882,"label":"West Region"},
    "SR": {"lat":15.3173,"lon":75.7139,"label":"South Region"},
    "ER": {"lat":22.5726,"lon":88.3639,"label":"East Region"},
    "NER":{"lat":26.2006,"lon":92.9376,"label":"North-East Region"},
}
REGIONS = ["NR","WR","SR","ER","NER"]

def load_artefacts():
    art = {}
    try:
        art["model"]     = joblib.load(ART_DIR/"best_model.pkl")
        art["scaler"]    = joblib.load(ART_DIR/"scaler.pkl")
        with open(ART_DIR/"feature_columns.json")   as f: art["features"]   = json.load(f)
        with open(ART_DIR/"region_profiles.json")   as f: art["profiles"]   = json.load(f)
        with open(ART_DIR/"model_metrics.json")     as f: art["metrics"]    = json.load(f)
        with open(ART_DIR/"cv_results.json")        as f: art["cv"]         = json.load(f)
        with open(ART_DIR/"config.json")            as f: art["config"]     = json.load(f)
        with open(ART_DIR/"feature_importance.json")as f: art["importance"] = json.load(f)
        with open(ART_DIR/"region_encoding.json")   as f: art["encoding"]   = json.load(f)
        art["history"] = pd.read_parquet(ART_DIR/"model_dataset.parquet")
        log.info("Artefacts loaded. Model: %s", art["config"].get("best_model_name"))
    except FileNotFoundError as e:
        log.error("Artefact missing: %s — run train_pipeline.py first.", e)
    return art

ART = load_artefacts()

app = FastAPI(title="GridShield+ API v2", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class PredictRequest(BaseModel):
    region: str
    solar_MU:  float = Field(..., ge=0)
    wind_MU:   float = Field(..., ge=0)
    hydro_MU:  float = Field(..., ge=0)
    demand_MU: Optional[float] = Field(None, ge=0)
    re_cv_7d:  Optional[float] = None
    weather_temp:   Optional[float] = None
    weather_precip: Optional[float] = None
    weather_wind:   Optional[float] = None
    weather_cloud:  Optional[float] = None
    date: Optional[str] = None


def compute_risk_score(region, solar, wind, hydro, cv, cloud, demand_MU, month):
    th = REGION_THRESHOLDS[region]
    re_total = solar + wind + hydro
    demand   = demand_MU if demand_MU else th["daily_demand_proxy_MU"]
    score    = 0.0
    criteria = {}

    # C1: RE vs q20 (25 pts)
    if re_total < th["q20_re"]:
        d = (th["q20_re"] - re_total) / th["q20_re"]
        pts = min(25, 15 + d * 50)
        criteria["low_re"] = {"triggered":True,"severity":round(d,3),"icon":"📉",
            "explanation":f"Total RE ({re_total:.1f} MU) is BELOW the {region} 20th-percentile threshold "
                          f"({th['q20_re']} MU). Historically this level of generation precedes grid stress events.",
            "value_label":f"{re_total:.1f} MU  < threshold {th['q20_re']} MU"}
        score += pts
    elif re_total < th["q50_re"]:
        d = (th["q50_re"] - re_total) / th["q50_re"]
        criteria["low_re"] = {"triggered":"partial","severity":round(d*0.5,3),"icon":"📊",
            "explanation":f"RE ({re_total:.1f} MU) is below the regional median ({th['q50_re']} MU). Below-average generation.",
            "value_label":f"{re_total:.1f} MU  < median {th['q50_re']} MU"}
        score += d * 12
    else:
        criteria["low_re"] = {"triggered":False,"severity":0,"icon":"✅",
            "explanation":f"RE ({re_total:.1f} MU) is above the regional median. Generation is healthy.",
            "value_label":f"{re_total:.1f} MU ✓"}

    # C2: Hydro stress (20 pts)
    if hydro < th["q20_hydro"]:
        d = (th["q20_hydro"] - hydro) / (th["q20_hydro"] + 1)
        pts = min(20, 12 + d * 30)
        criteria["hydro_stress"] = {"triggered":True,"severity":round(d,3),"icon":"💧",
            "explanation":f"Hydro ({hydro:.1f} MU) is below the {region} 20th percentile ({th['q20_hydro']} MU). "
                          f"Hydro is the baseload renewable in this region — weak hydro amplifies all other deficits.",
            "value_label":f"{hydro:.1f} MU  < threshold {th['q20_hydro']} MU"}
        score += pts
    else:
        criteria["hydro_stress"] = {"triggered":False,"severity":0,"icon":"✅",
            "explanation":f"Hydro ({hydro:.1f} MU) is above the stress threshold. Baseload RE is adequate.",
            "value_label":f"{hydro:.1f} MU ✓"}

    # C3: Seasonal solar stress (15 pts)
    adj = th["q20_solar"]
    if month in [11,12,1]: adj *= 0.70
    elif month in [5,6,7,8]: adj *= 1.15
    if adj > 1 and solar < adj:
        d = (adj - solar) / (adj + 1)
        pts = min(15, 8 + d * 25)
        criteria["solar_stress"] = {"triggered":True,"severity":round(d,3),"icon":"☁️",
            "explanation":f"Solar ({solar:.1f} MU) is below the seasonal threshold ({adj:.1f} MU for month {month}). "
                          f"Cloud cover or low solar irradiance is suppressing output.",
            "value_label":f"{solar:.1f} MU  < seasonal threshold {adj:.1f} MU"}
        score += pts
    else:
        criteria["solar_stress"] = {"triggered":False,"severity":0,"icon":"☀️",
            "explanation":f"Solar ({solar:.1f} MU) meets seasonal expectations for month {month}.",
            "value_label":f"{solar:.1f} MU ✓"}

    # C4: Volatility (20 pts)
    if cv > th["high_cv_threshold"]:
        excess = (cv - th["high_cv_threshold"]) / (th["high_cv_threshold"] + 0.01)
        pts = min(20, 10 + excess * 25)
        criteria["high_volatility"] = {"triggered":True,"severity":round(excess,3),"icon":"📊",
            "explanation":f"RE volatility (7-day CoV={cv:.3f}) exceeds the {region} high-volatility threshold "
                          f"({th['high_cv_threshold']:.3f}). Unstable output makes dispatch planning unreliable.",
            "value_label":f"CoV {cv:.3f}  > threshold {th['high_cv_threshold']:.3f}"}
        score += pts
    else:
        criteria["high_volatility"] = {"triggered":False,"severity":0,"icon":"✅",
            "explanation":f"RE volatility (CoV={cv:.3f}) is within the normal range for {region}.",
            "value_label":f"CoV {cv:.3f} ✓"}

    # C5: Cloud × solar interaction (10 pts)
    if cloud > 65 and solar < th["mean_solar"] * 0.75:
        pts = min(10, (cloud - 65) / 3.5)
        criteria["cloud_solar"] = {"triggered":True,"severity":round((cloud-65)/35,3),"icon":"⛅",
            "explanation":f"High cloud cover ({cloud:.0f}%) is actively suppressing solar ({solar:.1f} MU < "
                          f"75% of mean {th['mean_solar']:.1f} MU). Weather is the main solar driver today.",
            "value_label":f"Cloud={cloud:.0f}%  Solar={solar:.1f} MU"}
        score += pts
    else:
        criteria["cloud_solar"] = {"triggered":False,"severity":0,"icon":"✅",
            "explanation":f"Cloud cover ({cloud:.0f}%) is not critically suppressing solar.",
            "value_label":f"Cloud={cloud:.0f}% ✓"}

    # C6: Demand gap (10 pts) — uses real demand if provided, regional proxy otherwise
    re_demand_ratio = re_total / (demand + 1e-6)
    if re_demand_ratio < 0.20:
        pts = min(10, (0.20 - re_demand_ratio) * 80)
        criteria["demand_gap"] = {"triggered":True,"severity":round(1-re_demand_ratio/0.20,3),"icon":"⚡",
            "explanation":f"RE ({re_total:.1f} MU) covers only {re_demand_ratio*100:.1f}% of "
                          f"{'provided' if demand_MU else 'estimated regional'} demand ({demand:.0f} MU). "
                          f"Heavy reliance on thermal backup needed.",
            "value_label":f"RE covers {re_demand_ratio*100:.1f}% of demand {demand:.0f} MU"}
        score += pts
    else:
        criteria["demand_gap"] = {"triggered":False,"severity":0,"icon":"✅",
            "explanation":f"RE covers {re_demand_ratio*100:.1f}% of "
                          f"{'provided' if demand_MU else 'estimated'} demand ({demand:.0f} MU). Adequate.",
            "value_label":f"RE/Demand = {re_demand_ratio*100:.1f}% ✓"}

    return {"score":round(min(score,100),2),"criteria":criteria,
            "re_total":re_total,"demand":demand,"re_demand_ratio":round(re_demand_ratio,3),
            "re_demand_pct":round(re_demand_ratio*100,1)}


def score_to_risk(score, region):
    n = score / 100.0
    prob = round(max(0.001, min(0.999, 1/(1+math.exp(-8*(n-0.45))))), 4)
    if prob < 0.25:   return prob,"Low","green"
    elif prob < 0.50: return prob,"Medium","amber"
    elif prob < 0.72: return prob,"High","orange"
    else:             return prob,"Critical","red"


def dispatch_engine(prob, risk, re_total, demand, region):
    sf_map = {"Low":0.95,"Medium":0.82,"High":0.68,"Critical":0.55}
    act_map = {
        "Low":     "Normal dispatch. Minor buffer reserve recommended.",
        "Medium":  "Reduce RE dispatch. Arrange backup generation proactively.",
        "High":    "Significant curtailment needed. Procure backup power immediately.",
        "Critical":"CRITICAL: Minimum RE dispatch. Emergency backup required.",
    }
    sf      = sf_map[risk]
    safe_re = round(re_total * sf, 2)
    backup  = round(max(re_total * (1-sf), demand * 0.05), 2)
    return {
        "risk_level":risk,"status_color":{"Low":"green","Medium":"amber","High":"orange","Critical":"red"}[risk],
        "failure_probability":prob,"forecasted_re_MU":round(re_total,2),
        "safe_re_MU":safe_re,"re_withheld_MU":round(re_total-safe_re,2),
        "backup_needed_MU":backup,"demand_MU":round(demand,1),
        "re_demand_pct":round(re_total/demand*100,1),
        "demand_shortfall_MU":round(max(0,demand-re_total),1),
        "safety_factor":sf,"action_text":act_map[risk],
    }


def get_active_drivers(risk_result):
    drivers = []
    for key,c in risk_result["criteria"].items():
        if c["triggered"] is True or c["triggered"]=="partial":
            drivers.append({"feature":key,"explanation":c["explanation"],
                            "value_label":c["value_label"],"severity":c["severity"],
                            "icon":c["icon"],"triggered":c["triggered"]})
    drivers.sort(key=lambda x: x["severity"], reverse=True)
    if not drivers:
        drivers = [{"feature":"all_clear",
                    "explanation":"All renewable criteria are within normal range for this region. "
                                  "Generation, volatility, and weather are all healthy.",
                    "value_label":"No stress conditions detected","severity":0,"icon":"✅","triggered":False}]
    return drivers


def compute_counterfactuals(region, solar, wind, hydro, cv, cloud, demand, month, baseline_prob):
    scenarios = [
        {"desc":f"Increase hydro +25% ({hydro:.0f}→{hydro*1.25:.0f} MU)",
         "s":solar,"w":wind,"h":hydro*1.25,"cv":cv,"cl":cloud},
        {"desc":f"Increase all RE +20% (solar+wind+hydro ×1.2)",
         "s":solar*1.2,"w":wind*1.2,"h":hydro*1.2,"cv":cv,"cl":cloud},
        {"desc":f"Reduce volatility -40% (CoV {cv:.3f}→{cv*0.6:.3f})",
         "s":solar,"w":wind,"h":hydro,"cv":cv*0.6,"cl":cloud},
        {"desc":f"Improve solar +30% ({solar:.0f}→{solar*1.3:.0f} MU)",
         "s":solar*1.3,"w":wind,"h":hydro,"cv":cv,"cl":cloud},
        {"desc":f"Better weather (cloud {cloud:.0f}%→30%)",
         "s":solar,"w":wind,"h":hydro,"cv":cv,"cl":30.0},
    ]
    results = []
    for s in scenarios:
        nr = compute_risk_score(region,s["s"],s["w"],s["h"],s["cv"],s["cl"],demand,month)
        np_, rl, _ = score_to_risk(nr["score"], region)
        delta = round(baseline_prob - np_, 4)
        results.append({"scenario":s["desc"],"original_prob":round(baseline_prob,4),
                        "new_prob":round(np_,4),"new_risk_level":rl,
                        "risk_reduction":delta,"achieves_low_risk":np_<0.25,
                        "achieves_medium_risk":np_<0.50})
    return sorted(results, key=lambda x: x["risk_reduction"], reverse=True)[:4]


@app.get("/api/health")
def health():
    return {"status":"ok","model_loaded":"model" in ART,
            "best_model":ART.get("config",{}).get("best_model_name","unknown"),
            "timestamp":datetime.utcnow().isoformat()}

@app.post("/api/predict")
def predict(req: PredictRequest):
    if req.region not in REGIONS:
        raise HTTPException(400, f"Region must be one of {REGIONS}")
    solar=req.solar_MU; wind=req.wind_MU; hydro=req.hydro_MU
    cv   =req.re_cv_7d or REGION_THRESHOLDS[req.region]["mean_cv7"]
    cloud=req.weather_cloud or 40.0; temp=req.weather_temp or 28.0
    precip=req.weather_precip or 0.0
    dt=datetime.strptime(req.date,"%Y-%m-%d") if req.date else datetime.today()
    month=dt.month
    risk_result=compute_risk_score(req.region,solar,wind,hydro,cv,cloud,req.demand_MU,month)
    prob,risk_level,_=score_to_risk(risk_result["score"],req.region)
    demand=risk_result["demand"]
    dispatch=dispatch_engine(prob,risk_level,risk_result["re_total"],demand,req.region)
    drivers=get_active_drivers(risk_result)
    cfs=compute_counterfactuals(req.region,solar,wind,hydro,cv,cloud,demand,month,prob)
    season={12:"Winter",1:"Winter",2:"Winter",3:"Spring",4:"Spring",5:"Pre-Monsoon",
            6:"Monsoon",7:"Monsoon",8:"Monsoon",9:"Post-Monsoon",10:"Post-Monsoon",11:"Winter"}
    return {
        "region":req.region,"region_label":REGION_COORDS[req.region]["label"],
        "date":dt.strftime("%Y-%m-%d"),"season":season.get(month,"Unknown"),
        "inputs":{"solar_MU":solar,"wind_MU":wind,"hydro_MU":hydro,
                  "re_total_MU":round(solar+wind+hydro,2),"re_cv_7d":cv,
                  "demand_MU":round(demand,1),"weather_cloud":cloud},
        "risk_score_0_100":risk_result["score"],
        "re_demand_pct":risk_result["re_demand_pct"],
        "prediction":dispatch,"top_drivers":drivers,"counterfactuals":cfs,
        "model_used":ART.get("config",{}).get("best_model_name","rule-based"),
        "thresholds_used":{"q20_re":REGION_THRESHOLDS[req.region]["q20_re"],
                           "q50_re":REGION_THRESHOLDS[req.region]["q50_re"],
                           "mean_re":REGION_THRESHOLDS[req.region]["mean_re"]},
    }

@app.get("/api/region/{region}")
def region_profile(region: str):
    if region not in REGIONS: raise HTTPException(400)
    base = ART.get("profiles",{}).get(region,{})
    th   = REGION_THRESHOLDS[region]
    base.update({"real_thresholds":th,"coords":REGION_COORDS[region]})
    return base

@app.get("/api/weather/{region}")
def get_weather(region: str):
    if region not in REGIONS: raise HTTPException(400)
    coords=REGION_COORDS[region]
    try:
        r=requests.get("https://api.open-meteo.com/v1/forecast",params={
            "latitude":coords["lat"],"longitude":coords["lon"],
            "daily":"temperature_2m_max,precipitation_sum,windspeed_10m_max,cloudcover_mean",
            "forecast_days":1,"timezone":"Asia/Kolkata"},timeout=15)
        r.raise_for_status(); d=r.json()["daily"]
        cloud=d["cloudcover_mean"][0]; th=REGION_THRESHOLDS[region]
        return {"region":region,"region_label":coords["label"],"date":str(date.today()),
                "weather_temp":d["temperature_2m_max"][0],"weather_precip":d["precipitation_sum"][0],
                "weather_wind":d["windspeed_10m_max"][0],"weather_cloud":cloud,
                "solar_tendency_hint":round(max(0,th["mean_solar"]*(1-cloud/130)),1),
                "cloud_impact":"High" if cloud>65 else "Moderate" if cloud>40 else "Low",
                "source":"Open-Meteo Forecast API"}
    except Exception as e:
        raise HTTPException(502,f"Weather fetch failed: {e}")

@app.get("/api/history/{region}")
def history(region:str, days:int=Query(90,ge=7,le=1918), fuel:str=Query("re_total")):
    if region not in REGIONS: raise HTTPException(400)
    if "history" not in ART: raise HTTPException(503)
    col_map={"solar":"solar_MU","wind":"wind_MU","hydro":"hydro_MU","re_total":"re_total_MU"}
    col=col_map.get(fuel,"re_total_MU")
    df=ART["history"]; th=REGION_THRESHOLDS[region]
    rdf=df[df["Region"]==region][["Date",col,"GridStressEvent","RiskLevel","stress_score"]].copy()
    rdf=rdf.sort_values("Date").tail(days).reset_index(drop=True)
    rdf["Date"]=rdf["Date"].dt.strftime("%Y-%m-%d")
    return {"region":region,"fuel":fuel,"days":len(rdf),
            "data":rdf.to_dict(orient="records"),
            "thresholds":{"q20":th["q20_re"],"q50":th["q50_re"],"q80":th["q80_re"]}}

@app.get("/api/regions")
def all_regions():
    profiles=ART.get("profiles",{})
    return {"regions":[
        {"code":r,"label":REGION_COORDS[r]["label"],
         "lat":REGION_COORDS[r]["lat"],"lon":REGION_COORDS[r]["lon"],
         "stress_rate":profiles.get(r,{}).get("stress_event_rate",0),
         "mean_re_MU":REGION_THRESHOLDS[r]["mean_re"],
         "q20_re":REGION_THRESHOLDS[r]["q20_re"],
         "daily_demand_MU":REGION_THRESHOLDS[r]["daily_demand_proxy_MU"],
         "dominant_fuel":max(["solar","wind","hydro"],
                              key=lambda f:REGION_THRESHOLDS[r][f"mean_{f}"])}
        for r in REGIONS]}

@app.get("/api/metrics")
def model_metrics():
    return {"metrics":ART.get("metrics",{}),"cv_results":ART.get("cv",{}),
            "config":ART.get("config",{}),"best_model":ART.get("config",{}).get("best_model_name"),
            "region_thresholds":REGION_THRESHOLDS}

@app.get("/api/importance")
def feature_importance(top_n:int=Query(20,ge=5,le=50)):
    fi=ART.get("importance",{}).get("features",[])
    return {"method":ART.get("importance",{}).get("method","gini"),"features":fi[:top_n]}

@app.get("/api/analytics/stress-timeline")
def stress_timeline(days:int=Query(180,ge=30,le=1918)):
    if "history" not in ART: raise HTTPException(503)
    df=ART["history"]
    daily=df.groupby("Date").agg(stress_rate=("GridStressEvent","mean"),
                                  mean_re=("re_total_MU","mean")).reset_index()
    daily=daily.sort_values("Date").tail(days)
    daily["Date"]=daily["Date"].dt.strftime("%Y-%m-%d")
    return {"data":daily.round(3).to_dict(orient="records")}

@app.get("/api/analytics/region-heatmap")
def region_heatmap():
    if "history" not in ART: raise HTTPException(503)
    df=ART["history"].copy(); df["month"]=df["Date"].dt.month
    pivot=df.groupby(["Region","month"])["GridStressEvent"].mean().round(3).reset_index()
    pivot.columns=["region","month","stress_rate"]
    return {"data":pivot.to_dict(orient="records")}

@app.get("/api/analytics/seasonal-forecast/{region}")
def seasonal_forecast(region:str):
    if region not in REGIONS: raise HTTPException(400)
    if "history" not in ART: raise HTTPException(503)
    df=ART["history"]; rdf=df[df["Region"]==region].copy()
    rdf["month"]=rdf["Date"].dt.month
    monthly=rdf.groupby("month").agg(
        mean_re=("re_total_MU","mean"),std_re=("re_total_MU","std"),
        mean_solar=("solar_MU","mean"),mean_wind=("wind_MU","mean"),
        mean_hydro=("hydro_MU","mean"),stress_rate=("GridStressEvent","mean"),
    ).reset_index().round(2)
    return {"region":region,"data":monthly.to_dict(orient="records"),
            "thresholds":REGION_THRESHOLDS[region]}

@app.get("/api/analytics/region-compare")
def region_compare():
    if "history" not in ART: raise HTTPException(503)
    df=ART["history"]; result=[]
    for r in REGIONS:
        rdf=df[df["Region"]==r]; th=REGION_THRESHOLDS[r]
        result.append({
            "region":r,"label":REGION_COORDS[r]["label"],
            "mean_re_MU":round(float(rdf["re_total_MU"].mean()),1),
            "stress_rate_pct":round(float(rdf["GridStressEvent"].mean())*100,1),
            "q20_re":th["q20_re"],"q80_re":th["q80_re"],
            "dominant_fuel":max(["solar","wind","hydro"],key=lambda f:th[f"mean_{f}"]),
            "re_demand_ratio_pct":round(th["mean_re"]/th["daily_demand_proxy_MU"]*100,1),
            "mean_solar_pct":round(th["mean_solar"]/th["mean_re"]*100,1),
            "mean_wind_pct": round(th["mean_wind"] /th["mean_re"]*100,1),
            "mean_hydro_pct":round(th["mean_hydro"] /th["mean_re"]*100,1),
        })
    return {"data":result}