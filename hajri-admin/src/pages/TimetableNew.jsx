import React, { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  DndContext, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  PointerSensor, 
  useSensor, 
  useSensors,
  pointerWithin,
  rectIntersection,
  MeasuringStrategy
} from '@dnd-kit/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useScopeStore, useStructureStore } from '@/lib/store'
import { 
  AlertCircle, 
  Eye, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  BookOpen, 
  FlaskConical, 
  GraduationCap,
  Filter,
  Layers,
  Calendar,
  Clock,
  User,
  MapPin,
  Search,
  X,
  Check,
  Save
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Component type configuration - using colors that work in dark theme
const TYPE_CONFIG = {
  LECTURE: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    accent: 'bg-blue-500',
    text: 'text-blue-400',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-white',
    icon: BookOpen,
    label: 'LEC',
    fullLabel: 'Lecture'
  },
  LAB: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    accent: 'bg-purple-500',
    text: 'text-purple-400',
    badgeBg: 'bg-purple-500',
    badgeText: 'text-white',
    icon: FlaskConical,
    label: 'LAB',
    fullLabel: 'Laboratory'
  },
  TUTORIAL: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    accent: 'bg-emerald-500',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500',
    badgeText: 'text-white',
    icon: GraduationCap,
    label: 'TUT',
    fullLabel: 'Tutorial'
  }
}

// Simple animation variants - minimal
const cardVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
}

const dropZoneVariants = {
  idle: { scale: 1, backgroundColor: 'transparent' },
  active: { 
    scale: 1.02, 
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
}

function normalizeTimeString(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  return trimmed
}

function newSlotId() {
  return globalThis?.crypto?.randomUUID?.() || `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeSlots(rawSlots) {
  const slotsArray = Array.isArray(rawSlots) ? rawSlots : []
  return slotsArray
    .map((s, idx) => ({
      id: s?.id || newSlotId(),
      period_number: Number.isFinite(Number(s?.period_number)) ? Number(s.period_number) : idx + 1,
      name: typeof s?.name === 'string' ? s.name : `Period ${idx + 1}`,
      start_time: normalizeTimeString(s?.start_time || '09:00:00'),
      end_time: normalizeTimeString(s?.end_time || '10:00:00'),
      is_break: Boolean(s?.is_break),
    }))
    .sort((a, b) => a.period_number - b.period_number)
}

function cellKey(dayIdx, startTime) {
  return `${dayIdx}|${normalizeTimeString(startTime)}`
}

function parseCellKey(key) {
  const [dayIdx, startTime] = key.split('|')
  return { dayIdx: Number.parseInt(dayIdx, 10), startTime: normalizeTimeString(startTime) }
}

// Check if a slot is occupied by any event (including spanning events like labs)
function isSlotOccupied(dayIdx, slotStartTime, slotEndTime, events) {
  const slotStart = normalizeTimeString(slotStartTime)
  const slotEnd = normalizeTimeString(slotEndTime)
  
  return events.find(event => {
    if (event.day_of_week !== dayIdx) return false
    
    const eventStart = normalizeTimeString(event.start_time)
    const eventEnd = normalizeTimeString(event.end_time)
    
    // Check if event overlaps with this slot
    // Event overlaps if: eventStart < slotEnd AND eventEnd > slotStart
    return eventStart < slotEnd && eventEnd > slotStart
  }) || null
}

// Calculate how many period rows an event should span
function getEventRowSpan(event, slots) {
  const eventStart = normalizeTimeString(event.start_time)
  const eventEnd = normalizeTimeString(event.end_time)
  
  let spanCount = 0
  for (const slot of slots) {
    if (slot.is_break) continue
    const slotStart = normalizeTimeString(slot.start_time)
    const slotEnd = normalizeTimeString(slot.end_time)
    
    // Check if this slot is within the event's time range
    if (slotStart >= eventStart && slotEnd <= eventEnd) {
      spanCount++
    }
  }
  
  return Math.max(1, spanCount)
}

function formatTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

// Room Select Component - Simple select that works in dialogs
function RoomSelectSimple({ rooms, value, onChange, placeholder = "Select room..." }) {
  const [search, setSearch] = useState('')
  
  const filteredRooms = useMemo(() => {
    if (!search) return rooms
    const q = search.toLowerCase()
    return rooms.filter(r => 
      r.room_number?.toLowerCase().includes(q) || 
      r.type?.toLowerCase().includes(q) ||
      r.building?.toLowerCase().includes(q)
    )
  }, [rooms, search])
  
  const selectedRoom = rooms.find(r => r.id === value)
  
  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 bg-background border-2 border-border focus:border-primary"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Room List */}
      <div className="max-h-[200px] overflow-y-auto rounded-lg border-2 border-border bg-background">
        {/* No room option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-accent",
            !value && "bg-primary/10 border-l-2 border-primary"
          )}
        >
          <div className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full border-2",
            !value ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
          )}>
            {!value && <Check className="h-3 w-3" />}
          </div>
          <span className="text-muted-foreground italic">No room assigned</span>
        </button>
        
        {filteredRooms.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No rooms found
          </div>
        ) : (
          filteredRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onChange(room.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-accent border-t border-border/50",
                value === room.id && "bg-primary/10 border-l-2 border-primary"
              )}
            >
              <div className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2",
                value === room.id ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
              )}>
                {value === room.id && <Check className="h-3 w-3" />}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium truncate">{room.room_number}</span>
                {room.type && (
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0 bg-secondary">
                    {room.type}
                  </Badge>
                )}
              </div>
              {room.capacity && (
                <span className="text-xs text-muted-foreground">
                  {room.capacity} seats
                </span>
              )}
            </button>
          ))
        )}
      </div>
      
      {/* Selected indicator */}
      {selectedRoom && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Selected: <strong>{selectedRoom.room_number}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

// Enhanced draggable offering card with clear type indicators
function DraggableOffering({ offering, isDragging, index, scheduledCount = 0 }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: dragging } = useDraggable({
    id: `offering-${offering.id}`,
    data: { type: 'offering', offering },
  })

  const componentType = offering.subjects?.type || 'LECTURE'
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative rounded-lg border-2 p-2.5 cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-all min-w-0',
        config.bg,
        config.border,
        dragging && 'opacity-50 shadow-lg'
      )}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-full', config.accent)} />
      
      {/* Header with type badge */}
      <div className="flex items-center gap-1 pl-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          config.badgeBg, config.badgeText
        )}>
          <TypeIcon className="h-2.5 w-2.5" />
          {config.label}
        </span>
        {componentType === 'LAB' && (
          <span className="text-[9px] px-1 py-0.5 rounded-full bg-orange-500/30 text-orange-300 font-semibold shrink-0">
            2h
          </span>
        )}
        {scheduledCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/30 text-green-300 font-semibold shrink-0">
            ×{scheduledCount}
          </span>
        )}
      </div>
      
      {/* Subject Code */}
      <div className={cn('font-mono text-xs font-bold pl-2 mt-1.5 truncate', config.text)}>
        {offering.subjects?.code}
      </div>
      
      {/* Name */}
      <div className="text-[11px] font-medium text-foreground/80 pl-2 mt-0.5 line-clamp-2 leading-tight">
        {offering.subjects?.name || '—'}
      </div>
      
      {/* Faculty */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-2 mt-1.5 truncate">
        <User className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{offering.faculty?.name || 'TBA'}</span>
      </div>
    </div>
  )
}

// Minimal droppable cell
function DroppableCell({ cellId, isOver, hasEvent, children, isLabSecondSlot }) {
  const { setNodeRef, isOver: dropping, active } = useDroppable({
    id: cellId,
    data: { type: 'cell', cellId },
  })

  const isActive = isOver || dropping
  const showDrop = isActive && active && !hasEvent

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative h-full min-h-[60px] rounded-lg transition-colors',
        !hasEvent && 'border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5',
        showDrop && 'border-primary border-solid bg-primary/10',
        isLabSecondSlot && 'border-accent border-solid bg-accent/10',
        hasEvent && 'border-0'
      )}
      style={{ touchAction: 'none' }}
    >
      {children}
      {showDrop && !hasEvent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-primary">Drop here</span>
        </div>
      )}
    </div>
  )
}

// Empty slot - minimal
function EmptySlot({ isLabDragNextSlot }) {
  if (isLabDragNextSlot) {
    return (
      <div className="h-full flex items-center justify-center text-accent">
        <FlaskConical className="h-4 w-4 opacity-60" />
      </div>
    )
  }
  return null
}

// Enhanced timetable block with clear type indicators
function TimetableBlock({ event, onEdit, onDelete, viewMode, rowSpan = 1 }) {
  const off = event.course_offerings
  const code = off?.subjects?.code
  const name = off?.subjects?.name
  const facultyName = off?.faculty?.name
  const roomNum = event.rooms?.room_number
  const componentType = off?.subjects?.type || 'LECTURE'
  const isMultiSlot = rowSpan > 1
  
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <div className={cn(
      'group relative h-full rounded-lg border-2 p-2.5 flex flex-col overflow-hidden',
      config.bg,
      config.border
    )}>
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', config.accent)} />
      
      {/* Type badge + Duration */}
      <div className="flex items-center gap-1.5 pl-2.5 mb-1.5">
        <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded', config.badgeBg, config.badgeText)}>
          <TypeIcon className="h-2.5 w-2.5" />
          {config.label}
        </span>
        {isMultiSlot && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 font-bold">
            {rowSpan}hr
          </span>
        )}
      </div>
      
      {/* Subject Code - prominent */}
      <div className={cn('font-mono text-sm font-bold pl-2.5', config.text)}>
        {code}
      </div>
      
      {/* Name */}
      <div className={cn(
        'text-xs font-medium text-foreground/90 mt-0.5 pl-2.5 flex-1',
        isMultiSlot ? 'line-clamp-3' : 'line-clamp-2'
      )}>
        {name || '—'}
      </div>
      
      {/* Time for multi-slot */}
      {isMultiSlot && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-2.5 mt-1">
          <Clock className="h-3 w-3" />
          <span className="font-mono">{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        </div>
      )}
      
      {/* Footer with faculty + room */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1.5 pt-1.5 pl-2.5 border-t border-current/10">
        <span className="flex items-center gap-1 truncate flex-1">
          <User className="h-3 w-3 shrink-0" />
          {facultyName || 'TBA'}
        </span>
        {roomNum && (
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3 w-3" />
            {roomNum}
          </span>
        )}
      </div>

      {/* Edit/Delete on hover */}
      {viewMode === 'draft' && (
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(event) }}
            className="w-6 h-6 rounded bg-secondary/80 flex items-center justify-center hover:bg-secondary"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
            className="w-6 h-6 rounded bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// Drag overlay component for smooth following
function DragOverlayContent({ offering }) {
  if (!offering) return null
  
  const componentType = offering.subjects?.type || 'LECTURE'
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <div className={cn(
      'rounded-lg border-2 p-3 shadow-2xl cursor-grabbing w-48',
      config.bg,
      config.border,
      'ring-2 ring-primary/50'
    )}>
      <div className={cn('absolute left-0 top-3 bottom-3 w-1.5 rounded-full', config.accent)} />
      <div className="flex items-center gap-2 pl-3">
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', config.badgeBg, config.badgeText)}>
          <TypeIcon className="h-3 w-3" />
          {config.label}
        </span>
      </div>
      <div className={cn('font-mono text-sm font-bold pl-3 mt-2', config.text)}>
        {offering.subjects?.code}
      </div>
      <div className="text-sm font-medium text-foreground pl-3 mt-0.5 line-clamp-2">
        {offering.subjects?.name || '—'}
      </div>
    </div>
  )
}

export default function TimetableNew() {
  const queryClient = useQueryClient()
  const { selectedNode } = useStructureStore()
  const { batchId, departmentId } = useScopeStore()

  const [viewMode, setViewMode] = useState('draft')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)

  const [editDialog, setEditDialog] = useState(null)
  const [roomPickDialog, setRoomPickDialog] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState(null)

  // Better sensors for smoother drag
  // Use only PointerSensor with minimal distance for responsive drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Small distance to start drag
    },
  })

  const sensors = useSensors(pointerSensor)

  // Custom collision detection that prefers empty cells
  const customCollisionDetection = (args) => {
    // First try pointerWithin for precise detection
    const pointerCollisions = pointerWithin(args)
    
    if (pointerCollisions.length > 0) {
      // Filter to only cell droppables (not the draggable items)
      const cellCollisions = pointerCollisions.filter(c => 
        typeof c.id === 'string' && c.id.includes('|')
      )
      if (cellCollisions.length > 0) {
        return cellCollisions
      }
    }
    
    // Fallback to rectIntersection
    const rectCollisions = rectIntersection(args)
    return rectCollisions.filter(c => 
      typeof c.id === 'string' && c.id.includes('|')
    )
  }

  // Refresh function
  async function handleRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['activePeriodTemplate'] }),
        queryClient.invalidateQueries({ queryKey: ['courseOfferings'] }),
        queryClient.invalidateQueries({ queryKey: ['timetableEvents'] }),
        queryClient.invalidateQueries({ queryKey: ['timetableWorkspace'] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  const roomsQuery = useQuery({
    queryKey: ['rooms', { departmentId }],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      let query = supabase.from('rooms').select('*')
      if (departmentId) query = query.eq('department_id', departmentId)
      const { data, error } = await query.order('room_number')
      if (error) throw error
      return data || []
    },
    enabled: Boolean(departmentId),
  })

  const activeTemplateQuery = useQuery({
    queryKey: ['activePeriodTemplate'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('period_templates')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data || null
    },
  })

  const periods = useMemo(() => normalizeSlots(activeTemplateQuery.data?.slots), [activeTemplateQuery.data?.slots])

  const periodByStartTime = useMemo(() => {
    const map = new Map()
    for (const p of periods) map.set(normalizeTimeString(p.start_time), p)
    return map
  }, [periods])

  async function getOrCreateDraftVersion(targetBatchId) {
    const existing = await supabase
      .from('timetable_versions')
      .select('id')
      .eq('batch_id', targetBatchId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing.error) throw existing.error
    if (existing.data?.id) return existing.data.id

    const created = await supabase
      .from('timetable_versions')
      .insert([{ batch_id: targetBatchId, status: 'draft', name: 'Draft' }])
      .select('id')
      .single()

    if (created.error) throw created.error
    return created.data.id
  }

  async function getPublishedVersion(targetBatchId) {
    const res = await supabase
      .from('timetable_versions')
      .select('id')
      .eq('batch_id', targetBatchId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (res.error) throw res.error
    return res.data?.id || null
  }

  const workspaceQuery = useQuery({
    queryKey: ['timetableWorkspace', { batchId }],
    enabled: Boolean(batchId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const [draftVersionId, publishedVersionId] = await Promise.all([
        getOrCreateDraftVersion(batchId),
        getPublishedVersion(batchId),
      ])
      return { draftVersionId, publishedVersionId }
    },
  })

  const draftVersionId = workspaceQuery.data?.draftVersionId || null
  const publishedVersionId = workspaceQuery.data?.publishedVersionId || null
  const activeVersionId = viewMode === 'published' ? publishedVersionId : draftVersionId

  const offeringsQuery = useQuery({
    queryKey: ['courseOfferings', { batchId }],
    enabled: Boolean(batchId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const res = await supabase
        .from('course_offerings')
        .select(`*, subjects(code, name, type), faculty(name), rooms:default_room_id(room_number)`)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
      if (res.error) throw res.error
      return res.data || []
    },
  })

  const eventsQuery = useQuery({
    queryKey: ['timetableEvents', { versionId: activeVersionId }],
    enabled: Boolean(activeVersionId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const res = await supabase
        .from('timetable_events')
        .select(`id, version_id, offering_id, day_of_week, start_time, end_time, room_id, rooms:room_id(room_number), course_offerings(*, subjects(code, name, type), faculty(name))`)
        .eq('version_id', activeVersionId)
      if (res.error) throw res.error
      return res.data || []
    },
  })

  const rooms = roomsQuery.data || []
  const offerings = offeringsQuery.data || []
  const events = eventsQuery.data || []

  // Get set of assigned offering IDs and their counts
  const assignedOfferingIds = useMemo(() => {
    return new Set(events.map(e => e.offering_id))
  }, [events])

  // Count how many times each offering is scheduled
  const scheduledCountMap = useMemo(() => {
    const map = new Map()
    events.forEach(e => {
      map.set(e.offering_id, (map.get(e.offering_id) || 0) + 1)
    })
    return map
  }, [events])

  // State for assignment filter
  const [assignmentFilter, setAssignmentFilter] = useState('ALL') // 'ALL', 'UNASSIGNED', 'ASSIGNED'

  // Filter offerings
  const filteredOfferings = useMemo(() => {
    let filtered = offerings
    
    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(o => (o.subjects?.type || 'LECTURE') === typeFilter)
    }
    
    // Filter by assignment status
    if (assignmentFilter === 'UNASSIGNED') {
      filtered = filtered.filter(o => !assignedOfferingIds.has(o.id))
    } else if (assignmentFilter === 'ASSIGNED') {
      filtered = filtered.filter(o => assignedOfferingIds.has(o.id))
    }
    
    // Filter by search
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(o => {
        const text = `${o.subjects?.code || ''} ${o.subjects?.name || ''} ${o.faculty?.name || ''} ${o.subjects?.type || ''}`.toLowerCase()
        return text.includes(q)
      })
    }
    
    return filtered
  }, [offerings, typeFilter, searchQuery, assignmentFilter, assignedOfferingIds])

  // Type counts
  const typeCounts = useMemo(() => ({
    ALL: offerings.length,
    LECTURE: offerings.filter(o => (o.subjects?.type || 'LECTURE') === 'LECTURE').length,
    LAB: offerings.filter(o => o.subjects?.type === 'LAB').length,
    TUTORIAL: offerings.filter(o => o.subjects?.type === 'TUTORIAL').length,
  }), [offerings])

  // Assignment counts
  const assignmentCounts = useMemo(() => ({
    ALL: offerings.length,
    UNASSIGNED: offerings.filter(o => !assignedOfferingIds.has(o.id)).length,
    ASSIGNED: offerings.filter(o => assignedOfferingIds.has(o.id)).length,
  }), [offerings, assignedOfferingIds])

  const templateReady = Boolean(activeTemplateQuery.data) && periods.length > 0
  const blockEditingReason = !activeTemplateQuery.data
    ? 'No period template exists. Create one in Period Templates first.'
    : periods.length === 0
      ? 'Active period template has no periods. Add periods first.'
      : null

  const placeEventMutation = useMutation({
    mutationFn: async ({ versionId, offeringId, dayIdx, startTime, endTime, roomId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      if (!versionId) throw new Error('No active timetable version')

      const normalizedStart = normalizeTimeString(startTime)
      const normalizedEnd = normalizeTimeString(endTime)

      await supabase
        .from('timetable_events')
        .delete()
        .eq('version_id', versionId)
        .eq('day_of_week', dayIdx)
        .eq('start_time', normalizedStart)

      const ins = await supabase.from('timetable_events').insert([{
        version_id: versionId,
        offering_id: offeringId,
        day_of_week: dayIdx,
        start_time: normalizedStart,
        end_time: normalizedEnd,
        room_id: roomId || null,
      }])

      if (ins.error) throw ins.error
    },
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['timetableEvents', { versionId: vars.versionId }] })
    },
    onError: (e) => setError(e?.message || 'Failed to place event'),
  })

  const deleteEventMutation = useMutation({
    mutationFn: async ({ versionId, eventId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const res = await supabase.from('timetable_events').delete().eq('id', eventId)
      if (res.error) throw res.error
      return versionId
    },
    onSuccess: async (versionId) => {
      await queryClient.invalidateQueries({ queryKey: ['timetableEvents', { versionId }] })
    },
    onError: (e) => setError(e?.message || 'Failed to delete event'),
  })

  const updateEventRoomMutation = useMutation({
    mutationFn: async ({ versionId, eventId, roomId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const res = await supabase.from('timetable_events').update({ room_id: roomId || null }).eq('id', eventId)
      if (res.error) throw res.error
      return versionId
    },
    onSuccess: async (versionId) => {
      await queryClient.invalidateQueries({ queryKey: ['timetableEvents', { versionId }] })
    },
    onError: (e) => setError(e?.message || 'Failed to update room'),
  })

  const publishDraftMutation = useMutation({
    mutationFn: async ({ batchId: targetBatchId, draftVersionId: targetDraftId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      if (!targetBatchId || !targetDraftId) throw new Error('Draft version not ready')

      await supabase
        .from('timetable_versions')
        .update({ status: 'archived' })
        .eq('batch_id', targetBatchId)
        .eq('status', 'published')

      const pubRes = await supabase
        .from('timetable_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', targetDraftId)
      if (pubRes.error) throw pubRes.error

      const newDraftRes = await supabase
        .from('timetable_versions')
        .insert([{ batch_id: targetBatchId, status: 'draft', name: 'Draft' }])
        .select('id')
        .single()
      if (newDraftRes.error) throw newDraftRes.error

      return { newDraftId: newDraftRes.data.id }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['timetableWorkspace'] }),
        queryClient.invalidateQueries({ queryKey: ['timetableEvents'] }),
      ])
      setViewMode('published')
    },
    onError: (e) => setError(e?.message || 'Failed to publish draft'),
  })

  const busy = refreshing ||
    placeEventMutation.isPending ||
    deleteEventMutation.isPending ||
    updateEventRoomMutation.isPending ||
    publishDraftMutation.isPending

  const loading =
    roomsQuery.isLoading ||
    activeTemplateQuery.isLoading ||
    workspaceQuery.isLoading ||
    offeringsQuery.isLoading ||
    eventsQuery.isLoading

  function handleDragStart(event) {
    setActiveId(event.active.id)
    setError('')
  }

  function handleDragOver(event) {
    setOverId(event.over?.id || null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || viewMode === 'published') return
    if (!batchId || !templateReady || !activeVersionId) {
      setError(blockEditingReason || 'Period template required')
      return
    }

    const offeringData = active.data.current?.offering
    if (!offeringData) return

    // Check if dropped on a valid cell
    if (typeof over.id !== 'string' || !over.id.includes('|')) return

    const { dayIdx, startTime } = parseCellKey(over.id)
    const period = periodByStartTime.get(normalizeTimeString(startTime))
    if (!period) return
    if (period.is_break) {
      setError('Cannot schedule classes into a break slot')
      return
    }

    // Check if this slot is occupied (including by spanning events)
    const slotOccupied = isSlotOccupied(dayIdx, period.start_time, period.end_time, events)
    if (slotOccupied) {
      setError(`Slot already occupied by ${slotOccupied.course_offerings?.subjects?.code || 'another offering'}`)
      return
    }

    // Determine subject type and calculate end time
    const subjectType = offeringData.subjects?.type || 'LECTURE'
    let endTime = period.end_time
    let periodName = period.name
    let isLabMerge = false

    // LAB handling - needs 2 consecutive slots
    if (subjectType === 'LAB') {
      const currentPeriodIndex = periods.findIndex(p => 
        normalizeTimeString(p.start_time) === normalizeTimeString(period.start_time)
      )
      const nextPeriod = periods[currentPeriodIndex + 1]

      // Validate next slot exists
      if (!nextPeriod) {
        setError('Lab requires 2 consecutive periods. No period after this slot.')
        return
      }

      // Validate next slot is not a break
      if (nextPeriod.is_break) {
        setError('Lab requires 2 consecutive periods. Next slot is a break.')
        return
      }

      // Check if next slot is occupied (including by spanning events)
      const nextSlotOccupied = isSlotOccupied(dayIdx, nextPeriod.start_time, nextPeriod.end_time, events)
      if (nextSlotOccupied) {
        setError(`Lab requires 2 consecutive periods. Next slot is occupied by ${nextSlotOccupied.course_offerings?.subjects?.code || 'another offering'}.`)
        return
      }

      // Use next period's end time for 2-hour duration
      endTime = nextPeriod.end_time
      periodName = `${period.name} + ${nextPeriod.name}`
      isLabMerge = true
    }

    // Reset selected room and open dialog
    setSelectedRoomId(offeringData.default_room_id || null)
    setRoomPickDialog({
      offeringId: offeringData.id,
      offeringName: offeringData.subjects?.name,
      offeringCode: offeringData.subjects?.code,
      offeringType: subjectType,
      dayIdx,
      dayName: DAYS[dayIdx],
      periodName,
      startTime: period.start_time,
      endTime,
      isLabMerge,
    })
  }

  function handleDragCancel() {
    setActiveId(null)
    setOverId(null)
  }

  async function saveWithRoom() {
    if (!roomPickDialog || !activeVersionId) return
    const { offeringId, dayIdx, startTime, endTime } = roomPickDialog

    setError('')
    placeEventMutation.mutate(
      { versionId: activeVersionId, offeringId, dayIdx, startTime, endTime, roomId: selectedRoomId || null },
      { onSuccess: () => {
        setRoomPickDialog(null)
        setSelectedRoomId(null)
      }}
    )
  }

  async function handleDelete(eventId) {
    if (!confirm('Delete this block?')) return
    if (!activeVersionId) return
    setError('')
    deleteEventMutation.mutate({ versionId: activeVersionId, eventId })
  }

  async function handleEditSave(eventId, roomId) {
    if (!activeVersionId) return
    setError('')
    updateEventRoomMutation.mutate(
      { versionId: activeVersionId, eventId, roomId: roomId || null },
      { onSuccess: () => setEditDialog(null) }
    )
  }

  async function publishDraft() {
    if (!batchId || !draftVersionId) return
    if (!confirm('Publish this draft? Existing published version will be archived.')) return
    setError('')
    publishDraftMutation.mutate({ batchId, draftVersionId })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Loading timetable...</p>
        </div>
      </div>
    )
  }

  if (!selectedNode || !batchId) {
    return <Navigate to="/app/overview" replace />
  }

  // Build eventsByCell - maps each cell to the event that occupies it
  // For multi-slot events (labs), mark all spanned cells
  const eventsByCell = {}
  const eventSpanInfo = {} // Track which events span multiple rows
  
  for (const ev of events) {
    if (!ev.start_time) continue
    
    const eventStart = normalizeTimeString(ev.start_time)
    const eventEnd = normalizeTimeString(ev.end_time)
    const rowSpan = getEventRowSpan(ev, periods)
    
    // Store span info for the primary cell (first slot)
    const primaryKey = cellKey(ev.day_of_week, ev.start_time)
    eventsByCell[primaryKey] = ev
    eventSpanInfo[primaryKey] = { rowSpan, isPrimary: true }
    
    // Mark spanned cells (for multi-slot events like labs)
    if (rowSpan > 1) {
      let spanCount = 0
      for (const slot of periods) {
        if (slot.is_break) continue
        const slotStart = normalizeTimeString(slot.start_time)
        const slotEnd = normalizeTimeString(slot.end_time)
        
        // Check if this slot is within the event's time range
        if (slotStart >= eventStart && slotEnd <= eventEnd) {
          spanCount++
          if (spanCount > 1) {
            // This is a spanned cell (not the primary)
            const spannedKey = cellKey(ev.day_of_week, slot.start_time)
            eventsByCell[spannedKey] = ev
            eventSpanInfo[spannedKey] = { rowSpan: 0, isPrimary: false, primaryKey }
          }
        }
      }
    }
  }

  const activeOffering = activeId ? offerings.find((o) => `offering-${o.id}` === activeId) : null
  const activeOfferingType = activeOffering?.subjects?.type || 'LECTURE'

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="space-y-4">
          {/* Header - Minimal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Timetable</h1>
                <p className="text-xs text-muted-foreground">{offerings.length} offerings available</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={busy || refreshing}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                variant={viewMode === 'draft' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('draft')}
                disabled={busy}
              >
                Draft
              </Button>
              <Button
                variant={viewMode === 'published' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('published')}
                disabled={busy || !publishedVersionId}
              >
                Published
              </Button>
              <Button 
                size="sm"
                onClick={publishDraft} 
                disabled={busy || viewMode !== 'draft' || !templateReady}
              >
                <Save className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive flex-1">{error}</span>
              <button onClick={() => setError('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Template Warning */}
          {blockEditingReason && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{blockEditingReason}</span>
            </div>
          )}

          {/* Offerings Panel - Enhanced Design */}
          <div className="rounded-lg border border-border bg-card">
            {/* Header */}
            <div className="p-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Offerings</span>
                <span className="text-xs text-muted-foreground">({offerings.length})</span>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {/* Assignment Status Filter */}
                <div className="flex items-center gap-1 text-xs bg-muted/50 rounded-lg p-1">
                  {[
                    { key: 'ALL', label: 'All', count: assignmentCounts.ALL },
                    { key: 'UNASSIGNED', label: 'Pending', count: assignmentCounts.UNASSIGNED },
                    { key: 'ASSIGNED', label: 'Scheduled', count: assignmentCounts.ASSIGNED },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setAssignmentFilter(key)}
                      className={cn(
                        "px-2 py-1 rounded transition-colors flex items-center gap-1.5",
                        assignmentFilter === key 
                          ? key === 'UNASSIGNED' ? 'bg-orange-500 text-white' : key === 'ASSIGNED' ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {label}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        assignmentFilter === key ? 'bg-white/20' : 'bg-muted'
                      )}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-1 text-xs bg-muted/50 rounded-lg p-1">
                  {['ALL', 'LECTURE', 'LAB', 'TUTORIAL'].filter(t => t === 'ALL' || typeCounts[t] > 0).map(key => (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(key)}
                      className={cn(
                        "px-2 py-1 rounded transition-colors",
                        typeFilter === key 
                          ? key === 'LECTURE' ? 'bg-blue-600 text-white' : key === 'LAB' ? 'bg-purple-600 text-white' : key === 'TUTORIAL' ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {key === 'ALL' ? 'All Types' : key.charAt(0) + key.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="w-40 h-8 text-xs pl-7 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search code, name..."
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Refresh Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['courseOfferings'] })
                    queryClient.invalidateQueries({ queryKey: ['timetableEvents'] })
                  }}
                  className="h-8 px-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-3">
              {offerings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No offerings available
                </div>
              ) : filteredOfferings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No matches found
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto overflow-x-hidden">
                  {filteredOfferings.map((o, idx) => (
                    <DraggableOffering 
                      key={o.id} 
                      offering={o} 
                      isDragging={activeId === `offering-${o.id}`}
                      index={idx}
                      scheduledCount={scheduledCountMap.get(o.id) || 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timetable Grid - Minimal Clean Design */}
          <div className="mt-4">
            {!templateReady ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">Period Template Required</p>
                <p className="text-sm text-muted-foreground/60 mt-1">{blockEditingReason}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {/* CSS Grid: 7 columns (time + 6 days), rows based on periods */}
                <div 
                  className="grid"
                  style={{ 
                    gridTemplateColumns: '100px repeat(6, 1fr)',
                    gridTemplateRows: `auto repeat(${periods.length}, minmax(56px, auto))`
                  }}
                >
                  {/* Header Row */}
                  <div className="bg-muted/50 border-b border-r border-border p-2 flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Time</span>
                  </div>
                  {DAYS.map((day, idx) => (
                    <div 
                      key={day} 
                      className={cn(
                        "bg-muted/50 border-b border-border p-2 text-center",
                        idx < 5 && "border-r"
                      )}
                    >
                      <div className="text-xs font-bold text-foreground">{day}</div>
                    </div>
                  ))}
                  
                  {/* Period Rows */}
                  {periods.map((period, periodIdx) => {
                    const isLast = periodIdx === periods.length - 1
                    
                    return (
                      <React.Fragment key={period.id}>
                        {/* Time Label Cell */}
                        <div className={cn(
                          "border-r border-border p-2 flex flex-col justify-center",
                          !isLast && "border-b",
                          period.is_break && "bg-warning/5"
                        )}>
                          <div className={cn(
                            "text-xs font-semibold",
                            period.is_break ? "text-warning" : "text-foreground"
                          )}>
                            {period.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatTime(period.start_time)}
                          </div>
                          {period.is_break && (
                            <span className="text-[10px] text-warning mt-0.5">Break</span>
                          )}
                        </div>
                        
                        {/* Day Cells for this Period */}
                        {DAYS.map((_, dayIdx) => {
                          const key = cellKey(dayIdx, period.start_time)
                          const ev = eventsByCell[key]
                          const spanInfo = eventSpanInfo[key]
                          const isOver = overId === key
                          const isLastDay = dayIdx === 5
                          
                          // Check if lab drag should highlight next slot
                          const isLabDragNextSlot = activeOfferingType === 'LAB' && (() => {
                            if (!overId) return false
                            const { dayIdx: overDayIdx, startTime: overStartTime } = parseCellKey(overId)
                            if (overDayIdx !== dayIdx) return false
                            const overPeriodIndex = periods.findIndex(p => 
                              normalizeTimeString(p.start_time) === overStartTime
                            )
                            const currentPeriodIndex = periods.findIndex(p => 
                              normalizeTimeString(p.start_time) === normalizeTimeString(period.start_time)
                            )
                            return currentPeriodIndex === overPeriodIndex + 1
                          })()
                          
                          // If this cell is covered by a spanning event (not primary), skip rendering
                          if (spanInfo && !spanInfo.isPrimary) {
                            return null // Cell is merged - don't render
                          }
                          
                          const rowSpan = spanInfo?.rowSpan || 1
                          
                          // Break cell
                          if (period.is_break) {
                            return (
                              <div
                                key={dayIdx}
                                className={cn(
                                  "bg-warning/5 flex items-center justify-center",
                                  !isLast && "border-b border-border",
                                  !isLastDay && "border-r border-border"
                                )}
                              >
                                <span className="text-warning/40 text-sm">—</span>
                              </div>
                            )
                          }

                          // Regular cell - use gridRow for spanning
                          return (
                            <div
                              key={dayIdx}
                              className={cn(
                                "p-1",
                                !isLast && rowSpan === 1 && "border-b border-border",
                                !isLastDay && "border-r border-border"
                              )}
                              style={{
                                gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined
                              }}
                            >
                              <DroppableCell 
                                cellId={key} 
                                isOver={isOver || isLabDragNextSlot} 
                                hasEvent={Boolean(ev)}
                                isLabSecondSlot={isLabDragNextSlot}
                              >
                                {ev ? (
                                  <TimetableBlock
                                    event={ev}
                                    viewMode={viewMode}
                                    onEdit={(e) => setEditDialog({ event: e })}
                                    onDelete={handleDelete}
                                    rowSpan={rowSpan}
                                  />
                                ) : (
                                  <EmptySlot isLabDragNextSlot={isLabDragNextSlot} />
                                )}
                              </DroppableCell>
                            </div>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 p-3 border-t border-border bg-muted/30">
                  {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                    const Icon = config.icon
                    return (
                      <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className={cn("w-2.5 h-2.5 rounded-sm", config.accent)} />
                        <Icon className="h-3 w-3" />
                        <span>{type}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          <DragOverlayContent offering={activeOffering} />
        </DragOverlay>
      </DndContext>

      {/* Room Picker Dialog - Searchable */}
      <Dialog open={Boolean(roomPickDialog)} onOpenChange={(open) => {
        if (!open) {
          setRoomPickDialog(null)
          setSelectedRoomId(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Select Room
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {roomPickDialog && (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={cn(
                        "text-xs",
                        TYPE_CONFIG[roomPickDialog.offeringType]?.color,
                        "text-white border-0"
                      )}>
                        {roomPickDialog.offeringType}
                      </Badge>
                      <span className="font-mono font-bold">{roomPickDialog.offeringCode}</span>
                      {roomPickDialog.isLabMerge && (
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">
                          2 Hours
                        </Badge>
                      )}
                    </div>
                    {roomPickDialog.isLabMerge && (
                      <div className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1.5 rounded-md border border-purple-500/20">
                        ⚗️ Lab will occupy 2 consecutive periods
                      </div>
                    )}
                  </>
                )}
                <div className="text-sm">
                  Scheduling for <strong>{roomPickDialog?.dayName}</strong>, <strong>{roomPickDialog?.periodName}</strong>
                  <span className="text-muted-foreground ml-1">
                    ({formatTime(roomPickDialog?.startTime)} - {formatTime(roomPickDialog?.endTime)})
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Room Assignment</Label>
              <RoomSelectSimple
                rooms={rooms}
                value={selectedRoomId}
                onChange={setSelectedRoomId}
              />
              <p className="text-xs text-muted-foreground mt-2">
                You can leave this empty and assign a room later
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRoomPickDialog(null)
                  setSelectedRoomId(null)
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={saveWithRoom}
                disabled={placeEventMutation.isPending}
              >
                {placeEventMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Schedule Class
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Searchable */}
      <Dialog open={Boolean(editDialog)} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Event
            </DialogTitle>
            <DialogDescription>Update room assignment for this class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Room</Label>
              <RoomSelectSimple
                rooms={rooms}
                value={editDialog?.event?.room_id || null}
                onChange={(roomId) => {
                  if (editDialog?.event) {
                    handleEditSave(editDialog.event.id, roomId)
                  }
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
