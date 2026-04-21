import { useState, useEffect } from 'react'
import axios from 'axios'
import { REGIONS, REGION_META, MONTH_LABELS, FUEL_COLORS } from '../utils/helpers.js'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, LineChart, Line
} from 'recharts'
import { motion } from 'framer-motion'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SEASON_COLORS = {
  "Winter":       "#93c5fd",
  "Spring":       "#86efac",
  "Pre-Monsoon":  "#fde68a",
  "Monsoon":      "#6ee7b7",
  "Post-Monsoon": "#c4b5fd",
}
const MONTH_SEASON = {
  1:"Winter",2:"Winter",3:"Spring",4:"Spring",5:"Pre-Monsoon",
  6:"Monsoon",7:"Monsoon",8:"Monsoon",9:"Post-Monsoon",10:"Post-Monsoon",
  11:"Winter",12:"Winter"
}

// What operational prep does each season need?
const SEASON_OPS = {
  "Winter":       {tip:"Low solar days. Wind also weak. Hydro draining. Highest backup procurement season.", icon:"❄️", action:"Pre-book thermal backup. Prioritise hydro reservoir management."},
  "Spring":       {tip:"Improving solar. Transition from winter. RE recovering toward summer peak.", icon:"🌸", action:"Begin reducing backup. Monitor solar ramp-up daily."},
  "Pre-Monsoon":  {tip:"Peak heat demand. Solar strong but wind picking up. Hydro starts recovering.", icon:"☀️", action:"Maximise solar dispatch. Wind backup beginning."},
  "Monsoon":      {tip:"Best renewable season. Wind peaks June–Aug. Hydro reservoirs fill.", icon:"🌧", action:"Maximise RE dispatch. Lowest backup needed. Store excess capacity planning."},
  "Post-Monsoon": {tip:"Wind declining. Hydro starts tapering. Solar returns to peak levels.", icon:"🍂", action:"Transition to solar-led dispatch. Pre-position for winter backup needs."},
}

function RiskBand({ value }) {
  const pct = Math.round(value * 100)
  const color = pct > 35 ? '#f43f5e' : pct > 20 ? '#f97316' : pct > 10 ? '#f59e0b' : '#10b981'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/>
      </div>
      <span className="text-xs font-mono font-500 w-8" style={{color}}>{pct}%</span>
    </div>
  )
}

function MonthCard({ month, data, isSelected, onClick }) {
  const season = MONTH_SEASON[month]
  const stressPct = Math.round((data?.stress_rate ?? 0) * 100)
  const riskColor = stressPct > 35 ? '#f43f5e' : stressPct > 20 ? '#f97316' : stressPct > 10 ? '#f59e0b' : '#10b981'
  return (
    <button
      onClick={onClick}
      className={`card p-3 text-left hover:shadow-card-hover border-2 transition-all ${isSelected ? 'border-emerald-400' : 'border-transparent'}`}
    >
      <div className="text-xs font-body text-slate-500 mb-0.5">{MONTH_SHORT[month-1]}</div>
      <div className="text-lg font-mono font-600" style={{color:riskColor}}>{stressPct}%</div>
      <div className="text-xs text-slate-400">stress</div>
      <div className="mt-1.5 text-xs text-slate-500 font-body truncate">{season}</div>
    </button>
  )
}

export default function SeasonalPlanner() {
  const [region,     setRegion]    = useState('SR')
  const [seasonal,   setSeasonal]  = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [selMonth,   setSelMonth]  = useState(null)

  useEffect(()=>{
    setLoading(true)
    axios.get(`/api/analytics/seasonal-forecast/${region}`)
      .then(r => { setSeasonal(r.data); setSelMonth(null) })
      .catch(console.error)
      .finally(()=>setLoading(false))
  },[region])

  const monthData = seasonal?.data || []
  const thresholds = seasonal?.thresholds || {}
  const selData = selMonth ? monthData.find(d=>d.month===selMonth) : null
  const selSeason = selMonth ? MONTH_SEASON[selMonth] : null
  const selOps = selSeason ? SEASON_OPS[selSeason] : null

  // Find the worst and best months
  const worstMonth  = monthData.reduce((a,b)=>((b.stress_rate||0)>(a.stress_rate||0)?b:a), monthData[0]||{})
  const bestMonth   = monthData.reduce((a,b)=>((b.stress_rate||0)<(a.stress_rate||0)?b:a), monthData[0]||{})
  const peakReMonth = monthData.reduce((a,b)=>((b.mean_re||0)>(a.mean_re||0)?b:a), monthData[0]||{})

  // Chart data: all 12 months
  const chartData = monthData.map(d=>({
    month: MONTH_SHORT[d.month-1],
    stress: Math.round((d.stress_rate||0)*100),
    solar: parseFloat((d.mean_solar||0).toFixed(1)),
    wind:  parseFloat((d.mean_wind||0).toFixed(1)),
    hydro: parseFloat((d.mean_hydro||0).toFixed(1)),
    re_total: parseFloat((d.mean_re||0).toFixed(1)),
    season: MONTH_SEASON[d.month],
  }))

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-display text-slate-900">Seasonal Planner</h1>
        <p className="text-sm text-slate-500 font-body mt-1">
          Historical renewable patterns by month — plan backup procurement and dispatch strategy seasonally
        </p>
      </div>

      {/* Region selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-body text-slate-600">Region:</span>
        {REGIONS.map(r=>(
          <button key={r}
            onClick={()=>setRegion(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-body transition-all border ${
              region===r ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                         : 'border-slate-200 text-slate-600 hover:border-emerald-300'
            }`}>
            {r}
          </button>
        ))}
        <span className="text-xs text-slate-400 font-body">{REGION_META[region]?.label}</span>
      </div>

      {loading ? <div className="h-80 skeleton rounded-2xl"/> : (
        <>
          {/* Key insights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {label:'Highest Risk Month', val:MONTH_SHORT[(worstMonth?.month||1)-1],
               sub:`${Math.round((worstMonth?.stress_rate||0)*100)}% stress rate`, color:'#f43f5e'},
              {label:'Safest Month',       val:MONTH_SHORT[(bestMonth?.month||7)-1],
               sub:`${Math.round((bestMonth?.stress_rate||0)*100)}% stress rate`,  color:'#10b981'},
              {label:'Peak RE Month',      val:MONTH_SHORT[(peakReMonth?.month||8)-1],
               sub:`${(peakReMonth?.mean_re||0).toFixed(0)} MU avg`,              color:'#8b5cf6'},
              {label:'Region Q20 Threshold', val:`${thresholds.q20_re} MU`,
               sub:'historical stress level',                                       color:'#f59e0b'},
            ].map(s=>(
              <div key={s.label} className="card p-4">
                <div className="text-xl font-mono font-600" style={{color:s.color}}>{s.val}</div>
                <div className="text-xs font-body text-slate-600 mt-0.5 font-500">{s.label}</div>
                <div className="text-xs font-body text-slate-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly overview cards — click any month */}
          <div>
            <div className="text-sm font-body text-slate-600 mb-3 font-500">
              Click a month to see detailed operational guidance
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
              {monthData.map(d=>(
                <MonthCard key={d.month} month={d.month} data={d}
                           isSelected={selMonth===d.month}
                           onClick={()=>setSelMonth(selMonth===d.month?null:d.month)}/>
              ))}
            </div>
          </div>

          {/* Month detail panel */}
          {selData && selOps && (
            <motion.div className="card p-6 border-2 border-emerald-200 bg-emerald-50/30"
                        initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selOps.icon}</span>
                    <h3 className="text-lg font-display text-slate-900">
                      {MONTH_SHORT[selData.month-1]} — {selSeason}
                    </h3>
                  </div>
                  <p className="text-sm font-body text-slate-600 mt-1">{selOps.tip}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Historical stress rate</div>
                  <div className="text-2xl font-mono font-600 text-rose-500">
                    {Math.round((selData.stress_rate||0)*100)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  {label:'Avg Solar',    val:`${(selData.mean_solar||0).toFixed(1)} MU`, color:FUEL_COLORS.solar},
                  {label:'Avg Wind',     val:`${(selData.mean_wind||0).toFixed(1)} MU`,  color:FUEL_COLORS.wind},
                  {label:'Avg Hydro',    val:`${(selData.mean_hydro||0).toFixed(1)} MU`, color:FUEL_COLORS.hydro},
                  {label:'Avg Total RE', val:`${(selData.mean_re||0).toFixed(1)} MU`,    color:'#8b5cf6'},
                ].map(s=>(
                  <div key={s.label} className="bg-white rounded-xl p-3 text-center border border-slate-100">
                    <div className="text-base font-mono font-600" style={{color:s.color}}>{s.val}</div>
                    <div className="text-xs font-body text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-4 border border-emerald-100">
                <div className="text-xs font-body text-slate-500 uppercase tracking-wide mb-1">
                  Operator Action for {MONTH_SHORT[selData.month-1]}
                </div>
                <div className="text-sm font-body text-slate-700 font-500">{selOps.action}</div>

                {/* Compare vs q20 threshold */}
                <div className="mt-3 text-xs font-body text-slate-500">
                  Average RE ({(selData.mean_re||0).toFixed(0)} MU) vs stress threshold ({thresholds.q20_re} MU):
                  <span className={`ml-1 font-500 ${(selData.mean_re||0) > thresholds.q20_re ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {(selData.mean_re||0) > thresholds.q20_re
                      ? `${((selData.mean_re||0) - thresholds.q20_re).toFixed(0)} MU above threshold — manageable`
                      : `${(thresholds.q20_re - (selData.mean_re||0)).toFixed(0)} MU BELOW threshold — backup critical`}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Full year RE chart */}
          <div className="card p-6">
            <h3 className="section-header">Monthly Average RE Generation (Fuel Breakdown)</h3>
            <p className="text-xs text-slate-500 mb-4 font-body">
              5-year historical average per month. The dashed line is the Q20 stress threshold — 
              months where RE typically dips below this line carry higher backup risk.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{top:4,right:4,left:-16,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{fontSize:10,fontFamily:'JetBrains Mono'}}/>
                <YAxis tick={{fontSize:9,fontFamily:'JetBrains Mono'}} tickFormatter={v=>`${v}`}/>
                <Tooltip contentStyle={{fontSize:11,fontFamily:'DM Sans',borderRadius:8,border:'1px solid #e2e8f0'}}
                         formatter={(v,n)=>[`${v} MU`,n]}/>
                <Legend iconSize={10} wrapperStyle={{fontSize:11,fontFamily:'DM Sans'}}/>
                <ReferenceLine y={thresholds.q20_re} stroke="#f43f5e" strokeDasharray="6 3"
                               label={{value:'Stress threshold (Q20)',position:'insideTopRight',fontSize:10,fill:'#f43f5e'}}/>
                <Bar dataKey="hydro"  name="Hydro"  stackId="a" fill={FUEL_COLORS.hydro}  radius={[0,0,0,0]}/>
                <Bar dataKey="wind"   name="Wind"   stackId="a" fill={FUEL_COLORS.wind}/>
                <Bar dataKey="solar"  name="Solar"  stackId="a" fill={FUEL_COLORS.solar}  radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stress rate line chart */}
          <div className="card p-6">
            <h3 className="section-header">Monthly Stress Event Rate — Operational Risk Calendar</h3>
            <p className="text-xs text-slate-500 mb-4 font-body">
              How often this region experienced a grid stress event in each month across 5 years.
              Use this to pre-plan backup procurement contracts and maintenance windows.
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{top:4,right:4,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="stressArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="month" tick={{fontSize:10,fontFamily:'JetBrains Mono'}}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>`${v}%`} domain={[0,'dataMax+5']}/>
                <Tooltip formatter={v=>[`${v}%`,'Stress Rate']}
                         contentStyle={{fontSize:11,fontFamily:'DM Sans',borderRadius:8}}/>
                <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="4 3"
                               label={{value:'25% caution',fontSize:9,fill:'#f59e0b'}}/>
                <Area type="monotone" dataKey="stress" stroke="#f43f5e"
                      fill="url(#stressArea)" strokeWidth={2} dot={{r:4,fill:'#f43f5e',strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-body">
              {Object.entries(SEASON_OPS).map(([s,v])=>(
                <div key={s} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                  <span>{v.icon}</span>
                  <div><div className="font-500 text-slate-700">{s}</div>
                  <div className="text-slate-400 leading-tight">{v.action.split('.')[0]}</div></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}