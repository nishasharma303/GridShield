from fastapi import APIRouter, HTTPException
from app.model_loader import load_master_data
from app.utils.region_stats import get_region_summary

router = APIRouter()


@router.get("/regions")
def list_regions():
    return {
        "regions": ["NR", "WR", "SR", "ER", "NER"]
    }


@router.get("/regions/{region}")
def region_summary(region: str):
    try:
        master_df = load_master_data()
        return get_region_summary(master_df, region)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))