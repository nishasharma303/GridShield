import { useState, useEffect } from 'react'
import { getStressTimeline, getRegionHeatmap, getAllRegions } from '../utils/api.js'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts'
import { REGIONS, MONTH_LABELS, REGION_META } from '../utils/helpers.js'
import { motion } from 'framer-motion'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FUEL_COLORS = { solar:'#f59e0b', wind:'#0ea5e9', hydro:'#10b981' }

// ── Stress colour helper ──────────────────────────────────────────────────────
function stressColor(v) {
  if (v > 0.50) return '#fca5a5'
  if (v > 0.35) return '#fdba74'
  if (v > 0.20) return '#fde68a'
  if (v > 0.10) return '#a7f3d0'
  return '#d1fae5'
}
function stressText(v) {
  if (v > 0.50) return '#7c2d12'
  if (v > 0.35) return '#9a3412'
  if (v > 0.20) return '#92400e'
  return '#065f46'
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-display text-slate-900 mb-4">{children}</h2>
}

// ── Fuel mix radar for all regions ────────────────────────────────────────────
function FuelMixRadar({ compareData }) {
  if (!compareData.length) return null
  return (
    <div className="card p-6">
      <SectionTitle>Renewable Mix by Region</SectionTitle>
      <p className="text-xs text-slate-500 mb-4 font-body">
        How each region's renewable generation is split between solar, wind, and hydro (% of total RE)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {compareData.map(r => (
          <div key={r.region} className="text-center">
            <div className="text-sm font-display text-slate-800 mb-2">{r.region}</div>
            <ResponsiveContainer width="100%" height={140}>
              <RadarChart data={[
                {axis:'Solar', val:r.mean_solar_pct},
                {axis:'Wind',  val:r.mean_wind_pct},
                {axis:'Hydro', val:r.mean_hydro_pct},
              ]}>
                <PolarGrid stroke="#e2e8f0"/>
                <PolarAngleAxis dataKey="axis" tick={{fontSize:9,fontFamily:'DM Sans',fill:'#64748b'}}/>
                <PolarRadiusAxis domain={[0,100]} tick={false}/>
                <Radar dataKey="val" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
            <div className="text-xs text-slate-400 font-body">
              Dom: <span className="font-500 text-slate-700 capitalize">{r.dominant_fuel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── RE vs Demand table ────────────────────────────────────────────────────────
function REDemandTable({ compareData }) {
  return (
    <div className="card p-6">
      <SectionTitle>RE Contribution vs Regional Demand</SectionTitle>
      <p className="text-xs text-slate-500 mb-4 font-body">
        Each region's average renewable generation as % of estimated daily regional demand.
        Low % = higher dependence on thermal backup.
      </p>
      <div className="space-y-3">
        {compareData.sort((a,b)=>b.re_demand_ratio_pct-a.re_demand_ratio_pct).map(r => (
          <div key={r.region}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-body font-500 text-slate-700">
                {r.region} — {r.label}
              </span>
              <span className="font-mono text-slate-600">
                {r.re_demand_ratio_pct}% of demand ({r.mean_re_MU} MU avg)
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{background: r.re_demand_ratio_pct > 30 ? '#10b981' : r.re_demand_ratio_pct > 15 ? '#f59e0b' : '#f43f5e'}}
                initial={{width:0}}
                animate={{width:`${Math.min(r.re_demand_ratio_pct,100)}%`}}
                transition={{duration:0.7}}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3 italic font-body">
        Demand estimated from regional population share of national grid (CEA data). 
        Actual demand varies daily with load patterns.
      </p>
    </div>
  )
}

// ── Stress heatmap ────────────────────────────────────────────────────────────
function StressHeatmap({ heatmap }) {
  const months = Array.from({length:12},(_,i)=>i+1)
  const rMap = {}
  heatmap.forEach(d => {
    if (!rMap[d.region]) rMap[d.region] = {}
    rMap[d.region][d.month] = d.stress_rate
  })
  return (
    <div className="card p-6 overflow-x-auto">
      <SectionTitle>Monthly Grid Stress Rate Heatmap</SectionTitle>
      <p className="text-xs text-slate-500 mb-4 font-body">
        How often each region-month historically experienced low renewable generation (stress events).
        High % = historically risky month for that region.
      </p>
      <table className="text-xs font-mono w-full">
        <thead>
          <tr>
            <th className="text-left pr-3 py-1.5 text-slate-400 font-body w-10">Region</th>
            {months.map(m=>(
              <th key={m} className="text-center px-1.5 py-1.5 text-slate-400 font-body">{MONTH_NAMES[m-1]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {REGIONS.map(r=>(
            <tr key={r}>
              <td className="pr-3 py-2 font-500 text-slate-700 font-body">{r}</td>
              {months.map(m=>{
                const v = rMap[r]?.[m] ?? 0
                return (
                  <td key={m} className="px-1 py-1 text-center">
                    <span className="inline-flex items-center justify-center w-10 h-6 rounded text-xs font-500"
                          style={{background:stressColor(v),color:stressText(v)}}>
                      {(v*100).toFixed(0)}%
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-body">
        <span>Low stress</span>
        {['#d1fae5','#a7f3d0','#fde68a','#fdba74','#fca5a5'].map(c=>(
          <span key={c} className="w-5 h-4 rounded inline-block" style={{background:c}}/>
        ))}
        <span>High stress</span>
      </div>
    </div>
  )
}

// ── National stress timeline ──────────────────────────────────────────────────
function StressTimeline({ timeline }) {
  return (
    <div className="card p-6">
      <SectionTitle>Historical Grid Stress Events (Last 180 Days of Training Data)</SectionTitle>
      <p className="text-xs text-slate-500 mb-4 font-body">
        Fraction of India's 5 regions simultaneously in a renewable stress event. 
        Peaks indicate days when multiple regions had low RE simultaneously — the most dangerous situation.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={timeline} margin={{top:4,right:4,left:-20,bottom:0}}>
          <defs>
            <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
          <XAxis dataKey="Date" tick={{fontSize:9,fontFamily:'JetBrains Mono'}} interval={29}/>
          <YAxis tick={{fontSize:9,fontFamily:'JetBrains Mono'}} tickFormatter={v=>`${(v*100).toFixed(0)}%`}/>
          <Tooltip formatter={v=>[`${(v*100).toFixed(1)}%`,'Stress Rate']}
                   contentStyle={{fontSize:11,fontFamily:'DM Sans',borderRadius:8,border:'1px solid #e2e8f0'}}/>
          <Area type="monotone" dataKey="stress_rate" stroke="#f43f5e"
                fill="url(#stressGrad)" strokeWidth={1.5} dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Region comparison bars ────────────────────────────────────────────────────
function RegionCompare({ compareData }) {
  return (
    <div className="card p-6">
      <SectionTitle>Region-wise Stress Rate & Mean RE Generation</SectionTitle>
      <p className="text-xs text-slate-500 mb-4 font-body">
        Based on 5 years (2017–2022) of actual POSOCO daily generation data.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={compareData} margin={{top:4,right:4,left:-16,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
          <XAxis dataKey="region" tick={{fontSize:10,fontFamily:'JetBrains Mono'}}/>
          <YAxis yAxisId="left"  tick={{fontSize:9}} tickFormatter={v=>`${v}MU`}/>
          <YAxis yAxisId="right" orientation="right" tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
          <Tooltip contentStyle={{fontSize:11,fontFamily:'DM Sans',borderRadius:8,border:'1px solid #e2e8f0'}}/>
          <Legend iconSize={10} wrapperStyle={{fontSize:11,fontFamily:'DM Sans'}}/>
          <Bar yAxisId="left"  dataKey="mean_re_MU"       name="Avg RE (MU)"     fill="#10b981" radius={[4,4,0,0]}/>
          <Bar yAxisId="right" dataKey="stress_rate_pct"  name="Stress Rate (%)" fill="#f43f5e" radius={[4,4,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Analytics page ───────────────────────────────────────────────────────
export default function Analytics() {
  const [timeline,    setTimeline]    = useState([])
  const [heatmap,     setHeatmap]     = useState([])
  const [compareData, setCompareData] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(()=>{
    Promise.all([
      getStressTimeline(180),
      getRegionHeatmap(),
      axios.get('/api/analytics/region-compare').then(r=>r.data),
    ]).then(([tl,hm,rc])=>{
      setTimeline(tl.data||[])
      setHeatmap(hm.data||[])
      setCompareData(rc.data||[])
    }).catch(console.error).finally(()=>setLoading(false))
  },[])

  // Summary stats from real thresholds
  const summaryStats = [
    {label:'Data Range',      val:'2017–2022',    sub:'5 years POSOCO daily'},
    {label:'Total Records',   val:'~9,500',       sub:'region-day rows'},
    {label:'Regions Covered', val:'5',            sub:'NR WR SR ER NER'},
    {label:'Most Stressed',   val:'SR (Winter)',  sub:'Nov–Jan highest risk'},
    {label:'Most Stable',     val:'NR',           sub:'lowest CoV'},
    {label:'Highest RE',      val:'NR',           sub:'avg 268 MU/day'},
  ]

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-display text-slate-900">Grid Intelligence</h1>
        <p className="text-sm text-slate-500 font-body mt-1">
          5 years of India's regional renewable generation patterns — stress trends, fuel mix, and demand coverage
        </p>
      </div>

      {/* Summary stats from real data */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryStats.map(s=>(
          <div key={s.label} className="card p-4 text-center">
            <div className="text-lg font-mono font-600 text-slate-800">{s.val}</div>
            <div className="text-xs font-body text-slate-500 mt-0.5">{s.label}</div>
            <div className="text-xs font-body text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(6).fill(0).map((_,i)=><div key={i} className="h-48 skeleton rounded-2xl"/>)}
        </div>
      ) : (
        <>
          <RegionCompare compareData={compareData}/>
          <REDemandTable compareData={compareData}/>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StressTimeline timeline={timeline}/>
            <FuelMixRadar compareData={compareData}/>
          </div>
          <StressHeatmap heatmap={heatmap}/>
        </>
      )}
    </div>
  )
}