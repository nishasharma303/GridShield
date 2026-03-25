def generate_top_drivers(input_df):
    row = input_df.iloc[0].to_dict()

    important_features = [
        "hydro_mu",
        "total_renewable_mu",
        "total_renewable_mu_cv7",
        "hydro_mu_cv7",
        "wind_mu",
        "solar_mu",
    ]

    drivers = []
    for feature in important_features:
        if feature in row:
            drivers.append({
                "feature": feature,
                "value": round(float(row[feature]), 4)
            })

    return drivers[:3]