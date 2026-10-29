import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AnimatedOutlet } from './AnimatedOutlet'
import { CommandPalette } from './CommandPalette'

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      <Sidebar />
      
      {/* Mobile Drawer */}
      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 w-64 bg-card z-50 lg:hidden outline-none flex flex-col shadow-2xl">
            <div className="flex-1 overflow-hidden" onClick={(e) => {
              if ((e.target as HTMLElement).tagName === 'A') setMobileMenuOpen(false)
            }}>
              <Sidebar />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatedOutlet />
        </main>
      </div>
      
      <CommandPalette />
    </div>
  )
}