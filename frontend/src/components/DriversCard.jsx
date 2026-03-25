export default function DriversCard({ result }) {
  if (!result || !result.top_failure_drivers) return null;

  return (
    <div style={styles.card}>
      <h3>Top Failure Drivers</h3>
      <ul>
        {result.top_failure_drivers.map((item, idx) => (
          <li key={idx}>
            {item.feature}: {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  card: {
    background: "#111827",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
  },
};