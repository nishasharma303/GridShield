import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import ScenarioLab from "./pages/ScenarioLab";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ background: "#020617", minHeight: "100vh" }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/scenario" element={<ScenarioLab />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}