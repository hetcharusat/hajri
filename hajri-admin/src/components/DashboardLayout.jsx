import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TreePine,
  BookOpen,
  GraduationCap,
  MapPin,
  Layers,
  CalendarDays,
  Clock,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { ScopeBar } from '@/components/ScopeBar'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Structure', href: '/structure', icon: TreePine },
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Faculty', href: '/faculty', icon: GraduationCap },
  { name: 'Rooms', href: '/rooms', icon: MapPin },
  { name: 'Assignments', href: '/assignments', icon: Layers },
  { name: 'Timetable', href: '/timetable', icon: CalendarDays },
  { name: 'Period Templates', href: '/period-templates', icon: Clock },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }) {
  const location = useLocation()
  const { user, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    signOut()
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex w-64 flex-col">
          <div className="flex min-h-0 flex-1 flex-col border-r border-border bg-card">
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
              <div className="flex flex-shrink-0 items-center px-4">
                <h1 className="text-2xl font-bold text-primary">Hajri Admin</h1>
              </div>

              <nav className="mt-8 flex-1 space-y-1 px-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                        'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
                      )}
                    >
                      <item.icon
                        className={cn(
                          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                          'mr-3 h-5 w-5 flex-shrink-0'
                        )}
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="flex flex-shrink-0 border-t border-border p-4">
              <div className="group block w-full flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="inline-block h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user?.email?.[0]?.toUpperCase() || 'A'}
                      </span>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user?.email || 'Admin'}
                      </p>
                      <p className="text-xs text-muted-foreground">Administrator</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="ml-2 inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScopeBar />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
