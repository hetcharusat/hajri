import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'

export function RoomForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const { departmentId } = useScopeStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})

  const getDepartmentIdFromContext = (ctxNode) => {
    if (!ctxNode) return departmentId || ''
    if (ctxNode.type === 'department') return ctxNode.id
    if (ctxNode.department_id) return ctxNode.department_id
    if (Array.isArray(ctxNode.parentPath)) {
      const deptNode = [...ctxNode.parentPath].reverse().find((p) => p?.type === 'department')
      return deptNode?.id || departmentId || ''
    }
    return departmentId || ''
  }

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && node) {
        setFormData({
          room_number: node.room_number || '',
          type: node.type || 'CLASSROOM',
          department_id: node.department_id || '',
        })
      } else {
        const contextDeptId = getDepartmentIdFromContext(node)
        setFormData({
          room_number: '',
          type: 'CLASSROOM',
          department_id: contextDeptId || '',
        })
      }
    }
  }, [open, node, mode, departmentId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const finalDepartmentId = formData.department_id || departmentId
    if (!finalDepartmentId) {
      setError('Department is required. Please select a department from the tree.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        room_number: formData.room_number.trim(),
        type: formData.type,
        department_id: finalDepartmentId,
      }

      if (mode === 'add') {
        await supabase.from('rooms').insert([payload]).throwOnError()
      } else {
        await supabase.from('rooms').update(payload).eq('id', node.id).throwOnError()
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
      title={mode === 'edit' ? 'Edit Room' : 'Add Room'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive text-sm text-destructive mb-4">
          <div className="font-semibold mb-1">Error</div>
          {error}
        </div>
      )}

      <FormField label="Room Number" required>
        <Input
          placeholder="e.g. 101, A-205"
          value={formData.room_number || ''}
          onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
          className="border-2 focus:ring-2 focus:ring-primary"
          required
        />
      </FormField>

      <FormField label="Type" required>
        <EnhancedSelect
          value={{ value: formData.type || 'CLASSROOM', label: formData.type === 'CLASSROOM' ? 'Classroom' : formData.type === 'LAB' ? 'Lab' : formData.type === 'LECTURE_HALL' ? 'Lecture Hall' : formData.type === 'AUDITORIUM' ? 'Auditorium' : formData.type === 'SEMINAR_ROOM' ? 'Seminar Room' : 'Classroom' }}
          onChange={(option) => setFormData({ ...formData, type: option?.value || 'CLASSROOM' })}
          options={[
            { value: 'CLASSROOM', label: 'Classroom' },
            { value: 'LAB', label: 'Lab' },
            { value: 'LECTURE_HALL', label: 'Lecture Hall' },
            { value: 'AUDITORIUM', label: 'Auditorium' },
            { value: 'SEMINAR_ROOM', label: 'Seminar Room' }
          ]}
          placeholder="Select room type"
        />
      </FormField>
    </SlidePanel>
  )
}
