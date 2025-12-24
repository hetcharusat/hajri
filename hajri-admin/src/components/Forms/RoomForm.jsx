import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function RoomForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})
  const [departments, setDepartments] = useState([])
  const [supportsDepartmentLink, setSupportsDepartmentLink] = useState(null) // null | boolean

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

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    setDepartments(data || [])
  }

  const detectRoomDepartmentSupport = async () => {
    // Check if rooms table has department_id column. If not, we won't show/use it.
    const res = await supabase.from('rooms').select('id, department_id').limit(1)
    if (res.error) {
      setSupportsDepartmentLink(false)
      return false
    }
    setSupportsDepartmentLink(true)
    return true
  }

  useEffect(() => {
    if (open) {
      setSupportsDepartmentLink(null)
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

      // Only load departments and show the field if the DB actually supports rooms.department_id
      detectRoomDepartmentSupport().then((supported) => {
        if (supported) loadDepartments()
      })
    }
  }, [open, node, mode])

  const lockedToDepartment = mode !== 'edit' && !!getDepartmentIdFromContext(node)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        room_number: formData.room_number.trim(),
        type: formData.type,
      }

      if (supportsDepartmentLink) {
        payload.department_id = formData.department_id || null
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
        <div className="p-4 rounded-lg bg-destructive/10 border-l-4 border-destructive text-sm text-destructive mb-4 shadow-sm">
          <div className="font-semibold mb-1">Error</div>
          {error}
        </div>
      )}

      <FormField label="Room Number" required>
        <Input
          placeholder="e.g. 101, A-205"
          value={formData.room_number || ''}
          onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
          required
        />
      </FormField>

      {supportsDepartmentLink && (
        <FormField label="Department (Optional)">
          <select
            className="flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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

      <FormField label="Type" required>
        <select
          className="flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md"
          value={formData.type || 'CLASSROOM'}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          required
        >
          <option value="CLASSROOM">Classroom</option>
          <option value="LAB">Lab</option>
          <option value="LECTURE_HALL">Lecture Hall</option>
          <option value="AUDITORIUM">Auditorium</option>
          <option value="SEMINAR_ROOM">Seminar Room</option>
        </select>
      </FormField>
    </SlidePanel>
  )
}
