import { useLocation, useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { Menu, User } from 'lucide-react'
import { PillSwitcher } from '../ui/PillSwitcher'
import { useFiltersStore } from '../../store/filters'
import { useSettings } from '../../hooks/queries'
import { useAuthStore } from '../../store/auth'

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation()
  const { dateRange, setDateRange } = useFiltersStore()
  const { data: settings } = useSettings()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const pathSegments = location.pathname.split('/').filter(Boolean)
  const currentPage = pathSegments[pathSegments.length - 1]
  const formattedPageName = currentPage.charAt(0).toUpperCase() + currentPage.slice(1)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-page/80 backdrop-blur border-b border-line flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2 text-ink-2 hover:text-ink" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div className="text-sm font-medium text-ink-2 hidden sm:flex items-center gap-2">
          <span>Minsaar</span>
          <span className="text-ink-3">/</span>
          <span className="text-ink">{formattedPageName}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        {settings?.mode && (
          <div className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-page border border-line text-ink-2">
            {settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1)} Mode
          </div>
        )}
        
        <div className="hidden md:block">
          <PillSwitcher 
            options={['Today', 'Week', 'Month', 'Range']}
            defaultSelected={dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
            onChange={(val) => setDateRange(val.toLowerCase() as any)}
          />
        </div>

        <Popover.Root>
          <Popover.Trigger className="w-8 h-8 rounded-full bg-card border border-line flex items-center justify-center text-ink-2 hover:text-ink hover:border-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors">
            <User size={16} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} className="w-48 bg-card rounded-inner shadow-xl border border-line p-1 z-50">
              <div className="px-3 py-2 border-b border-line mb-1">
                <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
                <div className="text-xs text-ink-3 truncate">{user?.email}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-rose hover:bg-rose/10 rounded font-medium transition-colors"
              >
                Sign out
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  )
}