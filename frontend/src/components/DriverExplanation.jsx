import { motion } from 'framer-motion'

export default function DriverExplanation({ prediction, loading }) {
  if (loading) return <div className="card p-6 h-44 skeleton" />
  if (!prediction || !prediction.top_drivers?.length) return null

  const drivers = prediction.top_drivers
  const riskScore = prediction.risk_score_0_100 || 0
  const allClear  = drivers.length === 1 && drivers[0].feature === 'all_clear'

  return (
    <motion.div className="card p-6"
                initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.35,delay:0.15}}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-header mb-0">Why This Risk Level?</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 font-body">Risk score</div>
          <div className={`text-sm font-mono font-600 ${
            riskScore > 60 ? 'text-rose-500' : riskScore > 35 ? 'text-amber-500' : 'text-emerald-600'
          }`}>{riskScore}/100</div>
        </div>
      </div>

      {allClear ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <span className="text-2xl">✅</span>
          <div>
            <div className="text-sm font-body font-500 text-emerald-700">All conditions within normal range</div>
            <div className="text-xs text-emerald-600 mt-1 font-body">{drivers[0].explanation}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((d,i)=>{
            const isPartial = d.triggered === 'partial'
            const bgColor   = isPartial ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'
            const textColor = isPartial ? 'text-amber-700' : 'text-rose-700'
            const subColor  = isPartial ? 'text-amber-600' : 'text-rose-500'
            return (
              <motion.div key={d.feature}
                          className={`flex items-start gap-3 p-3 rounded-xl border ${bgColor}`}
                          initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                          transition={{delay:0.04*i}}>
                <span className="text-xl leading-none mt-0.5">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-body font-500 ${textColor} leading-snug`}>
                    {isPartial && <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded mr-1.5">Partial</span>}
                    {d.explanation}
                  </div>
                  <div className={`text-xs font-mono mt-1 ${subColor}`}>
                    {d.value_label}
                  </div>
                </div>
                {/* Severity bar */}
                <div className="w-12 flex-shrink-0 mt-1">
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                         style={{width:`${Math.min(d.severity*100*2,100)}%`,
                                 background: isPartial ? '#f59e0b' : '#f43f5e'}}/>
                  </div>
                  <div className={`text-xs font-mono text-center mt-0.5 ${subColor}`}>
                    {isPartial ? 'partial' : 'active'}
                  </div>
                </div>
              </motion.div>
            )
          })}

          {/* How risk score adds up */}
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs font-body text-slate-400">
            Risk score of <span className="font-mono font-500 text-slate-700">{riskScore}/100</span> derived from{' '}
            {drivers.filter(d=>d.triggered===true).length} active and{' '}
            {drivers.filter(d=>d.triggered==='partial').length} partial stress criteria above.
            Each criterion uses real {prediction.region} historical thresholds from 5 years of POSOCO data.
          </div>
        </div>
      )}
    </motion.div>
  )
}