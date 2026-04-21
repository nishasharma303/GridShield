import { motion } from 'framer-motion'
import { formatProb } from '../utils/helpers.js'

export default function CounterfactualPanel({ prediction, loading }) {
  if (loading) return <div className="card p-6 h-44 skeleton" />
  if (!prediction || !prediction.counterfactuals?.length) return null

  const cfs = prediction.counterfactuals

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-header mb-0">What-If Actions</h3>
        <span className="text-xs text-slate-400 font-body">to reduce risk</span>
      </div>

      <div className="space-y-2.5">
        {cfs.map((cf, i) => {
          const achieves = cf.achieves_low_risk ? 'low' : cf.achieves_medium_risk ? 'medium' : 'none'
          const badgeMap = {
            low:    { label: '→ Low',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            medium: { label: '→ Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            none:   { label: 'Partial',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
          }
          const badge = badgeMap[achieves]
          const delta = cf.risk_reduction

          return (
            <motion.div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-body text-slate-700">{cf.scenario}</div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  {formatProb(cf.original_prob)} → {formatProb(cf.new_prob)}
                  <span className="ml-2 text-emerald-600">↓ {(delta * 100).toFixed(1)}pp</span>
                </div>
              </div>
              <span className={`text-xs font-body px-2 py-0.5 rounded-full border font-500 ${badge.cls}`}>
                {badge.label}
              </span>
            </motion.div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 font-body mt-3 italic">
        Counterfactuals are model-based simulations. Human operator judgment required before acting.
      </p>
    </motion.div>
  )
}
