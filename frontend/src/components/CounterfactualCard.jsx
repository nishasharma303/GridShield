export default function CounterfactualCard({ result }) {
  if (!result || !result.counterfactual_options) return null;

  return (
    <div style={styles.card}>
      <h3>Counterfactual Options</h3>
      {result.counterfactual_options.map((option, idx) => (
        <div key={idx} style={styles.option}>
          <h4>{option.title}</h4>
          <p>{option.description}</p>
          <p>
            New Risk: {(option.new_failure_probability * 100).toFixed(2)}% ({option.new_risk_level})
          </p>
        </div>
      ))}
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
  option: {
    borderTop: "1px solid #334155",
    paddingTop: "12px",
    marginTop: "12px",
  },
};