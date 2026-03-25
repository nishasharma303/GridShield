import { useEffect, useState } from "react";
import api from "../services/api";

export default function Analytics() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    api.get("/metrics")
      .then((res) => setMetrics(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={styles.page}>
      <h1>Analytics</h1>
      {metrics && (
        <div style={styles.card}>
          <p><strong>Best Model:</strong> {metrics.best_model}</p>
          <p><strong>Precision:</strong> {metrics.precision}</p>
          <p><strong>Recall:</strong> {metrics.recall}</p>
          <p><strong>F1:</strong> {metrics.f1}</p>
          <p><strong>ROC-AUC:</strong> {metrics.roc_auc}</p>
          <p><strong>PR-AUC:</strong> {metrics.pr_auc}</p>
        </div>
      )}
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
  card: {
    background: "#111827",
    padding: "16px",
    borderRadius: "12px",
  },
};