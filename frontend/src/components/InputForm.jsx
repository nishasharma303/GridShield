import { useState } from "react";

export default function InputForm({ region, onSubmit, onFetchWeather }) {
  const [form, setForm] = useState({
    date: "2023-07-15",
    solar_mu: "18.5",
    wind_mu: "42.3",
    hydro_mu: "30.1",
    demand_mu: "145.0",
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!region) {
      alert("Select a region first");
      return;
    }

    if (!form.date || !form.solar_mu || !form.wind_mu || !form.hydro_mu || !form.demand_mu) {
      alert("Fill all values including date and demand");
      return;
    }

    onSubmit({
      region,
      date: form.date,
      solar_mu: Number(form.solar_mu),
      wind_mu: Number(form.wind_mu),
      hydro_mu: Number(form.hydro_mu),
      demand_mu: Number(form.demand_mu),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3>Grid Inputs</h3>

      <label>Date</label>
      <input type="date" name="date" value={form.date} onChange={handleChange} />

      <label>Solar MU</label>
      <input type="number" step="0.01" name="solar_mu" value={form.solar_mu} onChange={handleChange} />

      <label>Wind MU</label>
      <input type="number" step="0.01" name="wind_mu" value={form.wind_mu} onChange={handleChange} />

      <label>Hydro MU</label>
      <input type="number" step="0.01" name="hydro_mu" value={form.hydro_mu} onChange={handleChange} />

      <label>Demand MU</label>
      <input type="number" step="0.01" name="demand_mu" value={form.demand_mu} onChange={handleChange} />

      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
        <button type="button" onClick={() => onFetchWeather(region)}>
          Fetch Live Weather
        </button>
        <button type="submit">Run GridShield</button>
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "#111827",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
  },
};