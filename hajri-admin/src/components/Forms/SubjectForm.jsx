import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { supabase } from '@/lib/supabase'

export function SubjectForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])

  const lockedToSemesterContext = mode !== 'edit' && node?.type === 'semester'

  const getBranchIdFromParentPath = (parentPath) => {
    if (!Array.isArray(parentPath)) return ''
    const branchNode = [...parentPath].reverse().find((p) => p?.type === 'branch')
    return branchNode?.id || ''
  }

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && node) {
        loadBranches()
        setFormData({
          code: node.code || '',
          name: node.name || '',
          branch_id: node.branch_id || '',
          semester_id: node.semester_id || '',
          credits: node.credits || 3,
          type: node.type || 'LECTURE',
        })
        if (node.branch_id) loadSemestersForBranch(node.branch_id)
      } else if (node?.type === 'semester') {
        const branchId = getBranchIdFromParentPath(node.parentPath)
        setFormData({
          code: '',
          name: '',
          branch_id: branchId,
          semester_id: node.id,
          credits: 3,
          type: 'LECTURE',
        })
        if (branchId) {
          loadBranches()
          loadSemestersForBranch(branchId)
        }
      } else if (node?.type === 'branch') {
        loadBranches()
        setFormData({
          code: '',
          name: '',
          branch_id: node.id,
          semester_id: '',
          credits: 3,
          type: 'LECTURE',
        })
        loadSemestersForBranch(node.id)
      } else {
        loadBranches()
        setFormData({
          code: '',
          name: '',
          branch_id: '',
          semester_id: '',
          credits: 3,
          type: 'LECTURE',
        })
      }
    }
  }, [open, node, mode])

  const loadBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name, abbreviation')
      .order('name')
    setBranches(data || [])
  }

  const loadSemestersForBranch = async (branchId) => {
    const { data } = await supabase
      .from('semesters')
      .select('id, semester_number')
      .eq('branch_id', branchId)
      .order('semester_number')
    setSemesters(data || [])
  }

  const handleBranchChange = (selectedOption) => {
    if (lockedToSemesterContext) return
    const branchId = selectedOption?.value || ''
    setFormData({ ...formData, branch_id: branchId, semester_id: '' })
    if (branchId) loadSemestersForBranch(branchId)
  }

  const branchOptions = branches.map(b => ({
    value: b.id,
    label: `${b.name} (${b.abbreviation})`
  }))

  const semesterOptions = semesters.map(s => ({
    value: s.id,
    label: `Semester ${s.semester_number}`
  }))

  const typeOptions = [
    { value: 'LECTURE', label: 'Lecture' },
    { value: 'PRACTICAL', label: 'Practical' },
    { value: 'LAB', label: 'Lab' },
    { value: 'TUTORIAL', label: 'Tutorial' }
  ]

  const selectedBranch = branchOptions.find(opt => opt.value === formData.branch_id) || null
  const selectedSemester = semesterOptions.find(opt => opt.value === formData.semester_id) || null
  const selectedType = typeOptions.find(opt => opt.value === formData.type) || typeOptions[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        semester_id: formData.semester_id,
        credits: parseInt(formData.credits),
        type: formData.type,
      }

      // Check for duplicate subject code in same semester when adding
      if (mode === 'add') {
        const { data: existing, error: checkErr } = await supabase
          .from('subjects')
          .select('id, code, type')
          .eq('semester_id', payload.semester_id)
          .eq('code', payload.code)
          .eq('type', payload.type)
          .maybeSingle()

        if (checkErr) throw checkErr

        if (existing) {
          setError(`Subject "${payload.code}" already exists in this semester as ${existing.type}. Each subject can only have one entry per type.`)
          setLoading(false)
          return
        }
      }

      if (mode === 'add') {
        await supabase.from('subjects').insert([payload]).throwOnError()
      } else {
        await supabase.from('subjects').update(payload).eq('id', node.id).throwOnError()
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
      title={mode === 'edit' ? 'Edit Subject' : 'Add Subject'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive text-sm text-destructive mb-4">
          <div className="font-semibold mb-1">Error</div>
          {error}
        </div>
      )}

      <FormField label="Subject Code" required>
        <Input
          placeholder="e.g. CS101"
          value={formData.code || ''}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Subject Name" required>
        <Input
          placeholder="e.g. Introduction to Programming"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Branch" required>
        <EnhancedSelect
          value={selectedBranch}
          onChange={handleBranchChange}
          options={branchOptions}
          placeholder="Select branch"
          isDisabled={lockedToSemesterContext}
          isClearable
        />
      </FormField>

      <FormField label="Semester" required>
        <EnhancedSelect
          value={selectedSemester}
          onChange={(option) => setFormData({ ...formData, semester_id: option?.value || '' })}
          options={semesterOptions}
          placeholder="Select semester"
          isDisabled={!formData.branch_id || lockedToSemesterContext}
          isClearable
        />
      </FormField>

      <FormField label="Credits" required>
        <Input
          type="number"
          min="1"
          max="10"
          value={formData.credits || 3}
          onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Type" required>
        <EnhancedSelect
          value={selectedType}
          onChange={(option) => setFormData({ ...formData, type: option?.value || 'LECTURE' })}
          options={typeOptions}
          placeholder="Select type"
        />
      </FormField>
    </SlidePanel>
  )
}
