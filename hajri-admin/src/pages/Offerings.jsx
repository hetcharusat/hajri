import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'

export default function Offerings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [departments, setDepartments] = useState([])
  const [batches, setBatches] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [faculty, setFaculty] = useState([])
  const [rooms, setRooms] = useState([])
  const [offerings, setOfferings] = useState([])

  const [supportsSemesterFaculty, setSupportsSemesterFaculty] = useState(null) // null | boolean
  const [supportsDefaultRoom, setSupportsDefaultRoom] = useState(null) // null | boolean

  const [editor, setEditor] = useState({
    batchId: '',
    semesterId: '',
    semesterSubjects: [],
    semesterFaculty: [],
    assignmentBySubject: {},
    draftBySubject: {},
    savingSubjectId: '',
  })

  const [filters, setFilters] = useState({
    departmentCode: '',
    batchId: '',
    search: '',
  })

  const [formData, setFormData] = useState({
    departmentCode: '',
    batch_id: '',
    subject_id: '',
    faculty_id: '',
    default_room_id: '',
    notes: '',
  })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    // Keep editor batch in sync with filter batch selection
    if (filters.batchId && filters.batchId !== editor.batchId) {
      void loadBatchEditor(filters.batchId)
    }
    if (!filters.batchId && editor.batchId) {
      setEditor((prev) => ({
        ...prev,
        batchId: '',
        semesterId: '',
        semesterSubjects: [],
        semesterFaculty: [],
        assignmentBySubject: {},
        draftBySubject: {},
        savingSubjectId: '',
      }))
    }
  }, [filters.batchId])

  async function loadAll() {
    try {
      setLoading(true)
      setError('')

      // Detect optional features
      if (supportsSemesterFaculty === null) {
        const semProbe = await supabase.from('semester_faculty').select('semester_id, faculty_id').limit(1)
        setSupportsSemesterFaculty(!semProbe.error)
      }
      if (supportsDefaultRoom === null) {
        const roomProbe = await supabase.from('course_offerings').select('id, default_room_id').limit(1)
        setSupportsDefaultRoom(!roomProbe.error)
      }

      // Load faculty safely without joins.
      const facultyRes = await supabase.from('faculty').select('*').order('name', { ascending: true })
      if (facultyRes.error) throw facultyRes.error

      const [deptsRes, batchesRes, subjectsRes, roomsRes, offeringsRes] = await Promise.all([
        supabase.from('departments').select('*').order('code', { ascending: true }),
        supabase.from('batches').select('*, departments(code, name)').order('name', { ascending: true }),
        supabase.from('classes').select('id, semester_id'),
        supabase.from('subjects').select('*, departments:department_id(code, name)').order('code', { ascending: true }),
        supabase.from('rooms').select('id, room_number, type').order('room_number', { ascending: true }),
        supabase
          .from('course_offerings')
          .select(`
            *,
            subjects(code, name, type),
            faculty(name, email),
            rooms:default_room_id(room_number, type),
            batches(name, departments(code, name))
          `)
          .order('created_at', { ascending: false }),
      ])

      if (deptsRes.error) throw deptsRes.error
      if (batchesRes.error) throw batchesRes.error
      if (classesRes.error) throw classesRes.error
      if (subjectsRes.error) throw subjectsRes.error
      if (roomsRes.error) throw roomsRes.error
      if (offeringsRes.error) throw offeringsRes.error

      setDepartments(deptsRes.data || [])
      setBatches(batchesRes.data || [])
      setClasses(classesRes.data || [])
      setSubjects(subjectsRes.data || [])
      setFaculty(facultyRes.data || [])
      setRooms(roomsRes.data || [])
      setOfferings(offeringsRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const getSemesterIdForBatch = (batchId) => {
    if (!batchId) return ''
    const b = batches.find((x) => x.id === batchId)
    const classId = b?.class_id
    if (!classId) return ''
    const c = classes.find((x) => x.id === classId)
    return c?.semester_id || ''
  }

  const loadBatchEditor = async (batchId) => {
    try {
      const semesterId = getSemesterIdForBatch(batchId)

      const semSubjectsRes = semesterId
        ? await supabase
            .from('subjects')
            .select('id, code, name')
            .eq('semester_id', semesterId)
            .order('code')
        : { data: [] }

      let semFaculty = faculty
      if (supportsSemesterFaculty) {
        const sf = await supabase
          .from('semester_faculty')
          .select('faculty:faculty_id(id, name, email, abbr, abbreviation)')
          .eq('semester_id', semesterId)
        semFaculty = (sf.data || []).map((r) => r.faculty).filter(Boolean)
      }

      let includeDefaultRoom = supportsDefaultRoom
      if (includeDefaultRoom === null) {
        const probe = await supabase.from('course_offerings').select('id, default_room_id').limit(1)
        includeDefaultRoom = !probe.error
        setSupportsDefaultRoom(includeDefaultRoom)
      }

      const selectCols = includeDefaultRoom
        ? 'id, subject_id, faculty_id, default_room_id'
        : 'id, subject_id, faculty_id'

      const offRes = await supabase
        .from('course_offerings')
        .select(selectCols)
        .eq('batch_id', batchId)

      const existing = offRes.data || []
      const bySubject = {}
      const draft = {}
      for (const s of (semSubjectsRes.data || [])) {
        const row = existing.find((o) => o.subject_id === s.id)
        bySubject[s.id] = {
          id: row?.id || '',
          facultyId: row?.faculty_id || '',
          roomId: includeDefaultRoom ? (row?.default_room_id || '') : '',
        }
        draft[s.id] = {
          facultyId: row?.faculty_id || '',
          roomId: includeDefaultRoom ? (row?.default_room_id || '') : '',
        }
      }

      setEditor((prev) => ({
        ...prev,
        batchId,
        semesterId,
        semesterSubjects: semSubjectsRes.data || [],
        semesterFaculty: semFaculty || [],
        assignmentBySubject: bySubject,
        draftBySubject: draft,
        savingSubjectId: '',
      }))
    } catch (e) {
      setError(e.message)
    }
  }

  const upsertOfferingForBatchSubject = async ({ batchId, subjectId, facultyId, roomId }) => {
    let includeDefaultRoom = supportsDefaultRoom
    if (includeDefaultRoom === null) {
      const probe = await supabase.from('course_offerings').select('id, default_room_id').limit(1)
      includeDefaultRoom = !probe.error
      setSupportsDefaultRoom(includeDefaultRoom)
    }

    const payload = {
      batch_id: batchId,
      subject_id: subjectId,
      faculty_id: facultyId || null,
    }
    if (includeDefaultRoom) payload.default_room_id = roomId || null

    const up = await supabase
      .from('course_offerings')
      .upsert([payload], { onConflict: 'batch_id,subject_id' })
    if (!up.error) return

    // fallback: update if exists else insert
    const existing = await supabase
      .from('course_offerings')
      .select('id')
      .eq('batch_id', batchId)
      .eq('subject_id', subjectId)
      .maybeSingle()
    if (existing.error) throw existing.error

    if (existing.data?.id) {
      const upd = await supabase
        .from('course_offerings')
        .update(includeDefaultRoom ? { faculty_id: payload.faculty_id, default_room_id: payload.default_room_id } : { faculty_id: payload.faculty_id })
        .eq('id', existing.data.id)
      if (upd.error) throw upd.error
    } else {
      const ins = await supabase.from('course_offerings').insert([payload])
      if (ins.error) throw ins.error
    }
  }

  const filteredBatches = useMemo(() => {
    if (!formData.departmentCode) return batches
    return batches.filter((b) => b.departments?.code === formData.departmentCode)
  }, [batches, formData.departmentCode])

  const filteredSubjects = useMemo(() => {
    if (!formData.departmentCode) return subjects
    return subjects.filter((s) => s.departments?.code === formData.departmentCode)
  }, [subjects, formData.departmentCode])

  const formSemesterId = useMemo(() => {
    return getSemesterIdForBatch(formData.batch_id)
  }, [formData.batch_id, batches, classes])

  const facultyForCreateForm = useMemo(() => {
    if (!formSemesterId) return []
    if (!supportsSemesterFaculty) return faculty
    // If editor already loaded this semester, reuse its faculty list
    if (editor.semesterId === formSemesterId && editor.semesterFaculty.length) return editor.semesterFaculty
    return []
  }, [formSemesterId, supportsSemesterFaculty, faculty, editor.semesterId, editor.semesterFaculty])

  const visibleOfferings = useMemo(() => {
    let list = offerings

    if (filters.departmentCode) {
      list = list.filter((o) => o.batches?.departments?.code === filters.departmentCode)
    }
    if (filters.batchId) {
      list = list.filter((o) => o.batch_id === filters.batchId)
    }

    const q = filters.search.trim().toLowerCase()
    if (q) {
      list = list.filter((o) => {
        const course = `${o.subjects?.code || ''} ${o.subjects?.name || ''}`.toLowerCase()
        const fac = `${o.faculty?.name || ''} ${o.faculty?.email || ''}`.toLowerCase()
        const batch = `${o.batches?.name || ''}`.toLowerCase()
        return course.includes(q) || fac.includes(q) || batch.includes(q)
      })
    }

    return list
  }, [offerings, filters])

  async function handleCreate(e) {
    e.preventDefault()

    if (!formData.batch_id || !formData.subject_id) return

    try {
      setSaving(true)
      setError('')

      const payload = {
        batch_id: formData.batch_id,
        subject_id: formData.subject_id,
        faculty_id: formData.faculty_id || null,
        default_room_id: formData.default_room_id || null,
        notes: formData.notes?.trim() || null,
      }

      const { error } = await supabase.from('course_offerings').insert([payload])
      if (error) throw error

      setFormData({
        departmentCode: formData.departmentCode,
        batch_id: '',
        subject_id: '',
        faculty_id: '',
        default_room_id: '',
        notes: '',
      })

      await loadAll()
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this offering? This may break timetable entries referencing it.')) return

    try {
      setError('')
      const { error } = await supabase.from('course_offerings').delete().eq('id', id)
      if (error) throw error
      await loadAll()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Offerings</h1>
          <p className="text-muted-foreground">
            Map a course (subject) to a batch and faculty. Timetable cells will reference offerings.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Create Offering</CardTitle>
              <CardDescription>Subject + batch (+ faculty, default room)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.departmentCode}
                    onChange={(e) => {
                      const dept = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        departmentCode: dept,
                        batch_id: '',
                        subject_id: '',
                      }))
                    }}
                  >
                    <option value="">All</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Batch *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.batch_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, batch_id: e.target.value }))}
                    required
                  >
                    <option value="">Select batch</option>
                    {filteredBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.departments?.code ? `${b.departments.code} · ` : ''}
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Course (Subject) *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.subject_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_id: e.target.value }))}
                    required
                  >
                    <option value="">Select course</option>
                    {filteredSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Faculty</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.faculty_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, faculty_id: e.target.value }))}
                    disabled={!formData.batch_id}
                  >
                    <option value="">{formData.batch_id ? '(none)' : 'Select batch first'}</option>
                    {facultyForCreateForm.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.abbr || f.abbreviation ? ` · ${f.abbr || f.abbreviation}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Default Room</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.default_room_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, default_room_id: e.target.value }))}
                  >
                    <option value="">(none)</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional"
                    maxLength={200}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving || loading}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Offering
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Offerings</CardTitle>
              <CardDescription>
                {loading ? 'Loading…' : `${visibleOfferings.length} offering${visibleOfferings.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Batch-level overrides editor */}
              <div className="mb-6 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-sm font-semibold">Batch assignments (override)</div>
                    <div className="text-xs text-muted-foreground">
                      Set faculty/default room per subject for the selected batch.
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Batch</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={filters.batchId}
                      onChange={(e) => setFilters((prev) => ({ ...prev, batchId: e.target.value }))}
                    >
                      <option value="">Select batch</option>
                      {batches
                        .filter((b) => (filters.departmentCode ? b.departments?.code === filters.departmentCode : true))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.departments?.code ? `${b.departments.code} · ` : ''}
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {!filters.batchId ? (
                  <div className="mt-4 text-sm text-muted-foreground">Select a batch to edit its assignments.</div>
                ) : editor.semesterSubjects.length === 0 ? (
                  <div className="mt-4 text-sm text-muted-foreground">No subjects found for this batch's semester.</div>
                ) : supportsSemesterFaculty === false ? (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Semester faculty is not enabled (missing <span className="font-mono">semester_faculty</span>).
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {editor.semesterSubjects.map((s) => (
                      <div key={s.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-muted-foreground">{s.code}</div>
                            <div className="text-sm font-medium truncate">{s.name}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Faculty</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={editor.draftBySubject?.[s.id]?.facultyId || ''}
                              onChange={(e) =>
                                setEditor((prev) => ({
                                  ...prev,
                                  draftBySubject: {
                                    ...prev.draftBySubject,
                                    [s.id]: { ...(prev.draftBySubject?.[s.id] || {}), facultyId: e.target.value },
                                  },
                                }))
                              }
                            >
                              <option value="">(none)</option>
                              {editor.semesterFaculty.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}{f.abbr || f.abbreviation ? ` · ${f.abbr || f.abbreviation}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {supportsDefaultRoom !== false && (
                            <div className="space-y-2">
                              <Label className="text-xs">Default room</Label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={editor.draftBySubject?.[s.id]?.roomId || ''}
                                onChange={(e) =>
                                  setEditor((prev) => ({
                                    ...prev,
                                    draftBySubject: {
                                      ...prev.draftBySubject,
                                      [s.id]: { ...(prev.draftBySubject?.[s.id] || {}), roomId: e.target.value },
                                    },
                                  }))
                                }
                              >
                                <option value="">(none)</option>
                                {rooms.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.room_number}{r.type ? ` · ${r.type}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                setEditor((prev) => ({ ...prev, savingSubjectId: s.id }))
                                const d = editor.draftBySubject?.[s.id] || { facultyId: '', roomId: '' }
                                await upsertOfferingForBatchSubject({
                                  batchId: editor.batchId,
                                  subjectId: s.id,
                                  facultyId: d.facultyId,
                                  roomId: d.roomId,
                                })
                                await loadAll()
                                await loadBatchEditor(editor.batchId)
                              } catch (e) {
                                setError(e.message)
                              } finally {
                                setEditor((prev) => ({ ...prev, savingSubjectId: '' }))
                              }
                            }}
                            disabled={editor.savingSubjectId === s.id}
                          >
                            {editor.savingSubjectId === s.id ? 'Saving…' : 'Apply'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                setEditor((prev) => ({ ...prev, savingSubjectId: s.id }))
                                await upsertOfferingForBatchSubject({
                                  batchId: editor.batchId,
                                  subjectId: s.id,
                                  facultyId: '',
                                  roomId: '',
                                })
                                setEditor((prev) => ({
                                  ...prev,
                                  draftBySubject: {
                                    ...prev.draftBySubject,
                                    [s.id]: { facultyId: '', roomId: '' },
                                  },
                                }))
                                await loadAll()
                                await loadBatchEditor(editor.batchId)
                              } catch (e) {
                                setError(e.message)
                              } finally {
                                setEditor((prev) => ({ ...prev, savingSubjectId: '' }))
                              }
                            }}
                            disabled={editor.savingSubjectId === s.id}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Filter department</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.departmentCode}
                    onChange={(e) => setFilters((prev) => ({ ...prev, departmentCode: e.target.value, batchId: '' }))}
                  >
                    <option value="">All</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Filter batch</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.batchId}
                    onChange={(e) => setFilters((prev) => ({ ...prev, batchId: e.target.value }))}
                  >
                    <option value="">All</option>
                    {batches
                      .filter((b) => (filters.departmentCode ? b.departments?.code === filters.departmentCode : true))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.departments?.code ? `${b.departments.code} · ` : ''}
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Course, faculty, batch…"
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Default room</TableHead>
                      <TableHead className="w-[90px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : visibleOfferings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No offerings yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleOfferings.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">
                            {o.batches?.departments?.code ? `${o.batches.departments.code} · ` : ''}
                            {o.batches?.name || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs text-muted-foreground">{o.subjects?.code || '—'}</div>
                            <div className="text-sm">{o.subjects?.name || '—'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{o.faculty?.name || '—'}</div>
                            {o.faculty?.email ? (
                              <div className="text-xs text-muted-foreground">{o.faculty.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            {o.rooms?.room_number || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(o.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
