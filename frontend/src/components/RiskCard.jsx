export default function RiskCard({ result }) {
  if (!result) return null;

  return (
    <div style={styles.card}>
      <h3>Risk Assessment</h3>
      <p><strong>Region:</strong> {result.region}</p>
      <p><strong>Date:</strong> {result.date}</p>
      <p><strong>Failure Probability:</strong> {(result.failure_probability * 100).toFixed(2)}%</p>
      <p><strong>Risk Level:</strong> {result.risk_level}</p>
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