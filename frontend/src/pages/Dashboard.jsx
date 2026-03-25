import { useState } from "react";
import api from "../services/api";
import RegionMap from "../components/RegionMap";
import InputForm from "../components/InputForm";
import RiskCard from "../components/RiskCard";
import DispatchCard from "../components/DispatchCard";
import DriversCard from "../components/DriversCard";
import CounterfactualCard from "../components/CounterfactualCard";

export default function Dashboard() {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [result, setResult] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async (payload) => {
    try {
      setLoading(true);
      const res = await api.post("/predict", payload);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWeather = async (region) => {
    if (!region) return alert("Select a region first");
    try {
      const res = await api.get(`/weather/${region}`);
      setWeather(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.page}>
      <h1>GridShield Dashboard</h1>

      <div style={styles.layout}>
        <div style={styles.column}>
          <RegionMap selectedRegion={selectedRegion} onSelect={setSelectedRegion} />
          {weather && (
            <div style={styles.card}>
              <h3>Weather Snapshot</h3>
              <p><strong>City:</strong> {weather.city}</p>
              <p><strong>Temperature:</strong> {weather.temperature_c} °C</p>
              <p><strong>Wind Speed:</strong> {weather.wind_speed}</p>
              <p><strong>Cloud Cover:</strong> {weather.cloud_cover}%</p>
              <p>{weather.weather_note}</p>
            </div>
          )}
        </div>

        <div style={styles.column}>
          <InputForm
            region={selectedRegion}
            onSubmit={handlePredict}
            onFetchWeather={handleWeather}
          />
          {loading && <p style={{ color: "white" }}>Running prediction...</p>}
        </div>

        <div style={styles.column}>
          <RiskCard result={result} />
          <DispatchCard result={result} />
        </div>
      </div>

      <div style={styles.bottomGrid}>
        <DriversCard result={result} />
        <CounterfactualCard result={result} />
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
    color: "white",
    background: "#020617",
    minHeight: "100vh",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "20px",
  },
  card: {
    background: "#111827",
    padding: "16px",
    borderRadius: "12px",
  },
};