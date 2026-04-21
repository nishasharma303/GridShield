import { motion } from 'framer-motion'
import { RISK_CONFIG } from '../utils/helpers.js'

/**
 * Simplified SVG map of India showing 5 POSOCO regions.
 * Each region is a clickable path coloured by stress rate.
 * Coordinates are approximate outlines designed for this dashboard.
 */
const REGION_PATHS = {
  NR: {
    // North: J&K, HP, Punjab, Haryana, Delhi, UP, Rajasthan, Uttarakhand
    d: 'M180 40 L260 30 L300 50 L320 80 L310 120 L290 140 L260 150 L230 145 L200 140 L175 120 L165 90 Z',
    cx: 242, cy: 95,
  },
  WR: {
    // West: Rajasthan (lower), MP, Maharashtra, Gujarat, Chhattisgarh
    d: 'M175 120 L200 140 L230 145 L260 150 L280 170 L290 210 L280 250 L255 270 L220 280 L185 265 L160 240 L148 210 L155 170 Z',
    cx: 220, cy: 200,
  },
  SR: {
    // South: AP, Telangana, Karnataka, Tamil Nadu, Kerala
    d: 'M220 280 L255 270 L280 250 L300 270 L310 300 L305 340 L285 370 L260 390 L230 395 L205 380 L190 350 L185 310 L195 285 Z',
    cx: 248, cy: 335,
  },
  ER: {
    // East: WB, Odisha, Jharkhand, Bihar
    d: 'M290 140 L310 120 L345 130 L370 150 L375 180 L365 210 L345 230 L310 240 L290 230 L280 210 L290 170 Z',
    cx: 330, cy: 185,
  },
  NER: {
    // North-East: Assam, Meghalaya, etc.
    d: 'M370 150 L395 135 L425 140 L440 160 L435 185 L410 200 L385 200 L365 185 L365 165 Z',
    cx: 403, cy: 168,
  },
}

const REGION_LABELS = {
  NR: 'North', WR: 'West', SR: 'South', ER: 'East', NER: 'NE',
}

function getRiskColor(stressRate) {
  if (stressRate < 0.15) return { fill: '#d1fae5', stroke: '#10b981', risk: 'Low' }
  if (stressRate < 0.30) return { fill: '#fef3c7', stroke: '#f59e0b', risk: 'Medium' }
  if (stressRate < 0.50) return { fill: '#ffedd5', stroke: '#f97316', risk: 'High' }
  return { fill: '#ffe4e6', stroke: '#f43f5e', risk: 'Critical' }
}

export default function IndiaRegionMap({ selectedRegion, onRegionClick, regionData = {} }) {
  return (
    <div className="relative w-full flex flex-col items-center">
      <svg
        viewBox="100 20 380 400"
        className="w-full max-w-md"
        style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.06))' }}
      >
        {/* Background */}
        <rect x="100" y="20" width="380" height="400" fill="transparent" />

        {/* Region paths */}
        {Object.entries(REGION_PATHS).map(([code, { d, cx, cy }]) => {
          const data = regionData[code] || {}
          const stressRate = data.stress_event_rate ?? 0.2
          const { fill, stroke } = getRiskColor(stressRate)
          const isSelected = selectedRegion === code

          return (
            <motion.g key={code} onClick={() => onRegionClick(code)} style={{ cursor: 'pointer' }}>
              <motion.path
                d={d}
                fill={isSelected ? stroke : fill}
                stroke={stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                initial={false}
                animate={{
                  fillOpacity: isSelected ? 0.95 : 0.75,
                  scale: isSelected ? 1.02 : 1,
                }}
                whileHover={{ fillOpacity: 0.9, scale: 1.015 }}
                transition={{ duration: 0.2 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
              {/* Label */}
              <text
                x={cx}
                y={cy - 2}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isSelected ? '700' : '600'}
                fontFamily="DM Sans, sans-serif"
                fill={isSelected ? 'white' : '#1e293b'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {REGION_LABELS[code]}
              </text>
              {/* Stress rate badge */}
              <text
                x={cx}
                y={cy + 11}
                textAnchor="middle"
                fontSize="8.5"
                fontFamily="JetBrains Mono, monospace"
                fill={isSelected ? 'rgba(255,255,255,0.85)' : stroke}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {stressRate ? `${(stressRate * 100).toFixed(0)}% stress` : ''}
              </text>
              {/* Selected ring */}
              {isSelected && (
                <motion.circle
                  cx={cx} cy={cy}
                  r={22}
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: `${cx}px ${cy}px` }}
                />
              )}
            </motion.g>
          )
        })}

        {/* India outline (decorative) */}
        <text x="490" y="420" fontSize="10" fill="#cbd5e1" fontFamily="DM Sans" textAnchor="end">
          POSOCO Regions
        </text>
      </svg>

      {/* Region legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {[
          { label: 'Low (<15%)',     color: '#10b981', bg: '#d1fae5' },
          { label: 'Medium (15-30%)', color: '#f59e0b', bg: '#fef3c7' },
          { label: 'High (30-50%)',  color: '#f97316', bg: '#ffedd5' },
          { label: 'Critical (>50%)',color: '#f43f5e', bg: '#ffe4e6' },
        ].map(({ label, color, bg }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm border" style={{ background: bg, borderColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
