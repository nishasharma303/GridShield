import { motion } from 'framer-motion'
import { RISK_CONFIG, formatProb, formatMU } from '../utils/helpers.js'

export default function RiskCard({ prediction, loading }) {
  if (loading) return <div className="card p-6 h-48 skeleton" />

  if (!prediction) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span className="text-sm font-body">Select a region and run prediction</span>
      </div>
    )
  }

  const risk = prediction.prediction.risk_level
  const cfg  = RISK_CONFIG[risk] || RISK_CONFIG.Low
  const prob = prediction.prediction.failure_probability

  return (
    <motion.div
      className="card p-6 border-2"
      style={{ borderColor: cfg.border, background: cfg.bg }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-body uppercase tracking-widest text-slate-500 mb-1">
            Risk Level
          </div>
          <div className="text-4xl font-display" style={{ color: cfg.color }}>
            {risk}
          </div>
        </div>
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-sm"
          style={{ background: cfg.color + '18' }}
        >
          {cfg.icon}
        </div>
      </div>

      {/* Probability gauge */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-body">Failure Probability</span>
          <span className="font-mono font-500" style={{ color: cfg.color }}>
            {formatProb(prob)}
          </span>
        </div>
        <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` }}
            initial={{ width: 0 }}
            animate={{ width: `${prob * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Action text */}
      <div className="text-sm font-body text-slate-700 font-500">
        {prediction.prediction.action_text}
      </div>

      {/* Meta */}
      <div className="mt-3 pt-3 border-t border-white/50 flex items-center gap-3 text-xs text-slate-500">
        <span>{prediction.region_label}</span>
        <span>•</span>
        <span>{prediction.date}</span>
        <span>•</span>
        <span className="font-mono">{prediction.model_used}</span>
      </div>
    </motion.div>
  )
}
