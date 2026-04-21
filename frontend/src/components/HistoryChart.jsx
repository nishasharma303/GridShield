import { useState, useEffect } from 'react'
import { getHistory } from '../utils/api.js'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, Legend
} from 'recharts'
import { FUEL_COLORS } from '../utils/helpers.js'

const FUEL_OPTIONS = [
  { key: 're_total', label: 'Total RE',  color: '#8b5cf6' },
  { key: 'solar',    label: 'Solar',     color: '#f59e0b' },
  { key: 'wind',     label: 'Wind',      color: '#0ea5e9' },
  { key: 'hydro',    label: 'Hydro',     color: '#10b981' },
]

const DAY_OPTIONS = [30, 60, 90, 180, 365]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs font-body">
      <div className="font-500 text-slate-700 mb-1.5">{label}</div>
      <div className="font-mono text-slate-600">{d?.re_total_MU?.toFixed(1) ?? payload[0]?.value?.toFixed(1)} MU</div>
      {d?.GridStressEvent === 1 && (
        <div className="mt-1 text-rose-500 font-500">⚠ Stress Event</div>
      )}
    </div>
  )
}

export default function HistoryChart({ region }) {
  const [data, setData] = useState([])
  const [fuel, setFuel] = useState('re_total')
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(false)

  const fuelMeta = FUEL_OPTIONS.find(f => f.key === fuel) || FUEL_OPTIONS[0]
  const colKey = fuel === 're_total' ? 're_total_MU' : `${fuel}_MU`

  useEffect(() => {
    if (!region) return
    setLoading(true)
    getHistory(region, days, fuel)
      .then(r => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [region, days, fuel])

  const stressPoints = data.filter(d => d.GridStressEvent === 1)

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="section-header mb-0">Historical Generation</h3>
        <div className="flex gap-2 flex-wrap">
          {/* Fuel selector */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            {FUEL_OPTIONS.map(f => (
              <button
                key={f.key}
                onClick={() => setFuel(f.key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  fuel === f.key
                    ? 'bg-white shadow-sm font-500 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Days selector */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-2 py-1 rounded-md transition-all ${
                  days === d
                    ? 'bg-white shadow-sm font-500 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-48 skeleton rounded-xl" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={fuelMeta.color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={fuelMeta.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="Date"
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickFormatter={v => `${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={colKey}
              stroke={fuelMeta.color}
              strokeWidth={1.8}
              fill="url(#areaGrad)"
              dot={false}
              activeDot={{ r: 4, fill: fuelMeta.color }}
            />
            {stressPoints.map((pt, i) => (
              <ReferenceDot
                key={i}
                x={pt.Date}
                y={pt[colKey]}
                r={3}
                fill="#f43f5e"
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded" style={{ background: fuelMeta.color }} />
          {fuelMeta.label} (MU)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 border-2 border-white shadow-sm" />
          Stress event
        </span>
      </div>
    </div>
  )
}
