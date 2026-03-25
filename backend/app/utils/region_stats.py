def get_region_summary(master_df, region: str):
    region = region.upper()
    df = master_df[master_df["region"] == region].copy()

    if df.empty:
        raise ValueError(f"No data for region {region}")

    return {
        "region": region,
        "avg_total_renewable_mu": round(df["total_renewable_mu"].mean(), 4) if "total_renewable_mu" in df.columns else 0.0,
        "avg_solar_mu": round(df["solar_mu"].mean(), 4) if "solar_mu" in df.columns else 0.0,
        "avg_wind_mu": round(df["wind_mu"].mean(), 4) if "wind_mu" in df.columns else 0.0,
        "avg_hydro_mu": round(df["hydro_mu"].mean(), 4) if "hydro_mu" in df.columns else 0.0,
        "total_rows": int(len(df)),
    }