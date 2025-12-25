import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

// Helper to generate auto-name on save
const generateAutoName = async (type, data) => {
  try {
    if (type === 'class' && data.semester_id && data.class_number) {
      const { data: semester } = await supabase
        .from('semesters')
        .select('semester_number, branches(abbreviation)')
        .eq('id', data.semester_id)
        .single()
      
      if (semester?.branches?.abbreviation) {
        return `${semester.semester_number}${semester.branches.abbreviation}${data.class_number}`
      }
    }
    
    if (type === 'batch' && data.class_id && data.batch_letter) {
      const { data: classInfo } = await supabase
        .from('classes')
        .select('class_number, semesters(semester_number, branches(abbreviation))')
        .eq('id', data.class_id)
        .single()
      
      if (classInfo?.semesters?.branches?.abbreviation) {
        return `${classInfo.semesters.semester_number}${classInfo.semesters.branches.abbreviation}${classInfo.class_number}-${data.batch_letter.toUpperCase()}`
      }
    }
  } catch (err) {
    console.error('Auto-name generation failed:', err)
  }
  return null
}

export function EntityForm({ open, onOpenChange, node, mode = 'add', onSuccess }) {
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
      setFormData({
        name: node.name || '',
        abbreviation: node.abbreviation || node.meta || '',
        semester_number: node.semester_number || '',
        start_date: node.start_date || '',
        end_date: node.end_date || '',
        class_number: node.class_number || '',
        batch_letter: node.batch_letter || '',
      })
    } else {
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

  const handleClose = () => {
    setError('')
    setFormData({})
    onOpenChange?.(false)
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
      handleClose()
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
          department_id: node?.id || null,
        }
        await supabase.from('branches').insert([data]).throwOnError()
        break

      case 'semester':
        data = {
          branch_id: node?.id,
          semester_number: parseInt(formData.semester_number),
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }
        await supabase.from('semesters').insert([data]).throwOnError()
        break

      case 'class':
        const autoClassName = await generateAutoName('class', { semester_id: node?.id, class_number: formData.class_number })
        data = {
          semester_id: node?.id,
          class_number: parseInt(formData.class_number),
          name: autoClassName || `Class ${formData.class_number}`,
        }
        await supabase.from('classes').insert([data]).throwOnError()
        break

      case 'batch':
        const autoBatchName = await generateAutoName('batch', { class_id: node?.id, batch_letter: formData.batch_letter })
        data = {
          class_id: node?.id,
          batch_letter: formData.batch_letter.trim().toUpperCase(),
          name: autoBatchName || `Batch ${formData.batch_letter.toUpperCase()}`,
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
          semester_number: parseInt(formData.semester_number),
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        }
        break

      case 'class':
        table = 'classes'
        const updatedClassName = await generateAutoName('class', { 
          semester_id: node.semester_id, 
          class_number: formData.class_number 
        })
        data = { 
          class_number: parseInt(formData.class_number),
          ...(updatedClassName && { name: updatedClassName })
        }
        break

      case 'batch':
        table = 'batches'
        const updatedBatchName = await generateAutoName('batch', { 
          class_id: node.class_id, 
          batch_letter: formData.batch_letter 
        })
        data = { 
          batch_letter: formData.batch_letter.trim().toUpperCase(),
          ...(updatedBatchName && { name: updatedBatchName })
        }
        break
    }

    await supabase.from(table).update(data).eq('id', node.id).throwOnError()
  }

  const getTitle = () => {
    const type = mode === 'edit' ? node?.type : getChildType(node?.type)
    const action = mode === 'edit' ? 'Edit' : 'Add'
    return `${action} ${type?.charAt(0).toUpperCase()}${type?.slice(1) || ''}`
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
                className="uppercase"
              />
            </FormField>
          </>
        )

      case 'semester':
        return (
          <>
            <FormField label="Semester Number" required>
              <Input
                type="number"
                min="1"
                max="8"
                placeholder="e.g. 1, 2, 3..."
                value={formData.semester_number || ''}
                onChange={(e) => setFormData({ ...formData, semester_number: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Start Date">
              <Input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
            <div className="mt-2 text-xs text-muted-foreground">
              Auto-naming: <span className="font-mono font-semibold">{'{semester}{branch}{number}'}</span> (e.g., 3CE1)
            </div>
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
              className="uppercase"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              Auto-naming: <span className="font-mono font-semibold">{'{semester}{branch}{class}-{letter}'}</span> (e.g., 3CE1-A)
            </div>
          </FormField>
        )

      default:
        return null
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={handleClose}
      title={getTitle()}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
          {error}
        </div>
      )}
      
      {renderFields()}
    </SlidePanel>
  )
}
