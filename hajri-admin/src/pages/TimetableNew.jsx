import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useScopeStore, useStructureStore } from '@/lib/store'
import { AlertCircle, Eye, Save, Trash2, Edit2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function normalizeTimeString(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  return trimmed
}

function newSlotId() {
  return (
    globalThis?.crypto?.randomUUID?.() ||
    `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  )
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
  // Use a delimiter that won't appear in time strings.
  return `${dayIdx}|${normalizeTimeString(startTime)}`
}

function parseCellKey(key) {
  const [dayIdx, startTime] = key.split('|')
  return { dayIdx: Number.parseInt(dayIdx, 10), startTime: normalizeTimeString(startTime) }
}

function DraggableOffering({ offering, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `offering-${offering.id}`,
    data: { type: 'offering', offering },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        'w-full min-w-[180px] rounded-lg border-2 border-border bg-card px-3 py-2.5 text-left transition-all duration-150',
        'hover:border-primary hover:bg-secondary/70 hover:shadow-lg hover:scale-[1.03]',
        'cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary',
        'shadow-md',
        isDragging && 'opacity-30 scale-90'
      )}
      {...listeners}
      {...attributes}
      style={style}
    >
      <div className="font-mono text-xs font-bold text-muted-foreground">{offering.subjects?.code || '—'}</div>
      <div className="text-sm font-semibold text-foreground line-clamp-2 break-words">{offering.subjects?.name || '—'}</div>
      <div className="text-xs text-muted-foreground truncate">
        {offering.faculty?.name ? `👤 ${offering.faculty.name}` : '👤 TBA'}
      </div>
    </button>
  )
}

function DroppableCell({ cellId, event, isOver, children }) {
  const { setNodeRef } = useDroppable({
    id: cellId,
    data: { type: 'cell', cellId },
  })

  return (
    <div
      ref={setNodeRef}
      data-droppable="true"
      className={cn(
        'min-h-[110px] w-full transition-all duration-150 rounded-lg p-1',
        isOver && 'bg-primary/25 ring-4 ring-primary ring-inset shadow-2xl scale-[1.01]',
        !event && 'hover:bg-accent/10'
      )}
    >
      {children}
    </div>
  )
}

function TimetableBlock({ event, onEdit, onDelete, viewMode }) {
  const off = event.course_offerings
  const code = off?.subjects?.code
  const name = off?.subjects?.name
  const facultyName = off?.faculty?.name
  const roomNum = event.rooms?.room_number
  const subjectType = off?.subjects?.type || 'LECTURE'

  const typeColors = {
    LECTURE: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    LAB: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    TUTORIAL: 'bg-green-500/10 border-green-500/30 text-green-400',
  }

  const colorClass = typeColors[subjectType] || typeColors.LECTURE

  return (
    <div className={cn('group relative rounded-lg border-2 p-2 shadow-md hover:shadow-xl transition-all duration-150 h-full min-h-[100px] flex flex-col', colorClass)}>
      <div className="font-mono text-[11px] font-bold opacity-95">{code || '—'}</div>
      <div className="text-xs font-semibold leading-tight mt-1 line-clamp-2 break-words flex-1">{name || '—'}</div>
      <div className="text-[10px] opacity-80 mt-1 truncate">👤 {facultyName || 'TBA'}</div>
      <div className="text-[10px] opacity-80 truncate">📍 {roomNum || 'No room'}</div>

      {viewMode === 'draft' && (
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="rounded bg-background/90 p-1 hover:bg-secondary"
            title="Edit room/faculty"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(event.id)}
            className="rounded bg-background/90 p-1 hover:bg-destructive/20 text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function TimetableNew() {
  const queryClient = useQueryClient()
  const { selectedNode } = useStructureStore()
  const { batchId, departmentId } = useScopeStore()

  const [viewMode, setViewMode] = useState('draft')
  const [error, setError] = useState('')

  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)

  const [editDialog, setEditDialog] = useState(null)
  const [roomPickDialog, setRoomPickDialog] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  const roomsQuery = useQuery({
    queryKey: ['rooms', { departmentId }],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      let query = supabase.from('rooms').select('*')
      if (departmentId) {
        query = query.eq('department_id', departmentId)
      }
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

  const templateId = activeTemplateQuery.data?.id || null

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

  const templateReady = Boolean(activeTemplateQuery.data) && periods.length > 0
  const blockEditingReason = !activeTemplateQuery.data
    ? 'No period template exists. Create one in Period Templates first.'
    : periods.length === 0
      ? 'Active period template has no periods. Add periods in Period Templates first.'
      : null

  const placeEventMutation = useMutation({
    mutationFn: async ({ versionId, offeringId, dayIdx, startTime, endTime, roomId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      if (!versionId) throw new Error('No active timetable version')

      const normalizedStart = normalizeTimeString(startTime)
      const normalizedEnd = normalizeTimeString(endTime)

      // Ensure the slot is unique by (version_id, day_of_week, start_time)
      const delByTime = await supabase
        .from('timetable_events')
        .delete()
        .eq('version_id', versionId)
        .eq('day_of_week', dayIdx)
        .eq('start_time', normalizedStart)

      if (delByTime.error) throw delByTime.error

      const ins = await supabase.from('timetable_events').insert([
        {
          version_id: versionId,
          offering_id: offeringId,
          day_of_week: dayIdx,
          start_time: normalizedStart,
          end_time: normalizedEnd,
          room_id: roomId || null,
        },
      ])

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

  const busy =
    roomsQuery.isFetching ||
    activeTemplateQuery.isFetching ||
    offeringsQuery.isFetching ||
    eventsQuery.isFetching ||
    placeEventMutation.isLoading ||
    deleteEventMutation.isLoading ||
    updateEventRoomMutation.isLoading ||
    publishDraftMutation.isLoading

  const loading =
    roomsQuery.isLoading ||
    activeTemplateQuery.isLoading ||
    workspaceQuery.isLoading ||
    offeringsQuery.isLoading ||
    eventsQuery.isLoading

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || viewMode === 'published') return
    if (!batchId) return
    if (!templateReady) {
      setError(blockEditingReason || 'Period template required')
      return
    }
    if (!activeVersionId) return

    const offeringData = active.data.current?.offering
    if (!offeringData) return

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
      setError(`Conflict: slot already occupied by ${conflictingEvent.course_offerings?.subjects?.code || 'another offering'}`)
      return
    }

    setRoomPickDialog({
      offeringId: offeringData.id,
      dayIdx,
      startTime: period.start_time,
      endTime: period.end_time,
    })
  }

  async function saveWithRoom(roomId) {
    if (!roomPickDialog) return
    if (!activeVersionId) return
    const { offeringId, dayIdx, startTime, endTime } = roomPickDialog
    const normalizedStart = normalizeTimeString(startTime)

    const facultyConflict = events.find(
      (e) =>
        e.day_of_week === dayIdx &&
        normalizeTimeString(e.start_time) === normalizedStart &&
        e.course_offerings?.faculty_id === offerings.find((o) => o.id === offeringId)?.faculty_id
    )

    if (facultyConflict) {
      setError('Conflict: faculty is already assigned to another offering at this time')
      return
    }

    if (roomId) {
      const roomConflict = events.find(
        (e) => e.day_of_week === dayIdx && normalizeTimeString(e.start_time) === normalizedStart && e.room_id === roomId
      )
      if (roomConflict) {
        setError('Conflict: room is already occupied at this time')
        return
      }
    }

    setError('')
    placeEventMutation.mutate(
      {
        versionId: activeVersionId,
        offeringId,
        dayIdx,
        startTime,
        endTime,
        roomId: roomId || null,
      },
      {
        onSuccess: () => setRoomPickDialog(null),
      }
    )
  }

  async function handleDelete(eventId) {
    if (!confirm('Delete this block?')) return
    if (!activeVersionId) return
    setError('')
    deleteEventMutation.mutate({ versionId: activeVersionId, eventId })
  }

  async function handleEditSave(eventId, facultyId, roomId) {
    const normalizedStart = normalizeTimeString(editDialog?.event?.start_time)
    const roomConflict = events.find(
      (e) =>
        e.id !== eventId &&
        e.day_of_week === editDialog.event.day_of_week &&
        normalizeTimeString(e.start_time) === normalizedStart &&
        e.room_id === roomId
    )
    if (roomConflict) {
      setError('Room conflict: room is already occupied at this time')
      return
    }

    const facultyConflict = events.find(
      (e) =>
        e.id !== eventId &&
        e.day_of_week === editDialog.event.day_of_week &&
        normalizeTimeString(e.start_time) === normalizedStart &&
        e.course_offerings?.faculty_id === facultyId
    )
    if (facultyConflict) {
      setError('Faculty conflict: faculty is already assigned at this time')
      return
    }

    if (!activeVersionId) return

    setError('')
    updateEventRoomMutation.mutate(
      { versionId: activeVersionId, eventId, roomId: roomId || null },
      { onSuccess: () => setEditDialog(null) }
    )
  }

  async function publishDraft() {
    if (!batchId || !draftVersionId) return
    if (!confirm('Publish this draft timetable? Existing published version will be archived.')) return
    setError('')
    publishDraftMutation.mutate({ batchId, draftVersionId })
  }

  if (loading) {
    return <div className="py-12 text-sm text-muted-foreground">Loading timetable…</div>
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
      onDragStart={(e) => {
        setActiveId(e.active.id)
        setError('')
      }}
      onDragOver={(e) => setOverId(e.over?.id || null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setOverId(null)
      }}
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Timetable</h1>
            <p className="text-muted-foreground">
              {batchId ? 'Drag offerings to schedule' : 'Select a batch from the tree to begin'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'draft' ? 'default' : 'outline'}
              onClick={() => setViewMode('draft')}
              disabled={busy}
            >
              Draft
            </Button>
            <Button
              variant={viewMode === 'published' ? 'default' : 'outline'}
              onClick={() => setViewMode('published')}
              disabled={busy || !publishedVersionId}
              title={!publishedVersionId ? 'No published timetable yet' : ''}
            >
              <Eye className="mr-2 h-4 w-4" />
              Published
            </Button>
            <Button onClick={publishDraft} disabled={busy || viewMode !== 'draft' || !batchId || !templateReady}>
              <Save className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </div>
        </div>

        {!batchId && (
          <div className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/30 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Batch scope required</p>
              <p className="text-sm text-muted-foreground">
                Select a Batch node in the Tree Explorer to edit a timetable.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {batchId && blockEditingReason && (
          <div className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/30 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Period template required</p>
              <p className="text-sm text-muted-foreground">{blockEditingReason}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Available Offerings - Top */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-xl">Available Offerings</CardTitle>
              <CardDescription>Drag any offering to schedule it in the timetable below</CardDescription>
            </CardHeader>
            <CardContent>
              {!batchId ? (
                <div className="text-sm text-muted-foreground">Select a batch to load offerings.</div>
              ) : offerings.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No offerings for this batch. Create them in Assignments first.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto p-2">
                  {offerings.map((o) => (
                    <DraggableOffering key={o.id} offering={o} isDragging={activeId === `offering-${o.id}`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timetable Grid - Bottom */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Timetable Grid</CardTitle>
              <CardDescription>{viewMode === 'published' ? 'Published (read-only)' : 'Draft - Drag offerings into slots'}</CardDescription>
            </CardHeader>
            <CardContent>
                {!templateReady ? (
                  <div className="rounded-lg border-2 border-border bg-muted/20 p-6 text-sm text-foreground">
                    {blockEditingReason || 'Period template required to render the grid.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-border rounded-xl shadow-xl">
                    <table className="w-full border-collapse min-w-[1200px]">
                      <thead>
                        <tr>
                          <th className="border-r-2 border-b-2 border-border bg-muted/50 px-4 py-3 text-left text-xs font-semibold text-foreground w-32 sticky left-0 z-10 shadow-md">
                            Period
                          </th>
                          {DAYS.map((day) => (
                            <th
                              key={day}
                              className="border-r-2 border-b-2 border-border bg-muted/70 px-3 py-3 text-center text-sm font-bold min-w-[180px] w-[180px]"
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period) => (
                          <tr key={period.id}>
                            <td className="border-r-2 border-b-2 border-border bg-muted/40 px-4 py-3 align-top sticky left-0 z-10 shadow-md">
                              <div className="text-sm font-bold text-foreground whitespace-nowrap">
                                {typeof period.period_number === 'number' ? `P${period.period_number}` : 'Period'}
                              </div>
                              <div className="text-[11px] text-muted-foreground whitespace-nowrap font-mono mt-1">
                                {period.start_time.slice(0,5)}-{period.end_time.slice(0,5)}
                              </div>
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                                {period.is_break ? '☕ BREAK' : period.name}
                              </div>
                            </td>
                            {DAYS.map((_, dayIdx) => {
                              const key = cellKey(dayIdx, period.start_time)
                              const ev = eventsByCell[key]
                              const isOver = overId === key

                              return (
                                <td key={dayIdx} className="border-r-2 border-b-2 border-border p-2 align-top min-w-[180px] w-[180px] bg-background">
                                  {period.is_break ? (
                                    <div className="h-[110px] flex items-center justify-center rounded-lg bg-amber-100/50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 text-sm font-bold text-amber-800 dark:text-amber-300 shadow-sm">
                                      ☕ BREAK
                                    </div>
                                  ) : (
                                    <DroppableCell cellId={key} event={ev} isOver={isOver}>
                                      {ev ? (
                                        <TimetableBlock
                                          event={ev}
                                          viewMode={viewMode}
                                          onEdit={(e) => setEditDialog({ event: e })}
                                          onDelete={handleDelete}
                                        />
                                      ) : (
                                        <div className="h-[110px] flex items-center justify-center text-xs font-medium text-muted-foreground border-2 border-dashed border-border/40 rounded-lg hover:border-primary/50 hover:bg-accent/5 transition-all">
                                          {viewMode === 'draft' ? '➕ Drop Here' : '—'}
                                        </div>
                                      )}
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
                
                {viewMode === 'draft' && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    💡 Tip: Drag an offering from above into any time slot. A room picker will appear.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DragOverlay>
          {activeOffering ? (
            <div className="rounded-xl border-4 border-primary bg-card px-4 py-3 shadow-2xl opacity-90 rotate-3 scale-110 min-w-[180px]">
              <div className="font-mono text-sm font-bold text-primary">{activeOffering.subjects?.code || '—'}</div>
              <div className="text-base font-bold text-foreground mt-1 line-clamp-2">{activeOffering.subjects?.name || '—'}</div>
              <div className="text-xs text-muted-foreground mt-1">👤 {activeOffering.faculty?.name || 'TBA'}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Room Picker Dialog */}
      <Dialog open={Boolean(roomPickDialog)} onOpenChange={(open) => !open && setRoomPickDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Room</DialogTitle>
            <DialogDescription>Choose a room for this time slot (optional)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="room-select">Room</Label>
              <Select onValueChange={(val) => saveWithRoom(val === 'none' ? null : val)}>
                <SelectTrigger id="room-select">
                  <SelectValue placeholder="Select room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editDialog)} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update room assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-room-select">Room</Label>
              <Select
                defaultValue={editDialog?.event?.room_id || 'none'}
                onValueChange={(val) => {
                  const roomId = val === 'none' ? null : val
                  if (editDialog?.event) {
                    handleEditSave(editDialog.event.id, editDialog.event.course_offerings?.faculty_id, roomId)
                  }
                }}
              >
                <SelectTrigger id="edit-room-select">
                  <SelectValue placeholder="Select room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
