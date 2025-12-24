import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useScopeStore } from '@/lib/store'
import { AlertCircle, Eye, Save, Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const FALLBACK_SLOTS = [
  { label: '08:00 AM', start: '08:00', end: '09:00' },
  { label: '09:00 AM', start: '09:00', end: '10:00' },
  { label: '10:00 AM', start: '10:00', end: '11:00' },
  { label: '11:00 AM', start: '11:00', end: '12:00' },
  { label: '12:00 PM', start: '12:00', end: '13:00' },
  { label: '01:00 PM', start: '13:00', end: '14:00' },
  { label: '02:00 PM', start: '14:00', end: '15:00' },
  { label: '03:00 PM', start: '15:00', end: '16:00' },
  { label: '04:00 PM', start: '16:00', end: '17:00' },
]

function cellKey(dayIdx, startTime) {
  return `${dayIdx}-${startTime}`
}

export default function Timetable() {
  const { batchId } = useScopeStore()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [timeSlots, setTimeSlots] = useState(FALLBACK_SLOTS)

  const batchId = scopeBatchId

  const [viewMode, setViewMode] = useState('draft') // draft | published
  const [draftVersionId, setDraftVersionId] = useState(null)
  const [publishedVersionId, setPublishedVersionId] = useState(null)

  const [offerings, setOfferings] = useState([])
  const [offeringSearch, setOfferingSearch] = useState('')
  const [activeOfferingId, setActiveOfferingId] = useState('')

  const [eventsByCell, setEventsByCell] = useState({})
  const selectionRef = useRef({ active: false, start: null, end: null })
  const [selection, setSelection] = useState(null) // {start:{row,col}, end:{row,col}}

  const activeVersionId = viewMode === 'published' ? publishedVersionId : draftVersionId

  useEffect(() => {
    loadBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!batchId) {
      setOfferings([])
      setEventsByCell({})
      setDraftVersionId(null)
      setPublishedVersionId(null)
      setActiveOfferingId('')
      setSelection(null)
      return
    }

    loadBatchWorkspace(batchId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId])

  useEffect(() => {
    if (!batchId) return
    loadEventsForActiveVersion(batchId, viewMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, draftVersionId, publishedVersionId])

  async function loadBootstrap() {
    try {
      setLoading(true)
      setError('')

      const templateRes = await supabase
        .from('period_templates')
        .select('slots')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (templateRes.error) throw templateRes.error

      const slots = templateRes.data?.slots
      if (Array.isArray(slots) && slots.length > 0) setTimeSlots(slots)
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

  async function loadBatchWorkspace(targetBatchId) {
    try {
      setBusy(true)
      setError('')

      const [draftId, pubId] = await Promise.all([
        getOrCreateDraftVersion(targetBatchId),
        getPublishedVersion(targetBatchId),
      ])

      setDraftVersionId(draftId)
      setPublishedVersionId(pubId)

      const offeringsRes = await supabase
        .from('course_offerings')
        .select(
          `
          *,
          subjects(code, name, type),
          faculty(name),
          rooms:default_room_id(room_number)
        `
        )
        .eq('batch_id', targetBatchId)
        .order('created_at', { ascending: false })

      if (offeringsRes.error) throw offeringsRes.error
      setOfferings(offeringsRes.data || [])

      await loadEventsForActiveVersion(targetBatchId, viewMode, { draftId, pubId })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function loadEventsForActiveVersion(targetBatchId, mode, ids) {
    try {
      setError('')

      const effectiveDraft = ids?.draftId ?? draftVersionId
      const effectivePub = ids?.pubId ?? publishedVersionId
      const versionId = mode === 'published' ? effectivePub : effectiveDraft

      if (!versionId) {
        setEventsByCell({})
        setSelection(null)
        return
      }

      const res = await supabase
        .from('timetable_events')
        .select(
          `
          *,
          rooms:room_id(room_number),
          course_offerings(
            id,
            subjects(code, name, type),
            faculty(name),
            rooms:default_room_id(room_number)
          )
        `
        )
        .eq('version_id', versionId)

      if (res.error) throw res.error

      const map = {}
      for (const ev of res.data || []) {
        map[cellKey(ev.day_of_week, ev.start_time)] = ev
      }
      setEventsByCell(map)
      setSelection(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const visibleOfferings = useMemo(() => {
    const q = offeringSearch.trim().toLowerCase()
    if (!q) return offerings
    return offerings.filter((o) => {
      const text = `${o.subjects?.code || ''} ${o.subjects?.name || ''} ${o.faculty?.name || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [offerings, offeringSearch])

  const selectedCells = useMemo(() => {
    if (!selection) return []
    const { start, end } = selection
    const keys = []
    for (let row = start.row; row <= end.row; row++) {
      const slot = timeSlots[row]
      if (!slot?.start) continue
      for (let col = start.col; col <= end.col; col++) {
        keys.push(cellKey(col, slot.start))
      }
    }
    return keys
  }, [selection, timeSlots])

  function beginSelection(row, col) {
    if (viewMode === 'published') return
    const start = { row, col }
    selectionRef.current = { active: true, start, end: start }
    setSelection({ start, end: start })
  }

  function updateSelection(row, col) {
    if (!selectionRef.current.active) return
    const start = selectionRef.current.start
    const end = { row, col }
    selectionRef.current.end = end
    setSelection(clampSelection(start, end))
  }

  function endSelection() {
    selectionRef.current.active = false
  }

  async function applyOfferingToSelection() {
    if (!activeOfferingId || !activeVersionId || selectedCells.length === 0) return

    try {
      setBusy(true)
      setError('')

      const selectedOffering = offerings.find((o) => o.id === activeOfferingId)
      const defaultRoomId = selectedOffering?.default_room_id || null

      const rows = selectedCells
        .map((k) => {
          const [dayStr, start] = k.split('|')
          const day = Number.parseInt(dayStr, 10)
          const slot = timeSlots.find((s) => s.start === start)
          if (!slot?.start || !slot?.end) return null
          return {
            version_id: activeVersionId,
            offering_id: activeOfferingId,
            day_of_week: day,
            start_time: slot.start,
            end_time: slot.end,
            room_id: defaultRoomId,
          }
        })
        .filter(Boolean)

      if (rows.length === 0) return

      const res = await supabase
        .from('timetable_events')
        .upsert(rows, { onConflict: 'version_id,day_of_week,start_time' })

      if (res.error) throw res.error
      await loadEventsForActiveVersion(batchId, viewMode)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function clearSelection() {
    if (!activeVersionId || selectedCells.length === 0) return

    const ids = selectedCells.map((k) => eventsByCell[k]?.id).filter(Boolean)
    if (ids.length === 0) return

    try {
      setBusy(true)
      setError('')

      const res = await supabase.from('timetable_events').delete().in('id', ids)
      if (res.error) throw res.error
      await loadEventsForActiveVersion(batchId, viewMode)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function publishDraft() {
    if (!batchId || !draftVersionId) return
    if (!confirm('Publish this draft timetable? Existing published version will be archived.')) return

    try {
      setBusy(true)
      setError('')

      const archiveRes = await supabase
        .from('timetable_versions')
        .update({ status: 'archived' })
        .eq('batch_id', batchId)
        .eq('status', 'published')

      if (archiveRes.error) throw archiveRes.error

      const publishRes = await supabase
        .from('timetable_versions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftVersionId)

      if (publishRes.error) throw publishRes.error

      const newDraftRes = await supabase
        .from('timetable_versions')
        .insert([{ batch_id: batchId, status: 'draft', name: 'Draft' }])
        .select('id')
        .single()

      if (newDraftRes.error) throw newDraftRes.error

      setPublishedVersionId(draftVersionId)
      setDraftVersionId(newDraftRes.data.id)
      setViewMode('published')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-sm text-muted-foreground">Loading timetable…</div>
    )
  }

  const activeOfferingCode = activeOfferingId
    ? offerings.find((o) => o.id === activeOfferingId)?.subjects?.code || 'Selected'
    : null

  return (
    <div className="space-y-6" onMouseLeave={endSelection}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Timetable</h1>
            <p className="text-muted-foreground">
              Pick an offering and paint it into the grid. Drag-select to apply multiple slots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'draft' ? 'default' : 'outline'}
              onClick={() => setViewMode('draft')}
              disabled={busy}
            >
              <MousePointer2 className="mr-2 h-4 w-4" />
              Draft
            </Button>
            <Button
              variant={viewMode === 'published' ? 'default' : 'outline'}
              onClick={() => setViewMode('published')}
              disabled={busy || !publishedVersionId}
              title={!publishedVersionId ? 'No published timetable for this batch yet' : ''}
            >
              <Eye className="mr-2 h-4 w-4" />
              Published
            </Button>
            <Button onClick={publishDraft} disabled={busy || viewMode !== 'draft' || !batchId}>
              <Save className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </div>
        </div>

        {!batchId && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Batch scope required</p>
              <p className="text-sm text-muted-foreground">Select a Batch node in the Tree Explorer to edit a timetable.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Scope is controlled by the Tree Explorer (read-only here)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Batch</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {batchId ? 'Selected (from tree)' : '—'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Active offering</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {activeOfferingCode ?? 'None (select from left)'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Offerings</CardTitle>
              <CardDescription>Click one to paint into the grid</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={offeringSearch}
                onChange={(e) => setOfferingSearch(e.target.value)}
                placeholder="Search course/faculty…"
                disabled={!batchId}
              />

              {!batchId ? (
                <div className="text-sm text-muted-foreground">Select a batch to load offerings.</div>
              ) : visibleOfferings.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No offerings for this batch. Create them in Offerings first.
                </div>
              ) : (
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {visibleOfferings.map((o) => {
                    const active = o.id === activeOfferingId
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setActiveOfferingId(o.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition-colors',
                          active ? 'border-border bg-secondary text-foreground' : 'bg-card hover:bg-secondary/50'
                        )}
                      >
                        <div className="font-mono text-xs text-muted-foreground">{o.subjects?.code || '—'}</div>
                        <div className="text-sm font-medium">{o.subjects?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.faculty?.name ? `Faculty: ${o.faculty.name}` : 'Faculty: TBA'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={applyOfferingToSelection}
                  disabled={busy || viewMode === 'published' || !activeOfferingId || selectedCells.length === 0}
                  className="flex-1"
                >
                  <Clipboard className="mr-2 h-4 w-4" />
                  Apply
                </Button>
                <Button
                  variant="outline"
                  onClick={clearSelection}
                  disabled={busy || viewMode === 'published' || selectedCells.length === 0}
                  className="flex-1"
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Week Grid</CardTitle>
              <CardDescription>
                {viewMode === 'published' ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Published (read-only)
                  </span>
                ) : (
                  'Draft (editable)'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <div className="min-w-[860px]">
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `180px repeat(${DAYS.length}, minmax(0, 1fr))` }}
                  >
                    <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Time</div>
                    {DAYS.map((d) => (
                      <div
                        key={d}
                        className="border-b border-l bg-muted/40 px-3 py-2 text-center text-sm font-medium"
                      >
                        {d}
                      </div>
                    ))}

                    {timeSlots.map((slot, rowIdx) => (
                      <div key={slot.start} className="contents">
                        <div className="border-b px-3 py-3 text-sm text-muted-foreground">
                          <div className="font-medium text-foreground">{slot.label}</div>
                          <div className="text-xs">
                            {slot.start}–{slot.end}
                          </div>
                        </div>

                        {DAYS.map((_, colIdx) => {
                          const key = cellKey(colIdx, slot.start)
                          const ev = eventsByCell[key]
                          const sel = selectedCells.includes(key)
                          const off = ev?.course_offerings
                          const code = off?.subjects?.code
                          const name = off?.subjects?.name
                          const facultyName = off?.faculty?.name

                          return (
                            <div
                              key={key}
                              className={cn(
                                'select-none border-b border-l p-2',
                                viewMode === 'published'
                                  ? 'bg-background'
                                  : 'cursor-pointer hover:bg-secondary/40',
                                sel ? 'bg-secondary' : ''
                              )}
                              onMouseDown={() => beginSelection(rowIdx, colIdx)}
                              onMouseEnter={() => updateSelection(rowIdx, colIdx)}
                              onMouseUp={endSelection}
                            >
                              {ev ? (
                                <div className="rounded-md border bg-card px-2 py-1">
                                  <div className="font-mono text-xs text-muted-foreground">{code || '—'}</div>
                                  <div className="truncate text-sm font-medium">{name || '—'}</div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {facultyName ? `Faculty: ${facultyName}` : 'Faculty: TBA'}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-[54px]" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {viewMode !== 'published' ? (
                <div className="mt-3 text-xs text-muted-foreground">Tip: drag-select cells, then click Apply.</div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
