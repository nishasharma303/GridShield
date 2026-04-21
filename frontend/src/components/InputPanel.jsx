import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getWeather } from '../utils/api.js'

// Realistic defaults from actual POSOCO 5-year median values
const REGION_DEFAULTS = {
  NR:  { solar:22,  wind:12,  hydro:200, demand:1050, cv:0.05 },
  WR:  { solar:22,  wind:55,  hydro:35,  demand:950,  cv:0.15 },
  SR:  { solar:65,  wind:65,  hydro:85,  demand:1100, cv:0.09 },
  ER:  { solar:2,   wind:0,   hydro:65,  demand:420,  cv:0.07 },
  NER: { solar:0.1, wind:0,   hydro:15,  demand:95,   cv:0.10 },
}

// Real Q20 thresholds — shown to operator so they know where the risk line is
const REGION_Q20 = {
  NR:158, WR:89, SR:179, ER:35, NER:8
}

function SliderRow({ label, val, set, min, max, step=1, color, unit='MU', note }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="label mb-0">{label}</label>
        <span className="text-xs font-mono font-500" style={{color}}>{val} {unit}</span>
      </div>
      {note && <div className="text-xs text-slate-400 font-body mb-1">{note}</div>}
      <input type="range" min={min} max={max} step={step} value={val}
             onChange={e=>set(Number(e.target.value))}
             className="w-full h-1.5 rounded-full outline-none cursor-pointer" style={{accentColor:color}}/>
      <input type="number" min={min} max={max} step={step} value={val}
             onChange={e=>set(Number(e.target.value))}
             className="input-field mt-1.5 text-xs"/>
    </div>
  )
}

export default function InputPanel({ region, onPredict, loading }) {
  const def = REGION_DEFAULTS[region] || REGION_DEFAULTS.SR
  const [solar,  setSolar]  = useState(def.solar)
  const [wind,   setWind]   = useState(def.wind)
  const [hydro,  setHydro]  = useState(def.hydro)
  const [demand, setDemand] = useState(def.demand)
  const [cv,     setCv]     = useState(def.cv)
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0])
  const [weather,setWeather]= useState(null)
  const [wLoad,  setWLoad]  = useState(false)
  const [wError, setWError] = useState('')
  const [useDemand, setUseDemand] = useState(false)

  // Reset when region changes
  useEffect(()=>{
    const d = REGION_DEFAULTS[region] || REGION_DEFAULTS.SR
    setSolar(d.solar); setWind(d.wind); setHydro(d.hydro)
    setDemand(d.demand); setCv(d.cv); setWeather(null)
  },[region])

  const reTotal   = solar + wind + hydro
  const q20       = REGION_Q20[region] || 100
  const belowQ20  = reTotal < q20

  const handleWeather = async () => {
    setWLoad(true); setWError('')
    try {
      const data = await getWeather(region)
      setWeather(data)
      // If weather suggests solar suppression, hint the user
      if (data.weather_cloud > 65 && data.solar_tendency_hint < solar) {
        // Don't auto-change — just surface the hint
      }
    } catch { setWError('Weather unavailable. Enter manually.') }
    finally { setWLoad(false) }
  }

  const submit = () => {
    if (!region) return
    onPredict({
      region,
      solar_MU: solar, wind_MU: wind, hydro_MU: hydro,
      demand_MU: useDemand ? demand : undefined,
      re_cv_7d: cv, date,
      weather_temp:   weather?.weather_temp,
      weather_precip: weather?.weather_precip,
      weather_wind:   weather?.weather_wind,
      weather_cloud:  weather?.weather_cloud,
    })
  }

  const demandCoverage = demand > 0 ? Math.round(reTotal / demand * 100) : 0

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="section-header mb-0">Today's Inputs</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">RE:</span>
          <span className={`text-xs font-mono font-600 ${belowQ20 ? 'text-rose-500' : 'text-emerald-600'}`}>
            {reTotal.toFixed(1)} MU
          </span>
          {belowQ20 && <span className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded font-body">⚠ Below Q20</span>}
        </div>
      </div>

      {/* Q20 reference bar */}
      <div className="bg-slate-50 rounded-xl p-3 text-xs font-body">
        <div className="flex justify-between text-slate-500 mb-1.5">
          <span>RE vs {region} stress threshold (Q20 = {q20} MU)</span>
          <span className={belowQ20 ? 'text-rose-500 font-500' : 'text-emerald-600 font-500'}>
            {belowQ20 ? `${(q20-reTotal).toFixed(0)} MU below threshold` : `${(reTotal-q20).toFixed(0)} MU above threshold`}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
          <div className="absolute top-0 h-full bg-rose-200 rounded-full"
               style={{width:`${Math.min(q20/500*100,80)}%`}}/>
          <div className="absolute top-0 h-full bg-emerald-400 rounded-full transition-all duration-500"
               style={{width:`${Math.min(reTotal/500*100,100)}%`}}/>
        </div>
        <div className="flex justify-between text-slate-400 mt-1">
          <span>0</span><span>Q20: {q20}</span><span>500 MU</span>
        </div>
      </div>

      <SliderRow label="Solar Generation" val={solar} set={setSolar} min={0} max={region==='NR'?100:region==='SR'?200:150}
                 color="#f59e0b" note={weather?.solar_tendency_hint ? `Weather hint: ~${weather.solar_tendency_hint} MU` : undefined}/>
      <SliderRow label="Wind Generation"  val={wind}  set={setWind}  min={0} max={region==='WR'?250:200} color="#0ea5e9"/>
      <SliderRow label="Hydro Generation" val={hydro} set={setHydro} min={0} max={region==='NR'?600:400} color="#10b981"/>

      {/* RE Volatility */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="label mb-0">RE Volatility (7-day CoV)</label>
          <span className={`text-xs font-mono font-500 ${cv > 0.15 ? 'text-rose-500' : 'text-violet-600'}`}>{cv.toFixed(3)}</span>
        </div>
        <div className="text-xs text-slate-400 font-body mb-1">
          {region} normal: ~{REGION_DEFAULTS[region]?.cv.toFixed(3)}. Above {(REGION_DEFAULTS[region]?.cv*1.3).toFixed(3)} = elevated instability.
        </div>
        <input type="range" min={0} max={0.8} step={0.005} value={cv}
               onChange={e=>setCv(Number(e.target.value))}
               className="w-full h-1.5 rounded-full" style={{accentColor:'#8b5cf6'}}/>
      </div>

      {/* Date */}
      <div>
        <label className="label">Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input-field"/>
      </div>

      {/* Demand input — optional */}
      <div className="border border-dashed border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-body font-500 text-slate-700">Include Demand (optional)</div>
            <div className="text-xs text-slate-400 font-body">Regional estimated demand in MU</div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-8 h-4 rounded-full transition-colors ${useDemand?'bg-emerald-500':'bg-slate-300'}`}
                 onClick={()=>setUseDemand(!useDemand)}>
              <div className={`w-3 h-3 bg-white rounded-full mt-0.5 shadow transition-transform ${useDemand?'translate-x-4 ml-0.5':'ml-0.5'}`}/>
            </div>
          </label>
        </div>
        {useDemand && (
          <div>
            <input type="number" value={demand} min={10} max={3000}
                   onChange={e=>setDemand(Number(e.target.value))}
                   className="input-field text-xs"/>
            <div className="text-xs text-slate-400 font-body mt-1.5">
              RE/Demand = <span className={`font-mono font-500 ${demandCoverage<20?'text-rose-500':demandCoverage<35?'text-amber-500':'text-emerald-600'}`}>
                {demandCoverage}%
              </span>
              {demandCoverage < 20 && ' — heavy thermal dependence'}
              {demandCoverage >= 20 && demandCoverage < 35 && ' — moderate RE coverage'}
              {demandCoverage >= 35 && ' — good RE coverage'}
            </div>
          </div>
        )}
        {!useDemand && (
          <div className="text-xs text-slate-400 font-body">
            If left off, system uses regional proxy (~{REGION_DEFAULTS[region]?.demand} MU)
          </div>
        )}
      </div>

      {/* Weather assist */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-body font-500 text-slate-600">Live Weather (Today)</span>
          <button onClick={handleWeather} disabled={wLoad||!region} className="btn-outline text-xs py-1.5 px-3">
            {wLoad ? 'Fetching…' : '⚡ Auto-fill Weather'}
          </button>
        </div>
        {wError && <p className="text-xs text-rose-500">{wError}</p>}
        {weather && (
          <motion.div className="grid grid-cols-2 gap-2" initial={{opacity:0}} animate={{opacity:1}}>
            {[
              {l:'Temperature', v:`${weather.weather_temp?.toFixed(1)}°C`, i:'🌡'},
              {l:'Cloud Cover', v:`${weather.weather_cloud?.toFixed(0)}%  (${weather.cloud_impact} solar impact)`, i:'☁️'},
              {l:'Wind Speed',  v:`${weather.weather_wind?.toFixed(1)} km/h`, i:'💨'},
              {l:'Precip',      v:`${weather.weather_precip?.toFixed(1)} mm`, i:'🌧'},
            ].map(({l,v,i})=>(
              <div key={l} className="bg-sky-50 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-1 text-slate-500 mb-0.5"><span>{i}</span>{l}</div>
                <div className="font-mono font-500 text-slate-800">{v}</div>
              </div>
            ))}
            {weather.solar_tendency_hint !== undefined && (
              <div className="col-span-2 text-xs bg-amber-50 rounded-lg px-3 py-2 text-amber-700 font-body">
                💡 Solar tendency based on cloud cover: ~{weather.solar_tendency_hint} MU
              </div>
            )}
          </motion.div>
        )}
      </div>

      <button className="btn-primary w-full text-sm py-3" onClick={submit} disabled={loading||!region}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
            Analysing…
          </span>
        ) : '⚡ Analyse Grid Risk'}
      </button>
    </div>
  )
}