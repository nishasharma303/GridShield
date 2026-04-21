import axios from 'axios'

const BASE = '/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

export const predictRisk = (payload) => api.post('/predict', payload).then(r => r.data)
export const getRegionProfile = (region) => api.get(`/region/${region}`).then(r => r.data)
export const getWeather = (region) => api.get(`/weather/${region}`).then(r => r.data)
export const getHistory = (region, days = 90, fuel = 're_total') =>
  api.get(`/history/${region}`, { params: { days, fuel } }).then(r => r.data)
export const getMetrics = () => api.get('/metrics').then(r => r.data)
export const getImportance = (top_n = 20) => api.get('/importance', { params: { top_n } }).then(r => r.data)
export const getAllRegions = () => api.get('/regions').then(r => r.data)
export const getStressTimeline = (days = 180) => api.get('/analytics/stress-timeline', { params: { days } }).then(r => r.data)
export const getRegionHeatmap = () => api.get('/analytics/region-heatmap').then(r => r.data)
export const getHealth = () => api.get('/health').then(r => r.data)

export default api
