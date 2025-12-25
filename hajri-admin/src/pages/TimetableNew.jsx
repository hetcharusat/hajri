import { useMemo, useState } from 'react'
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
import { motion, AnimatePresence } from 'framer-motion'
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

// Component type configuration
const TYPE_CONFIG = {
  LECTURE: {
    color: 'bg-blue-500',
    lightBg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-500',
    darkText: 'text-blue-400',
    icon: BookOpen,
    label: 'Lecture'
  },
  LAB: {
    color: 'bg-purple-500',
    lightBg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-500',
    darkText: 'text-purple-400',
    icon: FlaskConical,
    label: 'Lab'
  },
  TUTORIAL: {
    color: 'bg-green-500',
    lightBg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-500',
    darkText: 'text-green-400',
    icon: GraduationCap,
    label: 'Tutorial'
  }
}

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9, 
    transition: { duration: 0.2 } 
  },
  hover: {
    scale: 1.03,
    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },
  tap: { scale: 0.98 }
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

// Draggable offering card with type indicator
function DraggableOffering({ offering, isDragging, index }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: dragging } = useDraggable({
    id: `offering-${offering.id}`,
    data: { type: 'offering', offering },
  })

  const componentType = offering.subjects?.type || 'LECTURE'
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <motion.div
      ref={setNodeRef}
      variants={cardVariants}
      initial="hidden"
      animate={dragging ? "tap" : "visible"}
      whileHover={!dragging ? "hover" : undefined}
      whileTap="tap"
      custom={index}
      className={cn(
        'rounded-xl border-2 p-3 transition-colors cursor-grab active:cursor-grabbing select-none',
        config.lightBg,
        config.border,
        dragging && 'opacity-50 scale-95 shadow-2xl z-50'
      )}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      {/* Type Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <motion.div 
            className={cn("p-1.5 rounded-lg", config.color)}
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <TypeIcon className="h-3.5 w-3.5 text-white" />
          </motion.div>
          <Badge className={cn("text-[10px] font-bold uppercase", config.color, "text-white border-0")}>
            {componentType}
          </Badge>
        </div>
      </div>
      
      {/* Subject Info */}
      <div className="font-mono text-xs font-bold text-foreground">{offering.subjects?.code || '—'}</div>
      <div className="text-sm font-medium text-foreground line-clamp-2 mt-0.5">{offering.subjects?.name || '—'}</div>
      
      {/* Faculty */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">
          {offering.faculty?.name || 'TBA'}
        </span>
      </div>
    </motion.div>
  )
}

// Droppable cell with animation - ALWAYS droppable even when has event
function DroppableCell({ cellId, isOver, hasEvent, children }) {
  const { setNodeRef, isOver: dropping, active } = useDroppable({
    id: cellId,
    data: { type: 'cell', cellId },
    // Don't disable - we handle conflicts in handleDragEnd
  })

  const isActive = isOver || dropping
  const showDropIndicator = isActive && active // Only show when actively dragging

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] w-full rounded-lg p-1 relative transition-all duration-200',
        showDropIndicator && !hasEvent && 'ring-4 ring-primary/50 ring-inset bg-primary/10 shadow-xl scale-[1.02]',
        showDropIndicator && hasEvent && 'ring-4 ring-destructive/50 ring-inset bg-destructive/10',
        !hasEvent && !isActive && 'hover:bg-accent/5'
      )}
      style={{ touchAction: 'none' }}
    >
      {children}
      {/* Drop indicator overlay */}
      {showDropIndicator && !hasEvent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
          >
            ✓ Drop here
          </motion.div>
        </div>
      )}
      {showDropIndicator && hasEvent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
          >
            ✗ Occupied
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Timetable block with type indicator and animation
function TimetableBlock({ event, onEdit, onDelete, viewMode }) {
  const off = event.course_offerings
  const code = off?.subjects?.code
  const name = off?.subjects?.name
  const facultyName = off?.faculty?.name
  const roomNum = event.rooms?.room_number
  const componentType = off?.subjects?.type || 'LECTURE'
  
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'group relative rounded-xl border-2 p-2.5 shadow-md h-full min-h-[95px] flex flex-col',
        config.lightBg,
        config.border
      )}
    >
      {/* Type indicator */}
      <div className="flex items-center gap-1.5 mb-1">
        <motion.div 
          className={cn("p-1 rounded", config.color)}
          whileHover={{ scale: 1.1 }}
        >
          <TypeIcon className="h-3 w-3 text-white" />
        </motion.div>
        <span className={cn("text-[10px] font-bold uppercase", config.darkText)}>{componentType}</span>
      </div>
      
      <div className={cn("font-mono text-xs font-bold", config.darkText)}>{code || '—'}</div>
      <div className="text-xs font-semibold leading-tight mt-0.5 line-clamp-2 flex-1">{name || '—'}</div>
      
      <div className="mt-auto pt-1 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
          <span className="truncate">{facultyName || 'TBA'}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" />
          <span>{roomNum || 'No room'}</span>
        </div>
      </div>

      {viewMode === 'draft' && (
        <motion.div 
          className="absolute top-1 right-1 flex gap-0.5"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <motion.button
            type="button"
            onClick={() => onEdit(event)}
            className="rounded-full bg-background/90 p-1.5 hover:bg-secondary shadow-sm"
            title="Edit"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Edit2 className="h-3 w-3" />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onDelete(event.id)}
            className="rounded-full bg-destructive text-white p-1.5 hover:bg-destructive/80 shadow-sm"
            title="Delete"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 className="h-3 w-3" />
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  )
}

// Drag overlay component for smooth following
function DragOverlayContent({ offering }) {
  if (!offering) return null
  
  const componentType = offering.subjects?.type || 'LECTURE'
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
      animate={{ scale: 1.05, opacity: 1, rotate: 3 }}
      className={cn(
        'rounded-xl border-2 p-3 shadow-2xl cursor-grabbing w-48',
        config.lightBg,
        config.border,
        'ring-4 ring-primary/30'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg", config.color)}>
          <TypeIcon className="h-3.5 w-3.5 text-white" />
        </div>
        <Badge className={cn("text-[10px] font-bold uppercase", config.color, "text-white border-0")}>
          {componentType}
        </Badge>
      </div>
      <div className="font-mono text-xs font-bold text-foreground">{offering.subjects?.code || '—'}</div>
      <div className="text-sm font-medium text-foreground line-clamp-2 mt-0.5">{offering.subjects?.name || '—'}</div>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">{offering.faculty?.name || 'TBA'}</span>
      </div>
    </motion.div>
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

  // Filter offerings
  const filteredOfferings = useMemo(() => {
    let filtered = offerings
    
    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(o => (o.subjects?.type || 'LECTURE') === typeFilter)
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
  }, [offerings, typeFilter, searchQuery])

  // Type counts
  const typeCounts = useMemo(() => ({
    ALL: offerings.length,
    LECTURE: offerings.filter(o => (o.subjects?.type || 'LECTURE') === 'LECTURE').length,
    LAB: offerings.filter(o => o.subjects?.type === 'LAB').length,
    TUTORIAL: offerings.filter(o => o.subjects?.type === 'TUTORIAL').length,
  }), [offerings])

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

    const conflictingEvent = events.find(
      (e) => e.day_of_week === dayIdx && normalizeTimeString(e.start_time) === normalizeTimeString(period.start_time)
    )

    if (conflictingEvent) {
      setError(`Slot already occupied by ${conflictingEvent.course_offerings?.subjects?.code || 'another offering'}`)
      return
    }

    // Reset selected room and open dialog
    setSelectedRoomId(offeringData.default_room_id || null)
    setRoomPickDialog({
      offeringId: offeringData.id,
      offeringName: offeringData.subjects?.name,
      offeringCode: offeringData.subjects?.code,
      offeringType: offeringData.subjects?.type || 'LECTURE',
      dayIdx,
      dayName: DAYS[dayIdx],
      periodName: period.name,
      startTime: period.start_time,
      endTime: period.end_time,
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
        <motion.div 
          className="text-center space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div 
            className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-sm text-muted-foreground">Loading timetable...</p>
        </motion.div>
      </div>
    )
  }

  if (!selectedNode || !batchId) {
    return <Navigate to="/app/overview" replace />
  }

  const eventsByCell = {}
  for (const ev of events) {
    if (!ev.start_time) continue
    const key = cellKey(ev.day_of_week, ev.start_time)
    eventsByCell[key] = ev
  }

  const activeOffering = activeId ? offerings.find((o) => `offering-${o.id}` === activeId) : null

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
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <motion.div 
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4">
              <motion.div 
                className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <Calendar className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Class Timetable
                </h1>
                <p className="text-sm text-muted-foreground">
                  {offerings.length} offerings • Drag to schedule
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={busy || refreshing}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button
                variant={viewMode === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('draft')}
                disabled={busy}
              >
                Draft
              </Button>
              <Button
                variant={viewMode === 'published' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('published')}
                disabled={busy || !publishedVersionId}
              >
                <Eye className="mr-2 h-4 w-4" />
                Published
              </Button>
              <Button 
                size="sm"
                onClick={publishDraft} 
                disabled={busy || viewMode !== 'draft' || !templateReady}
                className="shadow-md"
              >
                <Save className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </div>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div 
                className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template Warning */}
          <AnimatePresence>
            {blockEditingReason && (
              <motion.div 
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Period template required</p>
                  <p className="text-sm text-muted-foreground">{blockEditingReason}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offerings Panel with Type Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-lg">Available Offerings</CardTitle>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Type Filter Tabs */}
                    <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                      {[
                        { key: 'ALL', label: 'All', icon: Layers, color: '' },
                        { key: 'LECTURE', label: 'Lectures', icon: BookOpen, color: 'bg-blue-500' },
                        { key: 'LAB', label: 'Labs', icon: FlaskConical, color: 'bg-purple-500' },
                        { key: 'TUTORIAL', label: 'Tutorials', icon: GraduationCap, color: 'bg-green-500' },
                      ].filter(t => t.key === 'ALL' || t.key === 'LECTURE' || t.key === 'LAB' || (t.key === 'TUTORIAL' && typeCounts.TUTORIAL > 0))
                        .map(({ key, label, icon: Icon, color }) => (
                        <motion.button
                          key={key}
                          onClick={() => setTypeFilter(key)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                            typeFilter === key 
                              ? key === 'ALL' 
                                ? 'bg-background shadow-sm text-foreground' 
                                : `${color} text-white shadow-sm`
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label} ({typeCounts[key]})
                        </motion.button>
                      ))}
                    </div>
                    
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="w-56 h-8 text-sm pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search offerings..."
                        disabled={viewMode === 'published'}
                      />
                    </div>
                  </div>
                </div>
                <CardDescription>Drag any offering to schedule it in the timetable below</CardDescription>
              </CardHeader>
              <CardContent>
                {offerings.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No offerings for this batch. Create them in Assignments first.
                  </div>
                ) : filteredOfferings.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No offerings match your filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[280px] overflow-y-auto p-1">
                    <AnimatePresence mode="popLayout">
                      {filteredOfferings.map((o, idx) => (
                        <DraggableOffering 
                          key={o.id} 
                          offering={o} 
                          isDragging={activeId === `offering-${o.id}`}
                          index={idx}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Timetable Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Weekly Timetable Grid
                    </CardTitle>
                    <CardDescription>
                      {viewMode === 'published' ? 'Published (read-only)' : 'Draft - Drag offerings into slots'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!templateReady ? (
                  <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="font-medium">Period template required</p>
                    <p className="text-sm text-muted-foreground mt-1">{blockEditingReason}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-border rounded-xl">
                    <table className="w-full border-collapse min-w-[1200px]">
                      <thead>
                        <tr>
                          <th className="border-r-2 border-b-2 border-border bg-muted/50 px-4 py-3 text-left text-sm font-semibold w-36 sticky left-0 z-10">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              Period
                            </div>
                          </th>
                          {DAYS.map((day, idx) => (
                            <th key={day} className="border-r-2 border-b-2 border-border bg-muted/50 px-3 py-3 text-center min-w-[170px]">
                              <div className="text-xs text-muted-foreground">{DAY_ABBR[idx]}</div>
                              <div className="text-sm font-semibold">{day}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period) => (
                          <tr key={period.id}>
                            <td className="border-r-2 border-b-2 border-border bg-muted/30 px-4 py-3 align-top sticky left-0 z-10">
                              <div className="text-sm font-bold">{period.name}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                {formatTime(period.start_time)} - {formatTime(period.end_time)}
                              </div>
                              {period.is_break && (
                                <Badge variant="secondary" className="mt-1 bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                                  Break
                                </Badge>
                              )}
                            </td>
                            {DAYS.map((_, dayIdx) => {
                              const key = cellKey(dayIdx, period.start_time)
                              const ev = eventsByCell[key]
                              const isOver = overId === key

                              return (
                                <td key={dayIdx} className="border-r-2 border-b-2 border-border p-1.5 align-top min-w-[170px] bg-background">
                                  {period.is_break ? (
                                    <div className="h-[100px] flex items-center justify-center rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-sm font-bold text-amber-600">
                                      ☕ Break
                                    </div>
                                  ) : (
                                    <DroppableCell cellId={key} isOver={isOver} hasEvent={Boolean(ev)}>
                                      <AnimatePresence mode="wait">
                                        {ev ? (
                                          <div className="pointer-events-auto">
                                            <TimetableBlock
                                              key={ev.id}
                                              event={ev}
                                              viewMode={viewMode}
                                              onEdit={(e) => setEditDialog({ event: e })}
                                              onDelete={handleDelete}
                                            />
                                          </div>
                                        ) : (
                                          <motion.div 
                                            key="empty"
                                            className="h-[100px] flex items-center justify-center text-xs border-2 border-dashed rounded-xl border-border/50 text-muted-foreground/50"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                          >
                                            {viewMode === 'draft' ? 'Drop here' : '—'}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </DroppableCell>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Drag Overlay - follows cursor smoothly */}
        <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
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
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={cn(
                      "text-xs",
                      TYPE_CONFIG[roomPickDialog.offeringType]?.color,
                      "text-white border-0"
                    )}>
                      {roomPickDialog.offeringType}
                    </Badge>
                    <span className="font-mono font-bold">{roomPickDialog.offeringCode}</span>
                  </div>
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
