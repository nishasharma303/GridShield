export default function StatCard({ title, value, subtitle }) {
  return (
    <div style={styles.card}>
      <p style={styles.title}>{title}</p>
      <h2 style={styles.value}>{value}</h2>
      {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
    </div>
  );
}

const styles = {
  card: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "16px",
    color: "white",
  },
  title: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "14px",
  },
  value: {
    margin: "8px 0",
    fontSize: "28px",
  },
  subtitle: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "13px",
  },
};