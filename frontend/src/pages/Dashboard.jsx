import { useState, useEffect } from 'react'
import { predictRisk, getAllRegions, getRegionProfile } from '../utils/api.js'
import IndiaRegionMap    from '../components/IndiaRegionMap.jsx'
import InputPanel        from '../components/InputPanel.jsx'
import RiskCard          from '../components/RiskCard.jsx'
import DispatchPanel     from '../components/DispatchPanel.jsx'
import DriverExplanation from '../components/DriverExplanation.jsx'
import CounterfactualPanel from '../components/CounterfactualPanel.jsx'
import HistoryChart      from '../components/HistoryChart.jsx'
import { REGION_META }   from '../utils/helpers.js'

// Demand coverage ring
function DemandRing({ pct, demand, reTotal }) {
  const r = 36, circ = 2 * Math.PI * r
  const dashOffset = circ - (pct / 100) * circ
  const color = pct < 20 ? '#f43f5e' : pct < 35 ? '#f59e0b' : '#10b981'
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7"/>
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
                  strokeDasharray={circ} strokeDashoffset={dashOffset}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{transition:'stroke-dashoffset 0.8s ease'}}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-mono font-600" style={{color}}>{pct}%</span>
          <span className="text-xs text-slate-400">RE/demand</span>
        </div>
      </div>
      <div className="text-xs font-body space-y-1">
        <div><span className="text-slate-400">RE Total: </span><span className="font-mono font-500 text-emerald-600">{reTotal?.toFixed(1)} MU</span></div>
        <div><span className="text-slate-400">Demand: </span><span className="font-mono font-500 text-slate-700">~{demand?.toFixed(0)} MU</span></div>
        <div className="text-slate-400 text-xs">
          {pct < 20 ? 'Heavy thermal dependence' : pct < 35 ? 'Moderate RE coverage' : 'Good RE coverage'}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [selectedRegion, setSelectedRegion]  = useState(null)
  const [regionSummary,  setRegionSummary]   = useState({})
  const [profile,        setProfile]         = useState(null)
  const [prediction,     setPrediction]      = useState(null)
  const [predLoading,    setPredLoading]     = useState(false)
  const [profileLoading, setProfileLoading]  = useState(false)
  const [error,          setError]           = useState('')

  useEffect(()=>{
    getAllRegions().then(data=>{
      const map={}; data.regions.forEach(r=>{map[r.code]=r}); setRegionSummary(map)
    }).catch(()=>{})
  },[])

  useEffect(()=>{
    if (!selectedRegion) return
    setProfileLoading(true); setPrediction(null); setError('')
    getRegionProfile(selectedRegion)
      .then(setProfile).catch(()=>setProfile(null))
      .finally(()=>setProfileLoading(false))
  },[selectedRegion])

  const handlePredict = async (payload) => {
    setPredLoading(true); setError('')
    try { setPrediction(await predictRisk(payload)) }
    catch (e) { setError(e.response?.data?.detail || 'Prediction failed — check backend is running.') }
    finally { setPredLoading(false) }
  }

  const pred = prediction?.prediction
  const reDemandPct = prediction?.re_demand_pct || 0

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-2xl font-display text-slate-900">Operational Dashboard</h1>
        <p className="text-sm text-slate-500 font-body mt-1">
          Daily grid operator view — enter today's renewable generation, get risk level, dispatch recommendation, and corrective actions
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-body">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT: Map */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-header mb-0">Select Region</h3>
              {selectedRegion && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{selectedRegion}</span>}
            </div>
            <IndiaRegionMap selectedRegion={selectedRegion} onRegionClick={setSelectedRegion} regionData={regionSummary}/>
            {!selectedRegion && <p className="text-xs text-center text-slate-400 mt-3 font-body">Click a region to begin</p>}
          </div>

          {/* Region snapshot — real data only */}
          {selectedRegion && profile && !profileLoading && (
            <div className="card p-4 space-y-3">
              <h3 className="text-sm font-display text-slate-800">
                {REGION_META[selectedRegion]?.label}
              </h3>
              <p className="text-xs text-slate-400 font-body">{REGION_META[selectedRegion]?.states}</p>

              {/* Real thresholds from data */}
              {profile.real_thresholds && (
                <div className="space-y-1.5">
                  {[
                    {label:'5yr Mean RE',  val:`${profile.real_thresholds.mean_re} MU`, color:'#8b5cf6'},
                    {label:'Stress Q20',   val:`${profile.real_thresholds.q20_re} MU`,  color:'#f43f5e'},
                    {label:'Good Day Q80', val:`${profile.real_thresholds.q80_re} MU`,  color:'#10b981'},
                    {label:'Avg Solar',    val:`${profile.real_thresholds.mean_solar} MU`, color:'#f59e0b'},
                    {label:'Avg Wind',     val:`${profile.real_thresholds.mean_wind} MU`,  color:'#0ea5e9'},
                    {label:'Avg Hydro',    val:`${profile.real_thresholds.mean_hydro} MU`, color:'#10b981'},
                  ].map(s=>(
                    <div key={s.label} className="flex justify-between text-xs">
                      <span className="text-slate-500 font-body">{s.label}</span>
                      <span className="font-mono font-500" style={{color:s.color}}>{s.val}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-400 font-body pt-1 border-t border-slate-100">
                Based on 2017–2022 POSOCO daily records
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Inputs + history */}
        <div className="lg:col-span-4 space-y-4">
          {selectedRegion ? (
            <InputPanel region={selectedRegion} onPredict={handlePredict} loading={predLoading}/>
          ) : (
            <div className="card p-10 flex flex-col items-center justify-center text-center text-slate-400 gap-3 h-80">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 16l4.553-2.276A1 1 0 0021 19.382V8.618a1 1 0 00-.553-.894L15 5m0 15V5m0 0L9 7"/>
              </svg>
              <p className="text-sm font-body">Select a region from the map to start</p>
            </div>
          )}
          {selectedRegion && <HistoryChart region={selectedRegion}/>}
        </div>

        {/* RIGHT: Results */}
        <div className="lg:col-span-5 space-y-4">
          <RiskCard prediction={prediction} loading={predLoading}/>

          {/* Demand/RE ring — shows when prediction exists */}
          {prediction && (
            <div className="card p-5">
              <div className="text-sm font-display text-slate-800 mb-3">RE vs Demand Coverage</div>
              <DemandRing
                pct={reDemandPct}
                demand={prediction.inputs?.demand_MU}
                reTotal={prediction.inputs?.re_total_MU}
              />
              <div className="mt-3 text-xs text-slate-400 font-body">
                {prediction.inputs?.demand_MU && prediction.inputs.demand_MU !== (profile?.real_thresholds?.daily_demand_proxy_MU)
                  ? 'Using your provided demand value'
                  : `Using regional proxy demand (~${prediction.inputs?.demand_MU} MU). Enter actual demand above for precision.`}
              </div>
            </div>
          )}

          <DispatchPanel prediction={prediction} loading={predLoading}/>
          <DriverExplanation prediction={prediction} loading={predLoading}/>
          <CounterfactualPanel prediction={prediction} loading={predLoading}/>
        </div>
      </div>

      {/* All regions quick bar */}
      {Object.keys(regionSummary).length > 0 && (
        <div className="mt-8">
          <h2 className="section-header mb-3">All Regions — Historical Stress Rates</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.values(regionSummary).map(r=>{
              const sr = r.stress_rate||0
              const color = sr<0.10?'#10b981':sr<0.20?'#f59e0b':sr<0.35?'#f97316':'#f43f5e'
              return (
                <button key={r.code} onClick={()=>setSelectedRegion(r.code)}
                        className={`card p-4 text-left hover:shadow-card-hover transition-all border-2 ${selectedRegion===r.code?'border-emerald-400':'border-transparent'}`}>
                  <div className="text-xs font-mono font-500 text-slate-500 mb-1">{r.code}</div>
                  <div className="text-sm font-display text-slate-900 leading-tight mb-1">
                    {r.label?.replace(' Region','')}
                  </div>
                  <div className="text-xl font-mono font-600 mb-0.5" style={{color}}>
                    {Math.round(sr*100)}%
                  </div>
                  <div className="text-xs text-slate-400 font-body">historical stress</div>
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${Math.min(sr*100,100)}%`,background:color}}/>
                  </div>
                  <div className="text-xs text-slate-400 font-body mt-1">
                    Q20: {r.q20_re} MU | mean: {r.mean_re_MU} MU
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 font-body mt-2 italic">
            Stress rate = fraction of days (2017–2022) when regional RE was in bottom 20th percentile.
          </p>
        </div>
      )}
    </div>
  )
}