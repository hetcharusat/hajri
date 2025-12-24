import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function EntityForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})
  const [dependencies, setDependencies] = useState({})

  useEffect(() => {
    if (open) {
      initializeForm()
      loadDependencies()
    }
  }, [open, node, mode])

  const initializeForm = () => {
    if (mode === 'edit' && node) {
      // Load existing data for edit mode
      setFormData({
        name: node.name || '',
        ...getTypeSpecificDefaults(node.type)
      })
    } else {
      // Set defaults for add mode
      setFormData(getTypeSpecificDefaults(getChildType(node?.type)))
    }
  }

  const getChildType = (parentType) => {
    const childMap = {
      root: 'department',
      department: 'branch',
      branch: 'semester',
      semester: 'class',
      class: 'batch',
    }
    return childMap[parentType] || 'department'
  }

  const getTypeSpecificDefaults = (type) => {
    switch (type) {
      case 'branch':
        return { name: '', abbreviation: '', department_id: node?.id || '' }
      case 'semester':
        return { branch_id: node?.id || '', semester_number: '', start_date: '', end_date: '' }
      case 'class':
        return { semester_id: node?.id || '', class_number: '' }
      case 'batch':
        return { class_id: node?.id || '', batch_letter: '' }
      default:
        return { name: '' }
    }
  }

  const loadDependencies = async () => {
    if (!node) return

    try {
      if (node.type === 'root' || mode === 'add' && node.type === 'department') {
        // No dependencies needed
        return
      }

      if ((mode === 'add' && node.type === 'branch') || (mode === 'edit' && node.type === 'branch')) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name')
          .order('name')
        setDependencies({ departments: depts || [] })
      }
    } catch (err) {
      console.error('Failed to load dependencies:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const targetType = mode === 'edit' ? node.type : getChildType(node?.type)
      
      if (mode === 'add') {
        await handleAdd(targetType)
      } else {
        await handleEdit(targetType)
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (type) => {
    let data = {}

    switch (type) {
      case 'department':
        data = { name: formData.name.trim() }
        await supabase.from('departments').insert([data]).throwOnError()
        break

      case 'branch':
        data = {
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim().toUpperCase(),
          department_id: formData.department_id || null,
        }
        await supabase.from('branches').insert([data]).throwOnError()
        break

      case 'semester':
        data = {
          branch_id: formData.branch_id,
          semester_number: parseInt(formData.semester_number),
          start_date: formData.start_date,
          end_date: formData.end_date,
        }
        await supabase.from('semesters').insert([data]).throwOnError()
        break

      case 'class':
        data = {
          semester_id: formData.semester_id,
          class_number: parseInt(formData.class_number),
        }
        await supabase.from('classes').insert([data]).throwOnError()
        break

      case 'batch':
        data = {
          class_id: formData.class_id,
          batch_letter: formData.batch_letter.trim().toUpperCase(),
        }
        await supabase.from('batches').insert([data]).throwOnError()
        break
    }
  }

  const handleEdit = async (type) => {
    let data = {}
    let table = `${type}s`

    switch (type) {
      case 'department':
        data = { name: formData.name.trim() }
        break

      case 'branch':
        table = 'branches'
        data = {
          name: formData.name.trim(),
          abbreviation: formData.abbreviation?.trim().toUpperCase(),
        }
        break

      case 'semester':
        data = {
          start_date: formData.start_date,
          end_date: formData.end_date,
        }
        break

      case 'class':
        table = 'classes'
        data = { class_number: parseInt(formData.class_number) }
        break

      case 'batch':
        table = 'batches'
        data = { batch_letter: formData.batch_letter.trim().toUpperCase() }
        break
    }

    await supabase.from(table).update(data).eq('id', node.id).throwOnError()
  }

  const renderFields = () => {
    const type = mode === 'edit' ? node?.type : getChildType(node?.type)

    switch (type) {
      case 'department':
        return (
          <FormField label="Department Name" required>
            <Input
              placeholder="e.g. Building A"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </FormField>
        )

      case 'branch':
        return (
          <>
            <FormField label="Branch Name" required>
              <Input
                placeholder="e.g. Computer Engineering"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Abbreviation" required>
              <Input
                placeholder="e.g. CE"
                value={formData.abbreviation || ''}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                maxLength={5}
                required
              />
            </FormField>
            {mode === 'add' && dependencies.departments && (
              <FormField label="Department (Optional)">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.department_id || ''}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                >
                  <option value="">None</option>
                  {dependencies.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>
            )}
          </>
        )

      case 'semester':
        return (
          <>
            <FormField label="Semester Number" required>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.semester_number || ''}
                onChange={(e) => setFormData({ ...formData, semester_number: e.target.value })}
                required
              >
                <option value="">Select semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </FormField>
            <FormField label="End Date" required>
              <Input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </FormField>
          </>
        )

      case 'class':
        return (
          <FormField label="Class Number" required>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 1, 2, 3"
              value={formData.class_number || ''}
              onChange={(e) => setFormData({ ...formData, class_number: e.target.value })}
              required
            />
          </FormField>
        )

      case 'batch':
        return (
          <FormField label="Batch Letter" required>
            <Input
              placeholder="e.g. A, B, C"
              value={formData.batch_letter || ''}
              onChange={(e) => setFormData({ ...formData, batch_letter: e.target.value })}
              maxLength={1}
              required
            />
          </FormField>
        )

      default:
        return null
    }
  }

  const getTitle = () => {
    if (mode === 'edit') {
      return `Edit ${node?.type || 'Item'}`
    }
    const childType = getChildType(node?.type)
    return `Add ${childType.charAt(0).toUpperCase() + childType.slice(1)}`
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={getTitle()}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}
      {renderFields()}
    </SlidePanel>
  )
}
