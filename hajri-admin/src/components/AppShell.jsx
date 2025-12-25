import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  BookOpen, 
  Users, 
  DoorOpen, 
  Clock, 
  Link2, 
  Calendar,
  CalendarDays,
  GraduationCap
} from 'lucide-react'

import { StructureTree } from '@/components/StructureTree/StructureTree'
import { EntityForm } from '@/components/EntityForm/EntityForm'
import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { cn } from '@/lib/utils'
import { useScopeStore, useStructureStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

const modes = [
  { label: 'Overview', to: '/app/overview', icon: LayoutGrid },
  { label: 'Subjects', to: '/app/subjects', icon: BookOpen },
  { label: 'Faculty', to: '/app/faculty', icon: Users },
  { label: 'Rooms', to: '/app/rooms', icon: DoorOpen },
  { label: 'Period Templates', to: '/app/period-templates', icon: Clock },
  { label: 'Assignments', to: '/app/assignments', icon: Link2 },
  { label: 'Timetable', to: '/app/timetable', icon: Calendar },
  { label: 'Academic Calendar', to: '/app/academic-calendar', icon: CalendarDays, global: true },
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
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {crumbs.map((crumb, idx) => (
        <span key={`${crumb.node.id}-${idx}`} className="flex items-center gap-1.5">
          {idx < crumbs.length - 1 ? (
            <button
              type="button"
              onClick={() => selectNodeAndReveal(crumb.node)}
              className="font-medium hover:text-primary transition-colors"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="font-semibold text-foreground">{crumb.label}</span>
          )}
          {idx < crumbs.length - 1 && <span className="text-muted-foreground/40">›</span>}
        </span>
      ))}
    </div>
  )
}

const SIDEBAR_DEFAULT_WIDTH = 260
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_RAIL_WIDTH = 56

const LS_WIDTH_KEY = 'treeSidebar.width'
const LS_COLLAPSED_KEY = 'treeSidebar.collapsed'

export function AppShell() {
  const { selectedNode, triggerRefresh } = useStructureStore()
  const { setScopeFromNode, clear: clearScope, semesterId, classId, batchId } = useScopeStore()
  const navigate = useNavigate()

  // EntityForm state for adding/editing structure nodes
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formNode, setFormNode] = useState(null)

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

  // Navigate to overview when node changes
  useEffect(() => {
    if (selectedNode) {
      navigate('/app/overview')
    }
  }, [selectedNode?.id])

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

  // Structure tree handlers
  const handleAddRoot = () => {
    setFormNode({ type: 'root' })
    setFormMode('add')
    setFormOpen(true)
  }

  const handleAddChild = (parentNode) => {
    setFormNode(parentNode)
    setFormMode('add')
    setFormOpen(true)
  }

  const handleEdit = (node) => {
    setFormNode(node)
    setFormMode('edit')
    setFormOpen(true)
  }

  const handleDelete = async (node) => {
    const cascadeWarnings = {
      department: 'This will delete all branches, semesters, classes, batches, and students under this department.',
      branch: 'This will delete all semesters, classes, batches, students, and subjects under this branch.',
      semester: 'This will delete all classes, batches, and students under this semester.',
      class: 'This will delete all batches and students under this class.',
      batch: 'This will delete all students in this batch.',
    }
    const warning = cascadeWarnings[node.type] || ''
    const confirmMsg = `Are you sure you want to delete this ${node.type}?\n\n${warning}\n\nThis action cannot be undone.`
    
    if (!confirm(confirmMsg)) return

    try {
      let table = `${node.type}s`
      if (node.type === 'class') table = 'classes'
      if (node.type === 'branch') table = 'branches'
      
      await supabase.from(table).delete().eq('id', node.id).throwOnError()
      
      // Trigger tree refresh
      triggerRefresh()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleFormSuccess = () => {
    setFormOpen(false)
    setFormNode(null)
    // Trigger tree refresh
    triggerRefresh()
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left: Sidebar */}
      <aside
        className={cn(
          'relative shrink-0 border-r border-border bg-card flex flex-col transition-[width] duration-200',
          isResizing && 'transition-none'
        )}
        style={{ width: `${actualSidebarWidth}px` }}
      >
        {/* Sidebar Header */}
        <div className="h-12 border-b border-border flex items-center px-3 gap-2">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-base">Hajri</span>
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-primary mx-auto">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-hidden">
          <StructureTree 
            collapsed={collapsed} 
            onAddRoot={handleAddRoot}
            onAddChild={handleAddChild}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'w-full rounded-lg p-2 flex items-center justify-center gap-2',
              'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground',
              'transition-colors'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Resize Handle */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startResize}
            onDoubleClick={resetSidebarWidth}
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize z-10 hover:bg-primary/50 transition-colors"
            title="Drag to resize"
          />
        )}
      </aside>

      {/* Right: Main Workspace */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Top Navigation */}
        <header className="border-b border-border bg-card">
          <div className="px-4 py-3">
            <Breadcrumb />

            {/* Navigation Tabs */}
            <nav className="mt-3 flex gap-1 overflow-x-auto">
              {modes.map((m) => {
                const Icon = m.icon
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

                if (disabled) {
                  return (
                    <span
                      key={m.to}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40 cursor-not-allowed"
                      title={title}
                    >
                      <Icon className="h-4 w-4" />
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
                      cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </section>

      {/* Entity Form Dialog */}
      <EntityForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        node={formNode}
        onSuccess={handleFormSuccess}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  )
}
