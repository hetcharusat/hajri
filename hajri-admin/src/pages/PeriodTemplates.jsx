import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Plus, Trash2, Clock, Edit2, Check, X } from 'lucide-react'

function newSlotId() {
  return (
    globalThis?.crypto?.randomUUID?.() ||
    `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  )
}

function normalizeTimeString(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  return trimmed
}

function toTimeInputValue(value) {
  const normalized = normalizeTimeString(value)
  return normalized ? normalized.slice(0, 5) : ''
}

function normalizeSlots(rawSlots) {
  const slotsArray = Array.isArray(rawSlots) ? rawSlots : []
  return slotsArray
    .map((s, idx) => ({
      id: s?.id || newSlotId(),
      period_number: Number.isFinite(Number(s?.period_number)) ? Number(s.period_number) : idx + 1,
      name: typeof s?.name === 'string' ? s.name : `Period ${idx + 1}`,
      start_time: normalizeTimeString(s?.start_time || '09:00:00'),
      end_time: normalizeTimeString(s?.end_time || '10:00:00'),
      is_break: Boolean(s?.is_break),
    }))
    .sort((a, b) => a.period_number - b.period_number)
}

export default function PeriodTemplates() {
  const queryClient = useQueryClient()

  const [uiError, setUiError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [editingPeriodId, setEditingPeriodId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newPeriodForm, setNewPeriodForm] = useState({})

  const templatesQuery = useQuery({
    queryKey: ['periodTemplates'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('period_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const templates = templatesQuery.data || []

  const effectiveTemplateId = useMemo(() => {
    if (selectedTemplateId) return selectedTemplateId
    const active = templates.find((t) => t.is_active)
    if (active?.id) return active.id
    if (templates[0]?.id) return templates[0].id
    return null
  }, [selectedTemplateId, templates])

  const activeTemplate = useMemo(() => {
    if (!effectiveTemplateId) return null
    return templates.find((t) => t.id === effectiveTemplateId) || null
  }, [effectiveTemplateId, templates])

  const periods = useMemo(() => normalizeSlots(activeTemplate?.slots), [activeTemplate?.slots])
  const canEditStructure = Boolean(activeTemplate)

  const setActiveMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!supabase) throw new Error('Supabase not configured')
      await supabase
        .from('period_templates')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      const { error } = await supabase
        .from('period_templates')
        .update({ is_active: true })
        .eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates'] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to set active template'),
  })

  const createTemplateMutation = useMutation({
    mutationFn: async (name) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('period_templates')
        .insert([{ name, slots: [], is_active: false }])
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async (created) => {
      setSelectedTemplateId(created?.id || null)
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates'] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to create template'),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { error } = await supabase.from('period_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      setSelectedTemplateId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['periodTemplates'] }),
      ])
    },
    onError: (e) => setUiError(e?.message || 'Failed to delete template'),
  })

  const updateSlotsMutation = useMutation({
    mutationFn: async ({ templateId, slots }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { error } = await supabase
        .from('period_templates')
        .update({ slots })
        .eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates'] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to update template slots'),
  })

  function startEditPeriod(period) {
    setEditingPeriodId(period.id)
    setEditForm({
      id: period.id,
      period_number: period.period_number,
      name: period.name,
      start_time: toTimeInputValue(period.start_time),
      end_time: toTimeInputValue(period.end_time),
      is_break: period.is_break,
    })
  }

  function cancelEdit() {
    setEditingPeriodId(null)
    setEditForm({})
  }

  function handleSetActive(templateId) {
    setUiError('')
    setActiveMutation.mutate(templateId)
  }

  function handleCreateTemplate() {
    const name = prompt('Enter template name:')
    if (!name) return
    setUiError('')
    createTemplateMutation.mutate(name)
  }

  function handleDeleteTemplate(templateId) {
    if (!confirm('Delete this template? All periods will be deleted.')) return
    setUiError('')
    deleteTemplateMutation.mutate(templateId)
  }

  function handleAddPeriod() {
    if (!effectiveTemplateId) return
    setUiError('')
    const maxPeriod = Math.max(...periods.map((p) => p.period_number), 0)
    const nextNumber = maxPeriod + 1
    setIsAddingNew(true)
    setNewPeriodForm({
      period_number: nextNumber,
      name: `Period ${nextNumber}`,
      start_time: '09:00',
      end_time: '10:00',
      is_break: false,
    })
  }

  function handleSaveNewPeriod() {
    if (!effectiveTemplateId) return
    setUiError('')

    const nextSlots = [...periods, {
      id: newSlotId(),
      period_number: Number(newPeriodForm.period_number),
      name: newPeriodForm.name,
      start_time: normalizeTimeString(newPeriodForm.start_time),
      end_time: normalizeTimeString(newPeriodForm.end_time),
      is_break: Boolean(newPeriodForm.is_break),
    }]

    updateSlotsMutation.mutate({ templateId: effectiveTemplateId, slots: nextSlots })
    setIsAddingNew(false)
    setNewPeriodForm({})
  }

  function handleCancelNewPeriod() {
    setIsAddingNew(false)
    setNewPeriodForm({})
  }

  function handleDeletePeriod(periodId) {
    if (!effectiveTemplateId) return
    if (!confirm('Delete this period?')) return
    setUiError('')

    const nextSlots = periods.filter((p) => p.id !== periodId)
    updateSlotsMutation.mutate({ templateId: effectiveTemplateId, slots: nextSlots })
  }

  function handleSavePeriod(periodId) {
    if (!effectiveTemplateId) return
    setUiError('')

    const nextSlots = periods.map((p) =>
      p.id === periodId
        ? {
            ...p,
            period_number: Number(editForm.period_number),
            name: editForm.name,
            start_time: normalizeTimeString(editForm.start_time),
            end_time: normalizeTimeString(editForm.end_time),
            is_break: Boolean(editForm.is_break),
          }
        : p
    )
    updateSlotsMutation.mutate({ templateId: effectiveTemplateId, slots: nextSlots })
    cancelEdit()
  }

  const loading = templatesQuery.isLoading
  const error =
    uiError ||
    templatesQuery.error?.message ||
    null

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading period templates...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Period Templates</h1>
        <p className="text-muted-foreground">Global time slots (periods, breaks, ordering) used by all timetables.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button type="button" onClick={() => setUiError('')}>
            <X className="h-4 w-4 text-destructive" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Templates</CardTitle>
              <Button size="sm" onClick={handleCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>
            <CardDescription>Select a template to view/edit its periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={
                    'flex items-center justify-between gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ' +
                    (activeTemplate?.id === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50')
                  }
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div>
                    <div className="font-medium">{template.name}</div>
                    {template.is_active && <div className="text-xs text-green-600 font-semibold">● ACTIVE</div>}
                  </div>
                  <div className="flex gap-1">
                    {!template.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setActiveMutation.isLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSetActive(template.id)
                        }}
                        className="text-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={template.is_active || deleteTemplateMutation.isLoading}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(template.id)
                      }}
                      className="text-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No templates yet. Create one to get started.</div>
              )}
            </div>
          </CardContent>
        </Card>

  <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{activeTemplate ? `Periods: ${activeTemplate.name}` : 'Select a template'}</CardTitle>
                <CardDescription>Slot ordering is controlled by period number; break slots are supported.</CardDescription>
              </div>
              {activeTemplate && (
                <Button size="sm" onClick={handleAddPeriod} disabled={updateSlotsMutation.isLoading || isAddingNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Period
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!activeTemplate ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p>Select a template from the left to edit its periods</p>
              </div>
            ) : periods.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No periods defined yet. Click "Add Period" to create one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={period.id}>
                      {editingPeriodId === period.id ? (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              value={editForm.period_number ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, period_number: e.target.value })}
                              className="w-16"
                              disabled={!canEditStructure || updateSlotsMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.name ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              disabled={!canEditStructure || updateSlotsMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={editForm.start_time ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                              disabled={!canEditStructure || updateSlotsMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={editForm.end_time ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                              disabled={!canEditStructure || updateSlotsMutation.isLoading}
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                              value={editForm.is_break ? 'break' : 'class'}
                              onChange={(e) => setEditForm({ ...editForm, is_break: e.target.value === 'break' })}
                              disabled={!canEditStructure || updateSlotsMutation.isLoading}
                            >
                              <option value="class">Class</option>
                              <option value="break">Break</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSavePeriod(period.id)}
                                disabled={!canEditStructure || updateSlotsMutation.isLoading}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={updateSlotsMutation.isLoading}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{period.period_number}</TableCell>
                          <TableCell>{period.name}</TableCell>
                          <TableCell className="font-mono text-sm">{period.start_time}</TableCell>
                          <TableCell className="font-mono text-sm">{period.end_time}</TableCell>
                          <TableCell>
                            {period.is_break ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">BREAK</span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">CLASS</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditPeriod(period)}
                                disabled={updateSlotsMutation.isLoading}
                                className="text-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeletePeriod(period.id)}
                                disabled={updateSlotsMutation.isLoading}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {isAddingNew && (
                    <TableRow>
                      <TableCell>
                        <Input
                          type="number"
                          value={newPeriodForm.period_number ?? ''}
                          onChange={(e) => setNewPeriodForm({ ...newPeriodForm, period_number: e.target.value })}
                          className="w-16"
                          disabled={updateSlotsMutation.isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newPeriodForm.name ?? ''}
                          onChange={(e) => setNewPeriodForm({ ...newPeriodForm, name: e.target.value })}
                          disabled={updateSlotsMutation.isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={newPeriodForm.start_time ?? ''}
                          onChange={(e) => setNewPeriodForm({ ...newPeriodForm, start_time: e.target.value })}
                          disabled={updateSlotsMutation.isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={newPeriodForm.end_time ?? ''}
                          onChange={(e) => setNewPeriodForm({ ...newPeriodForm, end_time: e.target.value })}
                          disabled={updateSlotsMutation.isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          value={newPeriodForm.is_break ? 'break' : 'class'}
                          onChange={(e) => setNewPeriodForm({ ...newPeriodForm, is_break: e.target.value === 'break' })}
                          disabled={updateSlotsMutation.isLoading}
                        >
                          <option value="class">Class</option>
                          <option value="break">Break</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSaveNewPeriod}
                            disabled={updateSlotsMutation.isLoading}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelNewPeriod}
                            disabled={updateSlotsMutation.isLoading}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
