import { REGIONS } from "../data/region";

export default function RegionMap({ selectedRegion, onSelect }) {
  return (
    <div>
      <h3>Select Region</h3>
      <div style={styles.grid}>
        {REGIONS.map((region) => (
          <button
            key={region.code}
            onClick={() => onSelect(region.code)}
            style={{
              ...styles.card,
              border:
                selectedRegion === region.code
                  ? "2px solid #38bdf8"
                  : "1px solid #334155",
            }}
          >
            <strong>{region.code}</strong>
            <div>{region.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
    gap: "12px",
  },
  card: {
    background: "#111827",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
    cursor: "pointer",
  },
};