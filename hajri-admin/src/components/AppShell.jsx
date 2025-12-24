import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { StructureTree } from '@/components/StructureTree/StructureTree'
import { cn } from '@/lib/utils'
import { useScopeStore, useStructureStore } from '@/lib/store'

const modes = [
  { label: 'Overview', to: '/app/overview' },
  { label: 'Subjects', to: '/app/subjects' },
  { label: 'Faculty', to: '/app/faculty' },
  { label: 'Rooms', to: '/app/rooms' },
  { label: 'Period Templates', to: '/app/period-templates' },
  { label: 'Assignments', to: '/app/assignments' },
  { label: 'Timetable', to: '/app/timetable' },
]

function Breadcrumb() {
  const { selectedNode, selectNodeAndReveal } = useStructureStore()

  const crumbs = useMemo(() => {
    if (!selectedNode) return []

    const chain = Array.isArray(selectedNode.parentPath)
      ? [...selectedNode.parentPath, selectedNode]
      : [selectedNode]

    const levelOrder = ['department', 'branch', 'semester', 'class', 'batch']
    const filtered = chain.filter((n) => levelOrder.includes(n?.type))

    const byType = new Map()
    for (const n of filtered) byType.set(n.type, n)

    return levelOrder
      .map((t) => byType.get(t))
      .filter(Boolean)
      .map((n) => ({
        node: n,
        label: n.type === 'branch' && n.meta ? n.meta : n.name,
      }))
  }, [selectedNode])

  if (crumbs.length === 0) {
    return <div className="text-xs text-muted-foreground">Select a node in the tree to set scope.</div>
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {crumbs.map((crumb, idx) => (
        <span key={`${crumb.node.id}-${idx}`} className="flex items-center gap-1">
          {idx < crumbs.length - 1 ? (
            <button
              type="button"
              onClick={() => selectNodeAndReveal(crumb.node)}
              className="font-medium hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="font-semibold text-foreground">{crumb.label}</span>
          )}
          {idx < crumbs.length - 1 && <span className="text-muted-foreground/60">›</span>}
        </span>
      ))}
    </div>
  )
}

const SIDEBAR_DEFAULT_WIDTH = 260
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_RAIL_WIDTH = 52

const LS_WIDTH_KEY = 'treeSidebar.width'
const LS_COLLAPSED_KEY = 'treeSidebar.collapsed'

export function AppShell() {
  const { selectedNode } = useStructureStore()
  const { setScopeFromNode, clear: clearScope, semesterId, classId, batchId } = useScopeStore()

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_COLLAPSED_KEY) || 'false')
    } catch {
      return false
    }
  })

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_WIDTH_KEY)
      const parsed = raw ? Number(raw) : SIDEBAR_DEFAULT_WIDTH
      if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH
      return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed))
    } catch {
      return SIDEBAR_DEFAULT_WIDTH
    }
  })

  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startWidth: SIDEBAR_DEFAULT_WIDTH,
  })

  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!selectedNode) {
      clearScope()
      return
    }
    setScopeFromNode(selectedNode)
  }, [selectedNode, setScopeFromNode, clearScope])

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify(collapsed))
    } catch {
      // ignore
    }
  }, [collapsed])

  useEffect(() => {
    try {
      localStorage.setItem(LS_WIDTH_KEY, String(sidebarWidth))
    } catch {
      // ignore
    }
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragStateRef.current.active) return
      const dx = e.clientX - dragStateRef.current.startX
      const next = dragStateRef.current.startWidth + dx
      const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, next))
      setSidebarWidth(clamped)
    }

    const onUp = () => {
      if (!dragStateRef.current.active) return
      dragStateRef.current.active = false
      setIsResizing(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const actualSidebarWidth = collapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidth

  const startResize = (e) => {
    if (collapsed) setCollapsed(false)
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: sidebarWidth,
    }
    setIsResizing(true)
    e.preventDefault()
    e.stopPropagation()
  }

  const resetSidebarWidth = () => {
    setCollapsed(false)
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => !c)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left: Tree Explorer (ONLY sidebar) */}
      <aside
        className={cn(
          'relative shrink-0 border-r border-border bg-card flex flex-col',
          isResizing ? 'transition-none' : 'transition-[width] duration-200 ease-out'
        )}
        style={{ width: `${actualSidebarWidth}px` }}
      >
        <div className="flex-1 overflow-hidden">
          <StructureTree collapsed={collapsed} onAddRoot={() => {}} />
        </div>

        {/* Floating collapse button at bottom */}
        <div className={cn(
          "relative z-20 border-t border-border bg-muted/30 backdrop-blur-sm flex items-center justify-center",
          collapsed ? "p-2" : "p-3"
        )}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all',
              collapsed ? 'w-10 h-10' : 'w-full flex items-center justify-center gap-2'
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Resize handle - only show when NOT collapsed */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startResize}
            onDoubleClick={resetSidebarWidth}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 hover:bg-primary/20 transition-colors"
            title="Drag to resize. Double-click to reset."
          />
        )}
      </aside>

      {/* Right: Workspace */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2">
            <Breadcrumb />

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {modes.map((m) => (
                (() => {
                  const needsSemester = m.to === '/app/subjects' || m.to === '/app/faculty'
                  const needsClass = m.to === '/app/assignments'
                  const needsBatch = m.to === '/app/timetable'

                  const disabled =
                    !selectedNode ||
                    (needsSemester && !semesterId) ||
                    (needsClass && !classId) ||
                    (needsBatch && !batchId)

                  const title = disabled
                    ? !selectedNode
                      ? 'Select a node in the Tree Explorer'
                      : needsBatch
                        ? 'Select a Batch in the Tree Explorer'
                        : needsClass
                          ? 'Select a Class in the Tree Explorer'
                          : 'Select a Semester in the Tree Explorer'
                    : ''

                  const baseClass = cn(
                    'rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                    disabled
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )

                  if (disabled) {
                    return (
                      <span key={m.to} className={baseClass} title={title}>
                        {m.label}
                      </span>
                    )
                  }

                  return (
                    <NavLink
                      key={m.to}
                      to={m.to}
                      title={title}
                      className={({ isActive }) =>
                        cn(baseClass, isActive && 'bg-secondary text-foreground')
                      }
                    >
                      {m.label}
                    </NavLink>
                  )
                })()
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </section>
    </div>
  )
}
