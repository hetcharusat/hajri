import { Sidebar } from './Sidebar'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/utils'

export function AppShell({ children }) {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarCollapsed ? "ml-16" : "ml-60"
      )}>
        {children}
      </main>
    </div>
  )
}
