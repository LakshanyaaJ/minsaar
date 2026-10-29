import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { useRooms } from '../../hooks/queries'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { data: rooms } = useRooms()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleSelect = (path: string) => {
    navigate(path)
    setOpen(false)
    setSearch('')
  }

  const pages = [
    { name: 'Overview', path: '/app/overview' },
    { name: 'Schedules', path: '/app/schedules' },
    { name: 'Temperature', path: '/app/temperature' },
    { name: 'Insights', path: '/app/insights' },
    { name: 'Recommendations', path: '/app/recommendations' },
  ]

  const filteredPages = pages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const filteredRooms = (rooms || []).filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-card rounded-card shadow-2xl z-50 overflow-hidden outline-none">
          <div className="flex items-center px-4 border-b border-line">
            <Search className="w-5 h-5 text-ink-3" />
            <input
              autoFocus
              className="flex-1 h-14 bg-transparent border-none outline-none px-3 text-ink placeholder:text-ink-3"
              placeholder="Search rooms or pages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredPages.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-xs font-semibold text-ink-3 uppercase tracking-tight">Pages</div>
                {filteredPages.map(page => (
                  <button
                    key={page.path}
                    onClick={() => handleSelect(page.path)}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-page rounded-inner outline-none focus-visible:bg-page"
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            )}
            {filteredRooms.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs font-semibold text-ink-3 uppercase tracking-tight">Rooms</div>
                {filteredRooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => handleSelect(`/app/temperature?room=${room.id}`)}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-page rounded-inner outline-none focus-visible:bg-page"
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}