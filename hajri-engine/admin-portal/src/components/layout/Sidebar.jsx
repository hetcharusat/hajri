import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Calculator, 
  GraduationCap, 
  LineChart, 
  Bug, 
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../lib/store'
import { api } from '../../lib/utils'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'semester-totals', label: 'Semester Totals', icon: Calculator },
  { id: 'batches', label: 'Batches', icon: GraduationCap },
  { id: 'predictions', label: 'Predictions', icon: LineChart },
  { id: 'logs', label: 'Logs & Activity', icon: ScrollText },
  { id: 'debug', label: 'Debug Tools', icon: Bug },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { currentTab, setCurrentTab, health, setHealth, sidebarCollapsed, toggleSidebar } = useAppStore()

  useEffect(() => {
    api('/health').then(setHealth).catch(() => setHealth({ status: 'error' }))
    const interval = setInterval(() => {
      api('/health').then(setHealth).catch(() => setHealth({ status: 'error' }))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-lg leading-none">HAJRI</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Engine Admin</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={cn(
              "nav-item w-full",
              currentTab === item.id && "active"
            )}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-3">
        {/* Status */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          health?.status === 'healthy' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          <span className={cn(
            "w-2 h-2 rounded-full",
            health?.status === 'healthy' ? "bg-success animate-pulse-soft" : "bg-destructive"
          )} />
          {!sidebarCollapsed && (
            <span>{health?.status === 'healthy' ? 'Engine Online' : 'Connecting...'}</span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
