import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Plus, Trash2, Clock, Edit2, Check, X } from 'lucide-react'

export default function PeriodTemplates() {
  const queryClient = useQueryClient()

  const [uiError, setUiError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [editingPeriodId, setEditingPeriodId] = useState(null)
  const [editForm, setEditForm] = useState({})

  async function isTemplateUsedByPublishedTimetable(templateId) {
    if (!supabase) throw new Error('Supabase not configured')
    const { count, error } = await supabase
      .from('timetable_events')
      .select('id, timetable_versions!inner(status), periods!inner(template_id)', {
        count: 'exact',
        head: true,
      })
      .eq('timetable_versions.status', 'published')
      .eq('periods.template_id', templateId)

    if (error) throw error
    return (count || 0) > 0
  }

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

  const periodsQuery = useQuery({
    queryKey: ['periods', { templateId: effectiveTemplateId }],
    enabled: Boolean(effectiveTemplateId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('template_id', effectiveTemplateId)
        .order('period_number', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const periods = periodsQuery.data || []

  const templateUsedByPublishedQuery = useQuery({
    queryKey: ['periodTemplateUsage', { templateId: effectiveTemplateId }],
    enabled: Boolean(effectiveTemplateId),
    queryFn: async () => {
      return isTemplateUsedByPublishedTimetable(effectiveTemplateId)
    },
  })

  const templateUsedByPublished = Boolean(templateUsedByPublishedQuery.data)
  const canEditStructure = Boolean(activeTemplate) && !templateUsedByPublished

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
        .insert([{ name, is_active: false }])
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
      const used = await isTemplateUsedByPublishedTimetable(templateId)
      if (used) throw new Error('Cannot delete: template is used by a published timetable')

      const { error } = await supabase.from('period_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      setSelectedTemplateId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['periodTemplates'] }),
        queryClient.invalidateQueries({ queryKey: ['periods'] }),
        queryClient.invalidateQueries({ queryKey: ['periodTemplateUsage'] }),
      ])
    },
    onError: (e) => setUiError(e?.message || 'Failed to delete template'),
  })

  const upsertPeriodMutation = useMutation({
    mutationFn: async ({ templateId, periodId, patch }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const used = await isTemplateUsedByPublishedTimetable(templateId)
      if (used) throw new Error('Cannot edit periods: template is used by a published timetable')
      const { error } = await supabase.from('periods').update(patch).eq('id', periodId)
      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['periods', { templateId: effectiveTemplateId }] }),
        queryClient.invalidateQueries({ queryKey: ['periodTemplateUsage', { templateId: effectiveTemplateId }] }),
      ])
    },
    onError: (e) => setUiError(e?.message || 'Failed to update period'),
  })

  const addPeriodMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!supabase) throw new Error('Supabase not configured')
      const used = await isTemplateUsedByPublishedTimetable(templateId)
      if (used) throw new Error('Cannot add periods: template is used by a published timetable')

      const maxPeriod = Math.max(...periods.map((p) => p.period_number), 0)
      const { error } = await supabase.from('periods').insert([
        {
          template_id: templateId,
          period_number: maxPeriod + 1,
          name: `Period ${maxPeriod + 1}`,
          start_time: '09:00:00',
          end_time: '10:00:00',
          is_break: false,
        },
      ])
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['periods', { templateId: effectiveTemplateId }] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to add period'),
  })

  const deletePeriodMutation = useMutation({
    mutationFn: async ({ templateId, periodId }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const used = await isTemplateUsedByPublishedTimetable(templateId)
      if (used) throw new Error('Cannot delete periods: template is used by a published timetable')

      const { error } = await supabase.from('periods').delete().eq('id', periodId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['periods', { templateId: effectiveTemplateId }] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to delete period'),
  })

  function startEditPeriod(period) {
    setEditingPeriodId(period.id)
    setEditForm({
      period_number: period.period_number,
      name: period.name,
      start_time: period.start_time,
      end_time: period.end_time,
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
    addPeriodMutation.mutate(effectiveTemplateId)
  }

  function handleDeletePeriod(periodId) {
    if (!effectiveTemplateId) return
    if (!confirm('Delete this period?')) return
    setUiError('')
    deletePeriodMutation.mutate({ templateId: effectiveTemplateId, periodId })
  }

  function handleSavePeriod(periodId) {
    if (!effectiveTemplateId) return
    setUiError('')
    upsertPeriodMutation.mutate({
      templateId: effectiveTemplateId,
      periodId,
      patch: {
        period_number: Number(editForm.period_number),
        name: editForm.name,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        is_break: Boolean(editForm.is_break),
      },
    })
    cancelEdit()
  }

  const loading = templatesQuery.isLoading
  const error =
    uiError ||
    templatesQuery.error?.message ||
    periodsQuery.error?.message ||
    templateUsedByPublishedQuery.error?.message

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

      {activeTemplate && templateUsedByPublished && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Template locked</p>
            <p className="text-sm text-muted-foreground">
              This template is referenced by a published timetable. Destructive edits (add/delete/edit periods, delete template) are blocked.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{activeTemplate ? `Periods: ${activeTemplate.name}` : 'Select a template'}</CardTitle>
                <CardDescription>Slot ordering is controlled by period number; break slots are supported.</CardDescription>
              </div>
              {activeTemplate && (
                <Button size="sm" onClick={handleAddPeriod} disabled={!canEditStructure || addPeriodMutation.isLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Period
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!activeTemplate ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
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
                              disabled={!canEditStructure}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.name ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              disabled={!canEditStructure}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={editForm.start_time ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                              disabled={!canEditStructure}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={editForm.end_time ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                              disabled={!canEditStructure}
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={editForm.is_break ? 'break' : 'class'}
                              onChange={(e) => setEditForm({ ...editForm, is_break: e.target.value === 'break' })}
                              disabled={!canEditStructure}
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
                                disabled={!canEditStructure || upsertPeriodMutation.isLoading}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                <X className="h-4 w-4 text-destructive" />
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
                              <Button size="sm" variant="ghost" onClick={() => startEditPeriod(period)} disabled={!canEditStructure}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeletePeriod(period.id)} disabled={!canEditStructure}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
