import { useState } from 'react'
import { predictRisk } from '../utils/api.js'
import { REGIONS, REGION_META, RISK_CONFIG, formatProb, formatMU } from '../utils/helpers.js'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid
} from 'recharts'

const PRESETS = [
  {
    label: 'Peak Summer Day',
    desc: 'High solar, low hydro, extreme heat',
    icon: '☀️',
    values: { solar: 120, wind: 40, hydro: 60, cv: 0.25, cloud: 15, temp: 42, wind_speed: 12, precip: 0 },
  },
  {
    label: 'Deep Monsoon Day',
    desc: 'Low solar, high wind, strong hydro',
    icon: '🌧',
    values: { solar: 20, wind: 90, hydro: 250, cv: 0.38, cloud: 85, temp: 28, wind_speed: 35, precip: 45 },
  },
  {
    label: 'Stress Scenario',
    desc: 'All fuels suppressed simultaneously',
    icon: '⚡',
    values: { solar: 15, wind: 10, hydro: 40, cv: 0.55, cloud: 75, temp: 38, wind_speed: 8, precip: 2 },
  },
  {
    label: 'Optimal Conditions',
    desc: 'Peak across all renewable sources',
    icon: '✅',
    values: { solar: 160, wind: 100, hydro: 300, cv: 0.10, cloud: 10, temp: 26, wind_speed: 30, precip: 15 },
  },
]

function Slider({ label, val, set, min, max, step = 0.5, color, unit = 'MU' }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="label mb-0">{label}</label>
        <span className="text-xs font-mono font-500" style={{ color }}>{val} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={val} onChange={e => set(Number(e.target.value))}
        className="w-full h-2 rounded-full" style={{ accentColor: color }}
      />
    </div>
  )
}

export default function ScenarioLab() {
  const [region, setRegion] = useState('SR')
  const [solar,  setSolar]  = useState(75)
  const [wind,   setWind]   = useState(65)
  const [hydro,  setHydro]  = useState(200)
  const [cv,     setCv]     = useState(0.22)
  const [cloud,  setCloud]  = useState(40)
  const [temp,   setTemp]   = useState(30)
  const [windSpd,setWindSpd]= useState(15)
  const [precip, setPrecip] = useState(5)

  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [history, setHistory]   = useState([])  // scenario comparison history

  const runScenario = async () => {
    setLoading(true)
    try {
      const payload = {
        region,
        solar_MU: solar, wind_MU: wind, hydro_MU: hydro,
        re_cv_7d: cv,
        weather_cloud: cloud, weather_temp: temp,
        weather_wind: windSpd, weather_precip: precip,
        date: new Date().toISOString().split('T')[0],
      }
      const r = await predictRisk(payload)
      setResult(r)
      setHistory(prev => [
        { id: Date.now(), region, solar, wind, hydro, cv, prob: r.prediction.failure_probability, risk: r.prediction.risk_level },
        ...prev.slice(0, 7)
      ])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (p) => {
    const v = p.values
    setSolar(v.solar); setWind(v.wind); setHydro(v.hydro)
    setCv(v.cv); setCloud(v.cloud); setTemp(v.temp)
    setWindSpd(v.wind_speed); setPrecip(v.precip)
  }

  const reTotal = solar + wind + wind + hydro
  const cfg     = result ? (RISK_CONFIG[result.prediction.risk_level] || RISK_CONFIG.Low) : null

  // Radar data
  const radarData = [
    { axis: 'Solar',     val: Math.min(solar / 200 * 100, 100) },
    { axis: 'Wind',      val: Math.min(wind  / 250 * 100, 100) },
    { axis: 'Hydro',     val: Math.min(hydro / 600 * 100, 100) },
    { axis: 'Stability', val: Math.max(0, (1 - cv) * 100) },
    { axis: 'Weather',   val: Math.max(0, (1 - cloud / 100) * 100) },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-display text-slate-900">Scenario Lab</h1>
        <p className="text-sm text-slate-500 font-body mt-1">
          Adjust renewable and weather inputs interactively to explore risk across any scenario
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="card p-4 text-left hover:shadow-card-hover hover:border-emerald-200 border-2 border-transparent transition-all"
          >
            <div className="text-2xl mb-1">{p.icon}</div>
            <div className="text-sm font-display text-slate-900">{p.label}</div>
            <div className="text-xs text-slate-400 font-body mt-0.5">{p.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
        <div className="lg:col-span-4 card p-6 space-y-4">
          <div>
            <label className="label">Region</label>
            <select
              className="input-field"
              value={region}
              onChange={e => setRegion(e.target.value)}
            >
              {REGIONS.map(r => (
                <option key={r} value={r}>{r} — {REGION_META[r]?.label}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-body uppercase tracking-wide pt-2">Generation Inputs</div>
          <Slider label="Solar"  val={solar}  set={setSolar}  min={0} max={200} color="#f59e0b" />
          <Slider label="Wind"   val={wind}   set={setWind}   min={0} max={250} color="#0ea5e9" />
          <Slider label="Hydro"  val={hydro}  set={setHydro}  min={0} max={600} color="#10b981" />
          <Slider label="RE Volatility (CoV)" val={cv} set={setCv} min={0} max={1} step={0.01} color="#8b5cf6" unit="" />

          <div className="text-xs text-slate-500 font-body uppercase tracking-wide pt-2">Weather Inputs</div>
          <Slider label="Cloud Cover"  val={cloud}   set={setCloud}   min={0} max={100} color="#94a3b8" unit="%" />
          <Slider label="Temperature"  val={temp}    set={setTemp}    min={5} max={50}  color="#f97316" unit="°C" />
          <Slider label="Wind Speed"   val={windSpd} set={setWindSpd} min={0} max={60}  color="#0284c7" unit="km/h" />
          <Slider label="Precipitation"val={precip}  set={setPrecip}  min={0} max={100} color="#6366f1" unit="mm" />

          <button
            className="btn-primary w-full mt-2"
            onClick={runScenario}
            disabled={loading}
          >
            {loading ? 'Running…' : '⚡ Run Scenario'}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-4 space-y-4">
          {/* Radar */}
          <div className="card p-5">
            <h3 className="section-header">Scenario Profile</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#64748b' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                <Radar
                  name="Scenario"
                  dataKey="val"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Result card */}
          <AnimatePresence>
            {result && (
              <motion.div
                className="card p-5 border-2"
                style={{ borderColor: cfg.border, background: cfg.bg }}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Risk Level</div>
                    <div className="text-3xl font-display" style={{ color: cfg.color }}>
                      {result.prediction.risk_level}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Failure Prob</div>
                    <div className="text-2xl font-mono font-600" style={{ color: cfg.color }}>
                      {formatProb(result.prediction.failure_probability)}
                    </div>
                  </div>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: cfg.color, width: `${result.prediction.failure_probability * 100}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${result.prediction.failure_probability * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Safe RE: </span><span className="font-mono font-500 text-emerald-600">{formatMU(result.prediction.safe_re_MU)}</span></div>
                  <div><span className="text-slate-400">Backup: </span><span className="font-mono font-500 text-rose-500">{formatMU(result.prediction.backup_needed_MU)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/40 text-xs text-slate-600">
                  {result.prediction.action_text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {result?.counterfactuals?.length > 0 && (
            <div className="card p-5">
              <h3 className="section-header">Quick Actions</h3>
              <div className="space-y-2">
                {result.counterfactuals.slice(0, 3).map((cf, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600">{cf.scenario}</span>
                    <span className={`font-mono font-500 ${cf.achieves_medium_risk ? 'text-emerald-600' : 'text-slate-500'}`}>
                      → {formatProb(cf.new_prob)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="lg:col-span-4 card p-5">
          <h3 className="section-header">Scenario History</h3>
          {history.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-body">
              Run a scenario to begin
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={history.slice().reverse()} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="region" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                  <YAxis domain={[0,1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => [formatProb(v), 'Prob']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="prob" radius={[4,4,0,0]}>
                    {history.slice().reverse().map((h, i) => (
                      <Cell key={i} fill={
                        h.prob < 0.30 ? '#10b981' : h.prob < 0.55 ? '#f59e0b' : h.prob < 0.75 ? '#f97316' : '#f43f5e'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {history.slice(0, 5).map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-500">{h.region} | S:{h.solar} W:{h.wind} H:{h.hydro}</span>
                    <span style={{ color: RISK_CONFIG[h.risk]?.color }}>{formatProb(h.prob)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
