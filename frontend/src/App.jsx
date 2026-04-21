import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Dashboard     from './pages/Dashboard.jsx'
import Analytics     from './pages/Analytics.jsx'
import ScenarioLab   from './pages/ScenarioLab.jsx'
import SeasonalPlanner from './pages/SeasonalPlanner.jsx'

const NAV = [
  { to:'/',           label:'Dashboard',        icon:GridIcon },
  { to:'/analytics',  label:'Grid Intelligence', icon:ChartIcon },
  { to:'/scenario',   label:'Scenario Lab',      icon:FlaskIcon },
  { to:'/seasonal',   label:'Seasonal Planner',  icon:CalIcon },
]

function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function ChartIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function FlaskIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6M9 3v7L3 20h18L15 10V3"/></svg>
}
function CalIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}

export default function App() {
  const location = useLocation()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-sky-500 rounded-lg flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div>
              <span className="font-display text-lg text-slate-900">GridShield</span>
              <span className="font-display text-lg text-emerald-500">+</span>
              <span className="ml-2 text-xs text-slate-400 font-body hidden sm:inline">Grid Decision Support</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map(({to,label,icon:Icon})=>(
              <NavLink key={to} to={to} end={to==='/'}
                className={({isActive})=>`nav-link ${isActive?'active':''}`}>
                <Icon/>
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-slow"/>
            <span className="hidden sm:inline">Live</span>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"         element={<PageWrap><Dashboard/></PageWrap>}/>
            <Route path="/analytics"element={<PageWrap><Analytics/></PageWrap>}/>
            <Route path="/scenario" element={<PageWrap><ScenarioLab/></PageWrap>}/>
            <Route path="/seasonal" element={<PageWrap><SeasonalPlanner/></PageWrap>}/>
          </Routes>
        </AnimatePresence>
      </main>
      <footer className="border-t border-slate-100 py-3 text-center text-xs text-slate-400 font-body">
        GridShield+ • POSOCO Daily Data 2017–2022 + Open-Meteo ERA5 • For decision support — human operator review required
      </footer>
    </div>
  )
}
function PageWrap({children}) {
  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.22}}>
      {children}
    </motion.div>
  )
}