import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function FacultyForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})
  const [departments, setDepartments] = useState([])
  const [schema, setSchema] = useState({
    supportsDepartmentId: null,
    abbrField: null, // 'abbr' | 'abbreviation' | null
  })
  const [supportsSemesterLink, setSupportsSemesterLink] = useState(null) // null | boolean
  const [semesterSubjects, setSemesterSubjects] = useState([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])

  const getDepartmentIdFromContext = (ctxNode) => {
    if (!ctxNode) return ''
    if (ctxNode.type === 'department') return ctxNode.id
    if (ctxNode.department_id) return ctxNode.department_id
    if (Array.isArray(ctxNode.parentPath)) {
      const deptNode = [...ctxNode.parentPath].reverse().find((p) => p?.type === 'department')
      return deptNode?.id || ''
    }
    return ''
  }

  const getSemesterIdFromContext = (ctxNode) => {
    if (!ctxNode) return ''
    if (ctxNode.type === 'semester') return ctxNode.id
    if (ctxNode.semester_id) return ctxNode.semester_id
    if (Array.isArray(ctxNode.parentPath)) {
      const semNode = [...ctxNode.parentPath].reverse().find((p) => p?.type === 'semester')
      return semNode?.id || ''
    }
    return ''
  }

  const detectSchema = async () => {
    // Detect if faculty.department_id exists
    const deptProbe = await supabase.from('faculty').select('id, department_id').limit(1)
    const supportsDepartmentId = !deptProbe.error

    // Detect abbr / abbreviation
    const abbrProbe = await supabase.from('faculty').select('id, abbr').limit(1)
    const abbrField = !abbrProbe.error ? 'abbr' : null
    if (!abbrField) {
      const abbr2Probe = await supabase.from('faculty').select('id, abbreviation').limit(1)
      if (!abbr2Probe.error) {
        setSchema({ supportsDepartmentId, abbrField: 'abbreviation' })
        return
      }
    }

    setSchema({ supportsDepartmentId, abbrField })
  }

  const detectSemesterLink = async () => {
    const probe = await supabase.from('semester_faculty').select('semester_id, faculty_id').limit(1)
    setSupportsSemesterLink(!probe.error)
  }

  useEffect(() => {
    if (open) {
      ;(async () => {
        await detectSchema()
        await detectSemesterLink()
      })()
    }
  }, [open, node, mode])

  useEffect(() => {
    if (!open) return

    const ctxDeptId = getDepartmentIdFromContext(node)
    const ctxSemesterId = getSemesterIdFromContext(node)

    if (schema.supportsDepartmentId) {
      loadDepartments()
    } else {
      setDepartments([])
    }

    if (ctxSemesterId) {
      loadSemesterSubjects(ctxSemesterId)
    } else {
      setSemesterSubjects([])
      setSelectedSubjectIds([])
    }

    if (mode === 'edit' && node) {
      setFormData({
        name: node.name || '',
        email: node.email || '',
        department_id: schema.supportsDepartmentId ? (node.department_id || '') : '',
        abbr: schema.abbrField === 'abbr' ? (node.abbr || '') : '',
        abbreviation: schema.abbrField === 'abbreviation' ? (node.abbreviation || '') : '',
      })
      setSelectedSubjectIds([])
    } else {
      setFormData({
        name: '',
        email: '',
        department_id: schema.supportsDepartmentId ? (ctxDeptId || '') : '',
        abbr: '',
        abbreviation: '',
      })
      setSelectedSubjectIds([])
    }
  }, [open, node, mode, schema.supportsDepartmentId, schema.abbrField])

  const lockedToDepartment = mode !== 'edit' && schema.supportsDepartmentId && !!getDepartmentIdFromContext(node)

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    setDepartments(data || [])
  }

  const loadSemesterSubjects = async (semesterId) => {
    const { data, error: subjectsErr } = await supabase
      .from('subjects')
      .select('id, code, name')
      .eq('semester_id', semesterId)
      .order('code')
    if (!subjectsErr) setSemesterSubjects(data || [])
  }

  const createOfferingsForSemester = async ({ semesterId, facultyId, subjectIds }) => {
    // Verify table exists
    const probe = await supabase.from('course_offerings').select('id').limit(1)
    if (probe.error) return

    const { data: classes, error: classesErr } = await supabase
      .from('classes')
      .select('id')
      .eq('semester_id', semesterId)
    if (classesErr) throw classesErr

    const classIds = (classes || []).map((c) => c.id)
    if (classIds.length === 0) return

    const { data: batches, error: batchesErr } = await supabase
      .from('batches')
      .select('id, class_id')
      .in('class_id', classIds)
    if (batchesErr) throw batchesErr

    const batchIds = (batches || []).map((b) => b.id)
    if (batchIds.length === 0) return

    const rows = []
    for (const batchId of batchIds) {
      for (const subjectId of subjectIds) {
        rows.push({ batch_id: batchId, subject_id: subjectId, faculty_id: facultyId })
      }
    }

    // Prefer upsert so existing offerings are updated.
    // If the unique constraint is missing, fall back to per-row insert/update.
    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const up = await supabase.from('course_offerings').upsert(chunk, { onConflict: 'batch_id,subject_id' })
      if (!up.error) continue

      // Fallback: insert then update for duplicates
      const ins = await supabase.from('course_offerings').insert(chunk)
      if (!ins.error) continue

      for (const r of chunk) {
        const existing = await supabase
          .from('course_offerings')
          .select('id')
          .eq('batch_id', r.batch_id)
          .eq('subject_id', r.subject_id)
          .maybeSingle()

        if (existing.error) throw existing.error

        if (existing.data?.id) {
          const upd = await supabase
            .from('course_offerings')
            .update({ faculty_id: r.faculty_id })
            .eq('id', existing.data.id)
          if (upd.error) throw upd.error
        } else {
          const ins2 = await supabase.from('course_offerings').insert([r])
          if (ins2.error) throw ins2.error
        }
      }
    }
  }

  const linkFacultyToSemester = async ({ semesterId, facultyId }) => {
    if (!supportsSemesterLink) return
    const res = await supabase
      .from('semester_faculty')
      .insert([{ semester_id: semesterId, faculty_id: facultyId }])
    if (res.error) {
      const msg = (res.error.message || '').toLowerCase()
      if (!msg.includes('duplicate') && !msg.includes('unique')) throw res.error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        name: formData.name.trim(),
          email: (formData.email || '').trim() || null,
      }

      if (schema.supportsDepartmentId) {
        payload.department_id = formData.department_id || null
      }

      if (schema.abbrField === 'abbr') {
        payload.abbr = (formData.abbr || '').trim() || null
      }
      if (schema.abbrField === 'abbreviation') {
        payload.abbreviation = (formData.abbreviation || '').trim() || null
      }

      let createdId = node?.id
      if (mode === 'add') {
        const { data } = await supabase.from('faculty').insert([payload]).select('id').single().throwOnError()
        createdId = data?.id
      } else {
        await supabase.from('faculty').update(payload).eq('id', node.id).throwOnError()
      }

      const semesterId = getSemesterIdFromContext(node)
      if (mode === 'add' && semesterId && createdId) {
        await linkFacultyToSemester({ semesterId, facultyId: createdId })
      }
      if (mode === 'add' && semesterId && createdId && selectedSubjectIds.length > 0) {
        await createOfferingsForSemester({
          semesterId,
          facultyId: createdId,
          subjectIds: selectedSubjectIds,
        })
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Faculty' : 'Add Faculty'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive text-sm text-destructive mb-4">
          <div className="font-semibold mb-1">Error</div>
          {error}
        </div>
      )}

      <FormField label="Full Name" required>
        <Input
          placeholder="e.g. Dr. Jane Smith"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Email">
        <Input
          type="email"
          placeholder="e.g. jane.smith@example.com"
          value={formData.email || ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </FormField>

      {schema.abbrField === 'abbr' && (
        <FormField label="Abbr">
          <Input
            placeholder="e.g. HET"
            value={formData.abbr || ''}
            onChange={(e) => setFormData({ ...formData, abbr: e.target.value })}
          />
        </FormField>
      )}

      {schema.abbrField === 'abbreviation' && (
        <FormField label="Abbreviation">
          <Input
            placeholder="e.g. HET"
            value={formData.abbreviation || ''}
            onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
          />
        </FormField>
      )}

      {schema.supportsDepartmentId && (
        <FormField label="Department (Optional)">
          <select
            className="flex h-11 w-full rounded-md border-2 border-border bg-background px-4 py-2.5 text-sm font-medium transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            value={formData.department_id || ''}
            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
            disabled={lockedToDepartment}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {mode === 'add' && getSemesterIdFromContext(node) && semesterSubjects.length > 0 && (
        <FormField label="Link to Subjects (optional)">
          <div className="text-xs text-muted-foreground mb-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            💡 Creates/updates course offerings for all batches in this semester.
          </div>
          <div className="rounded-lg border-2 border-input bg-gradient-to-br from-background to-muted/20 p-3 max-h-[240px] overflow-auto shadow-inner">
            <div className="space-y-1.5">
              {semesterSubjects.map((s) => {
                const checked = selectedSubjectIds.includes(s.id)
                return (
                  <label 
                    key={s.id} 
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/10 cursor-pointer transition-all duration-150 border border-transparent hover:border-primary/30 hover:shadow-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-2 border-primary/50 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all cursor-pointer"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedSubjectIds, s.id]
                          : selectedSubjectIds.filter((id) => id !== s.id)
                        setSelectedSubjectIds(next)
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{s.code}</span>
                        <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </FormField>
      )}
    </SlidePanel>
  )
}
