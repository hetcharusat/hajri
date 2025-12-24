import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Clock, Eye, MapPin, Trash2, User, X } from 'lucide-react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function cellKey(dayIdx, periodId) {
  return `${dayIdx}|${periodId}`
}

function DraggableOffering({ offering, active, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `offering:${offering.id}`,
    disabled,
    data: { offering },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000 }
    : undefined

  const teachers = offering.faculty_names?.join(', ') || offering.faculty?.name || '—'
  const componentType = offering.component_type || 'LECTURE'
  const batchLabel = offering.batch_letter || ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={
        "w-full rounded-lg px-4 py-3 border-2 transition-all cursor-grab active:cursor-grabbing " +
        (active ? 'border-primary bg-primary/20 shadow-md scale-105' : 'border-border bg-background hover:border-primary/50 hover:shadow-sm') +
        (isDragging ? ' opacity-30 scale-95' : '')
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="font-mono text-sm font-bold text-foreground">{offering.subject_code || '—'}</div>
        <span className={`text-xs px-2 py-1 rounded-md font-bold uppercase ${
          componentType === 'LAB' ? 'bg-purple-500 text-white' :
          componentType === 'TUTORIAL' ? 'bg-green-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {componentType}
        </span>
        {batchLabel && (
          <span className="text-xs px-2 py-1 rounded-md bg-pink-500 text-white font-bold">
            Batch {batchLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-foreground mb-1 line-clamp-2">{offering.subject_name || '—'}</div>
      <div className="text-xs text-muted-foreground truncate">👨‍🏫 {teachers}</div>
    </div>
  )
}

function DroppableCell({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`h-full transition-all ${isOver ? 'bg-primary/20 ring-4 ring-primary ring-inset rounded-md' : ''}`}>
      {children}
    </div>
  )
}

export function TimetablePanel({ batchId, refreshKey }) {
  const [loading, setLoading] = useState(true)
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
  const [activeOffering, setActiveOffering] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeVersionId = viewMode === 'published' ? publishedVersionId : draftVersionId

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

      const templateRes = await supabase
        .from('period_templates')
        .select('id')
        .eq('is_active', true)
        .single()

      if (!templateRes.error && templateRes.data) {
        const periodsRes = await supabase
          .from('periods')
          .select('*')
          .eq('template_id', templateRes.data.id)
          .order('period_number')

        if (!periodsRes.error) {
          setPeriods(periodsRes.data || [])
        }
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
          faculty(name, email),
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
          component_type: o.subjects?.type === 'LAB' ? 'LAB' : 'LECTURE',
          faculty_names: o.faculty ? [o.faculty.name] : [],
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
            subjects(code, name),
            faculty(name),
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
          faculty: ev.course_offerings?.faculty?.name,
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
        .eq('start_time', period.start_time)

      // Insert new event
      const { data: event, error: eventErr } = await supabase
        .from('timetable_events')
        .insert({
          version_id: activeVersionId,
          offering_id: offering.id,
          period_id: periodId,
          day_of_week: dayOfWeek,
          start_time: period.start_time,
          end_time: period.end_time,
        })
        .select()
        .single()

      if (eventErr) throw eventErr

      await loadEvents()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteEvent(eventId) {
    if (!confirm('Delete this class from the timetable?')) return

    try {
      setBusy(true)
      setError('')

      const { error: err } = await supabase
        .from('timetable_events')
        .delete()
        .eq('id', eventId)

      if (err) throw err

      await loadEvents()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!batchId || !draftVersionId) return
    if (!confirm('Publish this draft timetable? Existing published version will be archived.')) return

    try {
      setBusy(true)
      setError('')

      await supabase
        .from('timetable_versions')
        .update({ status: 'archived' })
        .eq('batch_id', batchId)
        .eq('status', 'published')

      await supabase
        .from('timetable_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftVersionId)

      const { data: newDraft } = await supabase
        .from('timetable_versions')
        .insert([{ batch_id: batchId, status: 'draft', name: 'Draft' }])
        .select('id')
        .single()

      setPublishedVersionId(draftVersionId)
      setDraftVersionId(newDraft.id)
      setViewMode('published')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const visibleOfferings = useMemo(() => {
    const q = offeringSearch.trim().toLowerCase()
    if (!q) return offerings
    return offerings.filter((o) => {
      const text = `${o.subject_code || ''} ${o.subject_name || ''} ${o.faculty_names?.join(' ') || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [offerings, offeringSearch])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading timetable...</p>
        </div>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center space-y-3">
          <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium">No period template configured</p>
          <p className="text-xs text-muted-foreground">Go to Periods tab to create your schedule</p>
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
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b-2 bg-gradient-to-r from-primary/5 to-background space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Class Timetable</h3>
              <p className="text-xs text-muted-foreground">
                {allBatches.length} batches • Drag offerings to schedule
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                <Button size="sm" variant="secondary" onClick={handlePublish} disabled={busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-xs text-destructive flex-1">{error}</p>
              <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-foreground">📚 Available Offerings - Drag to Schedule</div>
              <input
                className="flex h-9 w-64 rounded-md border-2 border-input bg-background px-3 text-sm focus:border-primary"
                value={offeringSearch}
                onChange={(e) => setOfferingSearch(e.target.value)}
                placeholder="🔍 Search by code, name, or teacher..."
                disabled={busy || viewMode === 'published'}
              />
            </div>
            <div className="rounded-lg border-2 border-border bg-muted/30 p-3">
              {visibleOfferings.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No offerings found</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {visibleOfferings.map((o) => (
                    <div key={o.id} className="flex-shrink-0 w-72">
                      <DraggableOffering
                        offering={o}
                        active={activeOffering?.id === o.id}
                        disabled={busy || viewMode === 'published'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-2 border-border bg-muted p-3 text-left font-semibold text-sm sticky left-0 z-10 min-w-[120px]">
                    Period
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="border-2 border-border bg-muted p-3 text-center font-semibold text-sm min-w-[200px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td className="border-2 border-border p-2 bg-muted/30 sticky left-0 z-10">
                      <div className="text-sm font-semibold">{period.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {period.start_time} - {period.end_time}
                      </div>
                      {period.is_break && (
                        <div className="text-xs text-amber-600 font-semibold mt-1">BREAK</div>
                      )}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const key = cellKey(dayIdx, period.id)
                      const events = eventsByCell[key] || []

                      return (
                        <td key={dayIdx} className="border-2 border-border p-1 align-top">
                          <DroppableCell id={key}>
                            {period.is_break ? (
                              <div className="h-16 bg-amber-50/50 rounded flex items-center justify-center text-xs text-muted-foreground">
                                Break
                              </div>
                            ) : events.length === 0 ? (
                              <div className="h-24" />
                            ) : (
                              <div className="space-y-1">
                                {events.map((event) => (
                                  <Card key={event.id} className="p-2 bg-primary/5 border-primary/20 relative group">
                                    <button
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDeleteEvent(event.id)}
                                      disabled={viewMode === 'published'}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </button>
                                    <div className="text-xs font-semibold text-primary">
                                      {event.subject_code || '—'}
                                      {event.batch_letters?.length > 0 && (
                                        <span className="ml-1 text-pink-600">
                                          [{event.batch_letters.join(', ')}]
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">{event.subject_name}</div>
                                    {event.faculty && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <User className="h-3 w-3" />
                                        <span className="truncate">{event.faculty}</span>
                                      </div>
                                    )}
                                    {event.room_numbers?.length > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span>{event.room_numbers.join(', ')}</span>
                                      </div>
                                    )}
                                  </Card>
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

      <DragOverlay>
        {activeOffering ? (
          <div className="bg-background border-2 border-primary rounded-md p-3 shadow-xl max-w-xs">
            <div className="font-mono text-xs font-semibold">{activeOffering.subject_code}</div>
            <div className="text-sm font-medium">{activeOffering.subject_name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
