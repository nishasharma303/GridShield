import { motion } from 'framer-motion'
import { formatMU, RISK_CONFIG } from '../utils/helpers.js'

function DispatchRow({ label, value, color, icon, note }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <div>
          <div className="text-sm font-body text-slate-700">{label}</div>
          {note && <div className="text-xs text-slate-400">{note}</div>}
        </div>
      </div>
      <span className="font-mono text-sm font-500" style={{ color }}>
        {formatMU(value)}
      </span>
    </div>
  )
}

export default function DispatchPanel({ prediction, loading }) {
  if (loading) return <div className="card p-6 h-52 skeleton" />
  if (!prediction) return null

  const d   = prediction.prediction
  const cfg = RISK_CONFIG[d.risk_level] || RISK_CONFIG.Low

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-header mb-0">Dispatch Recommendation</h3>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full border font-500"
          style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
        >
          Safety factor {(d.safety_factor * 100).toFixed(0)}%
        </span>
      </div>

      <DispatchRow
        label="Forecasted RE"
        value={d.forecasted_re_MU}
        color="#64748b"
        icon="⚡"
        note="Total solar + wind + hydro"
      />
      <DispatchRow
        label="Safe to Dispatch"
        value={d.safe_re_MU}
        color="#10b981"
        icon="✅"
        note="Recommended dispatch limit"
      />
      <DispatchRow
        label="RE Withheld"
        value={d.re_withheld_MU}
        color="#f59e0b"
        icon="🔒"
        note="Buffer reserve"
      />
      <DispatchRow
        label="Backup Required"
        value={d.backup_needed_MU}
        color={cfg.color}
        icon="🔋"
        note="Thermal / storage procurement"
      />

      {/* Visual bar */}
      <div className="mt-4 pt-3">
        <div className="text-xs text-slate-500 mb-2 flex justify-between">
          <span>RE Dispatch Plan</span>
          <span className="font-mono">{formatMU(d.forecasted_re_MU)} total</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
          <motion.div
            className="h-full bg-emerald-400 rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${(d.safe_re_MU / d.forecasted_re_MU) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            title={`Safe: ${formatMU(d.safe_re_MU)}`}
          />
          <motion.div
            className="h-full bg-amber-300 rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${(d.re_withheld_MU / d.forecasted_re_MU) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
            title={`Withheld: ${formatMU(d.re_withheld_MU)}`}
          />
        </div>
        <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Safe dispatch</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" />Withheld</span>
        </div>
      </div>
    </motion.div>
  )
}
