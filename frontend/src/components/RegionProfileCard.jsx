import { motion } from 'framer-motion'
import { formatMU, REGION_META } from '../utils/helpers.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { MONTH_LABELS } from '../utils/helpers.js'

export default function RegionProfileCard({ region, profile, loading }) {
  if (loading) return <div className="card p-6 h-64 skeleton" />
  if (!region || !profile) return null

  const meta = REGION_META[region] || {}

  const monthlyData = Object.entries(profile.monthly_stress_rate || {}).map(([m, v]) => ({
    month: MONTH_LABELS[parseInt(m) - 1],
    stress: Math.round(v * 100),
  }))

  const fuelDominance = [
    { fuel: 'Solar', val: profile.mean_solar_MU, color: '#f59e0b' },
    { fuel: 'Wind',  val: profile.mean_wind_MU,  color: '#0ea5e9' },
    { fuel: 'Hydro', val: profile.mean_hydro_MU, color: '#10b981' },
  ]

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-display text-slate-900">{profile.label || meta.label}</h3>
          <p className="text-xs text-slate-400 font-body mt-0.5">{meta.states}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-display text-rose-500">
            {(profile.stress_event_rate * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400">stress rate</div>
        </div>
      </div>

      {/* Fuel mix */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {fuelDominance.map(({ fuel, val, color }) => (
          <div key={fuel} className="text-center p-2.5 rounded-xl bg-slate-50">
            <div className="text-sm font-mono font-500" style={{ color }}>{val?.toFixed(1)}</div>
            <div className="text-xs text-slate-400 font-body">{fuel} MU</div>
          </div>
        ))}
      </div>

      {/* Monthly stress chart */}
      {monthlyData.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 font-body mb-2 uppercase tracking-wide">Monthly Stress Rate (%)</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'DM Sans', borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v) => [`${v}%`, 'Stress Rate']}
              />
              <Bar dataKey="stress" radius={[3, 3, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.stress > 40 ? '#f43f5e' : entry.stress > 25 ? '#f97316' : entry.stress > 15 ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
        <div className="text-xs">
          <span className="text-slate-400">Mean RE: </span>
          <span className="font-mono font-500 text-slate-700">{formatMU(profile.mean_re_MU)}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400">CoV: </span>
          <span className="font-mono font-500 text-slate-700">{profile.cv_re?.toFixed(3)}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400">90d stress: </span>
          <span className="font-mono font-500 text-slate-700">
            {(profile.recent_stress_rate_90d * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400">Total days: </span>
          <span className="font-mono font-500 text-slate-700">{profile.total_days}</span>
        </div>
      </div>
    </motion.div>
  )
}
