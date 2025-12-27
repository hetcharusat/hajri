import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  MapPin, 
  RefreshCw, 
  Trash2, 
  User, 
  X, 
  Sparkles,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Filter,
  Layers,
  Grid3X3,
  Calendar
} from 'lucide-react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cellKey(dayIdx, periodId) {
  return `${dayIdx}|${periodId}`
}

// Component type colors and icons
const TYPE_CONFIG = {
  LECTURE: {
    color: 'bg-blue-500',
    lightBg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
    icon: BookOpen,
    label: 'Lecture'
  },
  LAB: {
    color: 'bg-purple-500',
    lightBg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600',
    icon: FlaskConical,
    label: 'Lab'
  },
  TUTORIAL: {
    color: 'bg-green-500',
    lightBg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
    icon: GraduationCap,
    label: 'Tutorial'
  }
}

function DraggableOffering({ offering, active, disabled, compact = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `offering:${offering.id}`,
    disabled,
    data: { offering },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000 }
    : undefined

  const teachers = offering.faculty_names?.join(', ') || offering.faculty?.name || 'No faculty'
  const componentType = offering.component_type || 'LECTURE'
  const batchLabel = offering.batch_letter || ''
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "rounded-lg p-3 border-2 transition-all cursor-grab active:cursor-grabbing",
          config.lightBg,
          config.border,
          active && 'ring-2 ring-primary shadow-lg scale-[1.02]',
          isDragging && 'opacity-40 scale-95'
        )}
      >
        <div className="flex items-start gap-2">
          <div className={cn("p-1.5 rounded-md", config.color)}>
            <TypeIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-mono text-xs font-bold">{offering.subject_code}</span>
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", config.color, "text-white")}>
                {componentType}
              </Badge>
            </div>
            <div className="text-xs font-medium truncate">{offering.subject_name}</div>
            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
              {teachers}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-xl p-4 border-2 transition-all cursor-grab active:cursor-grabbing hover:shadow-md",
        config.lightBg,
        config.border,
        active && 'ring-2 ring-primary shadow-xl scale-[1.02]',
        isDragging && 'opacity-40 scale-95'
      )}
    >
      {/* Type Badge Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg shadow-sm", config.color)}>
            <TypeIcon className="h-4 w-4 text-white" />
          </div>
          <Badge className={cn("font-bold uppercase text-xs", config.color, "text-white border-0")}>
            {componentType}
          </Badge>
        </div>
        {batchLabel && (
          <Badge variant="outline" className="bg-pink-500/10 text-pink-600 border-pink-500/30">
            Batch {batchLabel}
          </Badge>
        )}
      </div>
      
      {/* Subject Info */}
      <div className="space-y-1">
        <div className="font-mono text-sm font-bold text-foreground">{offering.subject_code || '—'}</div>
        <div className="text-sm font-medium text-foreground line-clamp-2">{offering.subject_name || '—'}</div>
      </div>
      
      {/* Faculty */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">{teachers}</span>
      </div>
    </div>
  )
}

function DroppableCell({ id, children, isOver }) {
  const { setNodeRef, isOver: hovering } = useDroppable({ id })
  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "h-full min-h-[80px] transition-all rounded-lg",
        hovering && 'bg-primary/20 ring-2 ring-primary ring-inset'
      )}
    >
      {children}
    </div>
  )
}

// Scheduled Event Card with component type
function ScheduledEvent({ event, onDelete, disabled, componentType }) {
  const config = TYPE_CONFIG[componentType] || TYPE_CONFIG.LECTURE
  const TypeIcon = config.icon

  return (
    <Card className={cn(
      "p-2.5 relative group transition-all hover:shadow-md",
      config.lightBg,
      config.border
    )}>
      {!disabled && (
        <button
          className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-all bg-destructive text-white rounded-full p-1 shadow-md hover:scale-110"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      
      <div className="flex items-start gap-2">
        <div className={cn("p-1 rounded", config.color, "shrink-0")}>
          <TypeIcon className="h-3 w-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={cn("text-xs font-bold", config.text)}>
              {event.subject_code || '—'}
            </span>
            {event.batch_letters?.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-pink-500/10 text-pink-600 border-pink-500/30">
                {event.batch_letters.join(', ')}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{event.subject_name}</div>
          {event.faculty && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
              <User className="h-2.5 w-2.5" />
              <span className="truncate">{event.faculty}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export function TimetablePanel({ batchId, refreshKey }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [periods, setPeriods] = useState([])
  const [viewMode, setViewMode] = useState('draft')
  const [draftVersionId, setDraftVersionId] = useState(null)
  const [publishedVersionId, setPublishedVersionId] = useState(null)

  const [classId, setClassId] = useState(null)
  const [semesterId, setSemesterId] = useState(null)
  const [allBatches, setAllBatches] = useState([])
  const [offerings, setOfferings] = useState([])
  const [eventsByCell, setEventsByCell] = useState({})
  
  const [offeringSearch, setOfferingSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // ALL, LECTURE, LAB, TUTORIAL
  const [activeOffering, setActiveOffering] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeVersionId = viewMode === 'published' ? publishedVersionId : draftVersionId

  // Refresh function
  async function handleRefresh() {
    if (!batchId || refreshing) return
    setRefreshing(true)
    try {
      await loadBootstrap(batchId)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (batchId) {
      loadBootstrap(batchId)
    }
  }, [batchId, refreshKey])

  useEffect(() => {
    if (!classId || !activeVersionId) return
    loadEvents()
  }, [viewMode, draftVersionId, publishedVersionId, classId])

  async function loadBootstrap(targetBatchId) {
    try {
      setLoading(true)
      setError('')

      const batchRes = await supabase.from('batches').select('id, batch_letter, class_id').eq('id', targetBatchId).single()
      if (batchRes.error) throw batchRes.error

      const batch = batchRes.data
      const targetClassId = batch.class_id

      const classRes = await supabase.from('classes').select('id, semester_id').eq('id', targetClassId).single()
      if (classRes.error) throw classRes.error

      const targetSemesterId = classRes.data.semester_id

      setClassId(targetClassId)
      setSemesterId(targetSemesterId)

      const batchesRes = await supabase
        .from('batches')
        .select('id, batch_letter')
        .eq('class_id', targetClassId)
        .order('batch_letter')

      if (batchesRes.error) throw batchesRes.error
      setAllBatches(batchesRes.data || [])

      // Load periods from active template's slots (JSONB)
      const templateRes = await supabase
        .from('period_templates')
        .select('id, slots')
        .eq('is_active', true)
        .single()

      if (!templateRes.error && templateRes.data) {
        const slots = templateRes.data.slots || []
        const normalizedPeriods = slots.map((s, idx) => ({
          id: s.id || `slot_${idx}`,
          period_number: s.period_number || idx + 1,
          name: s.name || `Period ${idx + 1}`,
          start_time: s.start_time || '09:00:00',
          end_time: s.end_time || '10:00:00',
          is_break: s.is_break || false,
        })).sort((a, b) => a.period_number - b.period_number)
        setPeriods(normalizedPeriods)
      }

      const [draftId, pubId] = await Promise.all([
        getOrCreateDraftVersion(targetBatchId),
        getPublishedVersion(targetBatchId),
      ])

      setDraftVersionId(draftId)
      setPublishedVersionId(pubId)

      const offeringsRes = await supabase
        .from('course_offerings')
        .select(`
          *,
          subjects(code, name, type),
          faculty(name, email, abbr),
          batches(batch_letter)
        `)
        .eq('batch_id', targetBatchId)

      if (!offeringsRes.error) {
        const data = (offeringsRes.data || []).map(o => ({
          id: o.id,
          batch_id: o.batch_id,
          subject_id: o.subject_id,
          subject_code: o.subjects?.code,
          subject_name: o.subjects?.name,
          component_type: o.subjects?.type || 'LECTURE',
          faculty_names: o.faculty ? [o.faculty.name] : [],
          faculty_abbrs: o.faculty ? [o.faculty.abbr] : [],
          batch_letter: o.batches?.batch_letter,
          default_room_id: o.default_room_id,
        }))
        setOfferings(data)
      }
      
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

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

  async function loadEvents() {
    try {
      if (!activeVersionId) {
        setEventsByCell({})
        return
      }

      const res = await supabase
        .from('timetable_events')
        .select(`
          *,
          course_offerings!offering_id(
            id,
            subjects(code, name, type),
            faculty(name, abbr),
            batches(batch_letter)
          )
        `)
        .eq('version_id', activeVersionId)

      if (res.error) throw res.error

      const map = {}
      for (const ev of res.data || []) {
        const key = cellKey(ev.day_of_week, ev.period_id || `time:${ev.start_time}`)
        if (!map[key]) map[key] = []
        map[key].push({
          id: ev.id,
          subject_code: ev.course_offerings?.subjects?.code,
          subject_name: ev.course_offerings?.subjects?.name,
          component_type: ev.course_offerings?.subjects?.type || 'LECTURE',
          faculty: ev.course_offerings?.faculty?.name,
          faculty_abbr: ev.course_offerings?.faculty?.abbr,
          batch_letters: ev.course_offerings?.batches?.batch_letter ? [ev.course_offerings.batches.batch_letter] : [],
        })
      }
      setEventsByCell(map)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDrop(evt) {
    const offering = evt?.active?.data?.current?.offering
    const dropTarget = evt?.over?.id
    
    if (!offering || !dropTarget || !activeVersionId || viewMode === 'published') return

    try {
      setBusy(true)
      setError('')

      const [dayStr, periodId] = String(dropTarget).split('|')
      const dayOfWeek = Number.parseInt(dayStr, 10)

      const period = periods.find(p => p.id === periodId)
      if (!period) {
        setError('Invalid period')
        return
      }

      // Delete any existing event in this slot to avoid duplicate key error
      await supabase
        .from('timetable_events')
        .delete()
        .eq('version_id', activeVersionId)
        .eq('day_of_week', dayOfWeek)
        .eq('period_id', periodId)
        .eq('offering_id', offering.id)

      const { error: insertError } = await supabase
        .from('timetable_events')
        .insert([{
          version_id: activeVersionId,
          offering_id: offering.id,
          day_of_week: dayOfWeek,
          period_id: periodId,
          start_time: period.start_time,
          end_time: period.end_time,
          room_id: offering.default_room_id || null,
        }])

      if (insertError) throw insertError
      await loadEvents()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteEvent(eventId) {
    if (viewMode === 'published') return
    try {
      setBusy(true)
      setError('')
      
      const { error } = await supabase
        .from('timetable_events')
        .delete()
        .eq('id', eventId)
      
      if (error) throw error
      await loadEvents()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!draftVersionId) return
    try {
      setBusy(true)
      setError('')

      // Set all other versions to archived
      await supabase
        .from('timetable_versions')
        .update({ status: 'archived' })
        .eq('batch_id', batchId)
        .neq('id', draftVersionId)
        .eq('status', 'published')

      // Publish current draft
      const { error } = await supabase
        .from('timetable_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftVersionId)

      if (error) throw error

      setPublishedVersionId(draftVersionId)
      
      // Create new draft
      const newDraftId = await getOrCreateDraftVersion(batchId)
      setDraftVersionId(newDraftId)
      
      setViewMode('published')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Filter offerings by search and type
  const visibleOfferings = useMemo(() => {
    let filtered = offerings
    
    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(o => o.component_type === typeFilter)
    }
    
    // Filter by search
    const q = offeringSearch.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((o) => {
        const text = `${o.subject_code || ''} ${o.subject_name || ''} ${o.faculty_names?.join(' ') || ''} ${o.faculty_abbrs?.join(' ') || ''} ${o.component_type || ''}`.toLowerCase()
        return text.includes(q)
      })
    }
    
    return filtered
  }, [offerings, offeringSearch, typeFilter])

  // Count by type
  const typeCounts = useMemo(() => ({
    ALL: offerings.length,
    LECTURE: offerings.filter(o => o.component_type === 'LECTURE').length,
    LAB: offerings.filter(o => o.component_type === 'LAB').length,
    TUTORIAL: offerings.filter(o => o.component_type === 'TUTORIAL').length,
  }), [offerings])

  // Format time display
  function formatTime(time) {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2, '0')} ${period}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading timetable...</p>
        </div>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-lg font-semibold">No Period Template</p>
            <p className="text-sm text-muted-foreground mt-1">Go to the Periods tab to create your schedule template</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(evt) => {
        const offering = evt?.active?.data?.current?.offering
        setActiveOffering(offering)
      }}
      onDragEnd={(evt) => {
        handleDrop(evt)
        setActiveOffering(null)
      }}
    >
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    Class Timetable
                    <Sparkles className="h-4 w-4 text-primary/60" />
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {allBatches.length} batch{allBatches.length !== 1 ? 'es' : ''} • {offerings.length} offerings
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || busy}
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
                {viewMode === 'draft' && (
                  <Button size="sm" onClick={handlePublish} disabled={busy} className="shadow-md">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Publish
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 mb-4">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-sm text-destructive flex-1">{error}</p>
                <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {/* Offerings Panel with Type Filters */}
          <div className="px-4 pb-4">
            <div className="rounded-xl border-2 border-border bg-card overflow-hidden">
              {/* Filter Bar */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Available Offerings</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Type Filter Tabs */}
                  <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
                    <button
                      onClick={() => setTypeFilter('ALL')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                        typeFilter === 'ALL' 
                          ? 'bg-background shadow-sm text-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      All ({typeCounts.ALL})
                    </button>
                    <button
                      onClick={() => setTypeFilter('LECTURE')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                        typeFilter === 'LECTURE' 
                          ? 'bg-blue-500 text-white shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Lectures ({typeCounts.LECTURE})
                    </button>
                    <button
                      onClick={() => setTypeFilter('LAB')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                        typeFilter === 'LAB' 
                          ? 'bg-purple-500 text-white shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      Labs ({typeCounts.LAB})
                    </button>
                    {typeCounts.TUTORIAL > 0 && (
                      <button
                        onClick={() => setTypeFilter('TUTORIAL')}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                          typeFilter === 'TUTORIAL' 
                            ? 'bg-green-500 text-white shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <GraduationCap className="h-3.5 w-3.5" />
                        Tutorials ({typeCounts.TUTORIAL})
                      </button>
                    )}
                  </div>
                  
                  {/* Search */}
                  <Input
                    className="w-56 h-8 text-sm"
                    value={offeringSearch}
                    onChange={(e) => setOfferingSearch(e.target.value)}
                    placeholder="Search offerings..."
                    disabled={busy || viewMode === 'published'}
                  />
                </div>
              </div>

              {/* Offerings Grid */}
              <div className="p-3 max-h-48 overflow-y-auto">
                {visibleOfferings.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Grid3X3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No offerings found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {visibleOfferings.map((o) => (
                      <DraggableOffering
                        key={o.id}
                        offering={o}
                        active={activeOffering?.id === o.id}
                        disabled={busy || viewMode === 'published'}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timetable Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="bg-card border-2 border-border p-3 text-left font-semibold text-sm min-w-[140px] rounded-tl-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Period
                    </div>
                  </th>
                  {DAYS.map((day, idx) => (
                    <th 
                      key={day} 
                      className={cn(
                        "bg-card border-2 border-border p-3 text-center font-semibold text-sm min-w-[180px]",
                        idx === DAYS.length - 1 && "rounded-tr-lg"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-muted-foreground">{DAY_ABBR[idx]}</span>
                        <span>{day}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, periodIdx) => (
                  <tr key={period.id}>
                    <td className={cn(
                      "border-2 border-border p-3 bg-card/50",
                      periodIdx === periods.length - 1 && "rounded-bl-lg"
                    )}>
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{period.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatTime(period.start_time)} - {formatTime(period.end_time)}
                        </div>
                        {period.is_break && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                            Break
                          </Badge>
                        )}
                      </div>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const key = cellKey(dayIdx, period.id)
                      const events = eventsByCell[key] || []
                      const isLast = periodIdx === periods.length - 1 && dayIdx === DAYS.length - 1

                      return (
                        <td 
                          key={dayIdx} 
                          className={cn(
                            "border-2 border-border p-1.5 align-top bg-background/50",
                            isLast && "rounded-br-lg"
                          )}
                        >
                          <DroppableCell id={key}>
                            {period.is_break ? (
                              <div className="h-20 bg-amber-500/5 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-amber-600/60">Break</span>
                              </div>
                            ) : events.length === 0 ? (
                              <div className="h-20 border-2 border-dashed border-border/50 rounded-lg" />
                            ) : (
                              <div className="space-y-1.5">
                                {events.map((event) => (
                                  <ScheduledEvent
                                    key={event.id}
                                    event={event}
                                    componentType={event.component_type}
                                    onDelete={() => handleDeleteEvent(event.id)}
                                    disabled={viewMode === 'published'}
                                  />
                                ))}
                              </div>
                            )}
                          </DroppableCell>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOffering ? (
          <div className="opacity-90">
            <DraggableOffering offering={activeOffering} active compact />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
