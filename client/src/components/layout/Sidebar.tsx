import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Calendar, Thermometer, LineChart, Lightbulb, Search } from 'lucide-react'
import { useBuildings } from '../../hooks/queries'
import { useFiltersStore } from '../../store/filters'
import { Select } from '../ui/Select'

const navItems = [
  { name: 'Overview', path: '/app/overview', icon: LayoutDashboard },
  { name: 'Schedules', path: '/app/schedules', icon: Calendar },
  { name: 'Temperature', path: '/app/temperature', icon: Thermometer },
  { name: 'Insights', path: '/app/insights', icon: LineChart },
  { name: 'Recommendations', path: '/app/recommendations', icon: Lightbulb },
]

export function Sidebar() {
  const location = useLocation()
  const { data: buildings } = useBuildings()
  const { selectedBuildingId, setBuilding } = useFiltersStore()

  return (
    <aside className="w-64 flex-shrink-0 bg-card border-r border-line h-screen flex flex-col z-20 hidden lg:flex">
      <div className="h-16 flex items-center px-6 border-b border-line">
        <div className="font-semibold text-lg text-ink flex items-center gap-1">
          Minsaar<span className="w-1.5 h-1.5 rounded-full bg-accent mb-2"></span>
        </div>
      </div>
      
      <div className="p-4">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-2 bg-page rounded-inner border border-line hover:border-ink-3 transition-colors text-left"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <Search size={16} />
          <span className="flex-1">Search...</span>
          <span className="text-xs font-medium text-ink-3 border border-line px-1.5 rounded bg-white">Ctrl+K</span>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-inner text-sm font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-ink-2 hover:text-ink hover:bg-page'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-accent-soft rounded-inner -z-10"
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                />
              )}
              <item.icon size={18} strokeWidth={1.5} />
              {item.name}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-line">
        <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight block mb-2 px-1">Building</label>
        <Select 
          value={selectedBuildingId || ''} 
          onChange={(e) => setBuilding(e.target.value || null)}
          className="bg-page"
        >
          <option value="">All Buildings</option>
          {buildings?.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </div>
    </aside>
  )
}