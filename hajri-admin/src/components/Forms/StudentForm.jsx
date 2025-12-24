import { useState, useEffect } from 'react'
import { SlidePanel, FormField } from '../SlidePanel/SlidePanel'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function StudentForm({ open, onClose, node, mode = 'add', onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({})

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && node) {
        setFormData({
          roll_number: node.roll_number || '',
          name: node.name || '',
          email: node.email || '',
          batch_id: node.batch_id || '',
          enrollment_year: node.enrollment_year || new Date().getFullYear(),
        })
      } else if (node?.type === 'batch') {
        setFormData({
          roll_number: '',
          name: '',
          email: '',
          batch_id: node.id,
          enrollment_year: new Date().getFullYear(),
        })
      } else {
        setFormData({
          roll_number: '',
          name: '',
          email: '',
          batch_id: '',
          enrollment_year: new Date().getFullYear(),
        })
      }
    }
  }, [open, node, mode])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        roll_number: formData.roll_number.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        batch_id: formData.batch_id,
        enrollment_year: parseInt(formData.enrollment_year),
      }

      if (mode === 'add') {
        await supabase.from('students').insert([payload]).throwOnError()
      } else {
        await supabase.from('students').update(payload).eq('id', node.id).throwOnError()
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
      title={mode === 'edit' ? 'Edit Student' : 'Add Student'}
      onSubmit={handleSubmit}
      loading={loading}
    >
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      <FormField label="Roll Number" required>
        <Input
          placeholder="e.g. 2024001"
          value={formData.roll_number || ''}
          onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Full Name" required>
        <Input
          placeholder="e.g. John Doe"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Email" required>
        <Input
          type="email"
          placeholder="e.g. john.doe@example.com"
          value={formData.email || ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Enrollment Year" required>
        <Input
          type="number"
          min="2000"
          max={new Date().getFullYear() + 1}
          value={formData.enrollment_year || new Date().getFullYear()}
          onChange={(e) => setFormData({ ...formData, enrollment_year: e.target.value })}
          required
        />
      </FormField>
    </SlidePanel>
  )
}
