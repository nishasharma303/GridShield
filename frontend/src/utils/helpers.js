export const REGIONS = ['NR', 'WR', 'SR', 'ER', 'NER']

export const REGION_META = {
  NR:  { label: 'North Region',      states: 'Delhi, UP, Rajasthan, HP, Punjab, Haryana, J&K, UK' },
  WR:  { label: 'West Region',       states: 'Maharashtra, Gujarat, MP, Chhattisgarh, Goa' },
  SR:  { label: 'South Region',      states: 'Tamil Nadu, Andhra Pradesh, Telangana, Karnataka, Kerala' },
  ER:  { label: 'East Region',       states: 'West Bengal, Jharkhand, Bihar, Odisha' },
  NER: { label: 'North-East Region', states: 'Assam, Meghalaya, Manipur, Mizoram, Tripura, Nagaland, Arunachal Pradesh, Sikkim' },
}

export const FUEL_COLORS = {
  solar: '#f59e0b',
  wind:  '#0ea5e9',
  hydro: '#10b981',
  re_total: '#8b5cf6',
}

export const RISK_CONFIG = {
  Low:      { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '✓' },
  Medium:   { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '⚠' },
  High:     { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', icon: '⚡' },
  Critical: { color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3', text: '#881337', icon: '🔴' },
}

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function riskClass(level) {
  return { Low: 'risk-low', Medium: 'risk-medium', High: 'risk-high', Critical: 'risk-critical' }[level] || 'risk-low'
}

export function riskBgClass(level) {
  return {
    Low: 'risk-bg-low', Medium: 'risk-bg-medium',
    High: 'risk-bg-high', Critical: 'risk-bg-critical'
  }[level] || 'risk-bg-low'
}

export function formatMU(v) {
  if (v === null || v === undefined) return '—'
  return `${Number(v).toFixed(1)} MU`
}

export function formatPct(v) {
  if (v === null || v === undefined) return '—'
  return `${(Number(v) * 100).toFixed(1)}%`
}

export function formatProb(v) {
  return `${(Number(v) * 100).toFixed(1)}%`
}
