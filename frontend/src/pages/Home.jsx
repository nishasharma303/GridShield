export default function Home() {
  return (
    <div style={styles.page}>
      <h1>GridShield+</h1>
      <p>
        An explainable failure-aware renewable dispatch system for regional grid reliability.
      </p>
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
};