export default function DispatchCard({ result }) {
  if (!result) return null;

  return (
    <div style={styles.card}>
      <h3>Dispatch Decision</h3>
      <p><strong>Total Renewable:</strong> {result.total_renewable_mu} MU</p>
      <p><strong>Safe RE to use:</strong> {result.safe_re_mu} MU</p>
      <p><strong>RE Withheld:</strong> {result.re_withheld_mu} MU</p>
      <p><strong>Backup Needed:</strong> {result.backup_needed_mu} MU</p>
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