import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
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

  const handleBranchChange = (branchId) => {
    if (lockedToSemesterContext) return
    setFormData({ ...formData, branch_id: branchId, semester_id: '' })
    loadSemestersForBranch(branchId)
  }

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
        <div className="p-4 rounded-lg bg-destructive/10 border-l-4 border-destructive text-sm text-destructive mb-4 shadow-sm">
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
        <select
          className="flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          value={formData.branch_id || ''}
          onChange={(e) => handleBranchChange(e.target.value)}
          required
          disabled={lockedToSemesterContext}
        >
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.abbreviation})</option>
          ))}
        </select>
      </FormField>

      <FormField label="Semester" required>
        <select
          className="flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          value={formData.semester_id || ''}
          onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
          required
          disabled={!formData.branch_id || lockedToSemesterContext}
        >
          <option value="">Select semester</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>Semester {s.semester_number}</option>
          ))}
        </select>
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
        <select
          className="flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md"
          value={formData.type || 'LECTURE'}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          required
        >
          <option value="LECTURE">Lecture</option>
          <option value="PRACTICAL">Practical</option>
          <option value="LAB">Lab</option>
          <option value="TUTORIAL">Tutorial</option>
        </select>
      </FormField>
    </SlidePanel>
  )
}
