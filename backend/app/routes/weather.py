import requests
from fastapi import APIRouter, HTTPException
from app.config import OPENWEATHER_API_KEY

router = APIRouter()

REGION_CITY_MAP = {
    "NR": "Delhi",
    "WR": "Mumbai",
    "SR": "Chennai",
    "ER": "Kolkata",
    "NER": "Guwahati",
}


@router.get("/weather/{region}")
def get_weather(region: str):
    region = region.upper()
    city = REGION_CITY_MAP.get(region)

    if not city:
        raise HTTPException(status_code=400, detail="Invalid region code")

    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENWEATHER_API_KEY not configured")

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather request failed: {str(e)}")

    if response.status_code != 200:
        detail = data.get("message", response.text)
        raise HTTPException(status_code=response.status_code, detail=f"Weather API error: {detail}")

    clouds = data.get("clouds", {}).get("all", 0)
    wind_speed = data.get("wind", {}).get("speed", 0)
    temp = data.get("main", {}).get("temp", 0)
    humidity = data.get("main", {}).get("humidity", 0)
    description = data.get("weather", [{}])[0].get("description", "")

    return {
        "region": region,
        "city": city,
        "temperature_c": temp,
        "wind_speed_mps": wind_speed,
        "cloud_cover_pct": clouds,
        "humidity_pct": humidity,
        "description": description,
    }