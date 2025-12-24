import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Plus, Trash2, Clock, Edit2, Check, X } from 'lucide-react'

export function PeriodTemplatesTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [templates, setTemplates] = useState([])
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [periods, setPeriods] = useState([])
  
  const [editingPeriodId, setEditingPeriodId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (activeTemplate) {
      loadPeriods(activeTemplate.id)
    }
  }, [activeTemplate])

  async function loadTemplates() {
    try {
      setLoading(true)
      setError('')

      const { data, error: err } = await supabase
        .from('period_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err

      setTemplates(data || [])
      
      const active = data?.find(t => t.is_active)
      if (active) {
        setActiveTemplate(active)
      } else if (data?.length > 0) {
        setActiveTemplate(data[0])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadPeriods(templateId) {
    try {
      const { data, error: err } = await supabase
        .from('periods')
        .select('*')
        .eq('template_id', templateId)
        .order('period_number', { ascending: true })

      if (err) throw err
      setPeriods(data || [])
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSetActive(templateId) {
    try {
      setError('')
      await supabase.from('period_templates').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      const { error: err } = await supabase.from('period_templates').update({ is_active: true }).eq('id', templateId)
      if (err) throw err
      await loadTemplates()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreateTemplate() {
    const name = prompt('Enter template name:')
    if (!name) return

    try {
      setError('')
      const { data, error: err } = await supabase.from('period_templates').insert([{ name, is_active: false }]).select().single()
      if (err) throw err
      await loadTemplates()
      setActiveTemplate(data)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Delete this template? All periods will be deleted.')) return
    try {
      setError('')
      const { error: err } = await supabase.from('period_templates').delete().eq('id', id)
      if (err) throw err
      await loadTemplates()
    } catch (e) {
      setError(e.message)
    }
  }

  function startEditPeriod(period) {
    setEditingPeriodId(period.id)
    setEditForm({
      period_number: period.period_number,
      name: period.name,
      start_time: period.start_time,
      end_time: period.end_time,
      is_break: period.is_break
    })
  }

  async function handleSavePeriod(periodId) {
    try {
      setError('')
      const { error: err } = await supabase.from('periods').update({
        period_number: editForm.period_number,
        name: editForm.name,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        is_break: editForm.is_break
      }).eq('id', periodId)
      if (err) throw err
      setEditingPeriodId(null)
      await loadPeriods(activeTemplate.id)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleAddPeriod() {
    if (!activeTemplate) return
    try {
      setError('')
      const maxPeriod = Math.max(...periods.map(p => p.period_number), 0)
      const { error: err } = await supabase.from('periods').insert([{
        template_id: activeTemplate.id,
        period_number: maxPeriod + 1,
        name: `Period ${maxPeriod + 1}`,
        start_time: '09:00:00',
        end_time: '10:00:00',
        is_break: false
      }])
      if (err) throw err
      await loadPeriods(activeTemplate.id)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeletePeriod(periodId) {
    if (!confirm('Delete this period?')) return
    try {
      setError('')
      const { error: err } = await supabase.from('periods').delete().eq('id', periodId)
      if (err) throw err
      await loadPeriods(activeTemplate.id)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading period templates...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Period Templates</h3>
        <p className="text-sm text-muted-foreground">
          Define your institution's scheduling framework (periods, breaks, timings)
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
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
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    activeTemplate?.id === template.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setActiveTemplate(template)}
                >
                  <div>
                    <div className="font-medium">{template.name}</div>
                    {template.is_active && <div className="text-xs text-green-600 font-semibold">● ACTIVE</div>}
                  </div>
                  <div className="flex gap-1">
                    {!template.is_active && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleSetActive(template.id) }}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id) }} disabled={template.is_active}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No templates yet. Create one to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{activeTemplate ? `Periods: ${activeTemplate.name}` : 'Select a template'}</CardTitle>
              {activeTemplate && (
                <Button size="sm" onClick={handleAddPeriod}>
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
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={period.id}>
                      {editingPeriodId === period.id ? (
                        <>
                          <TableCell>
                            <Input type="number" value={editForm.period_number} onChange={(e) => setEditForm({ ...editForm, period_number: parseInt(e.target.value) })} className="w-16" />
                          </TableCell>
                          <TableCell>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.is_break ? 'break' : 'class'} onChange={(e) => setEditForm({ ...editForm, is_break: e.target.value === 'break' })}>
                              <option value="class">Class</option>
                              <option value="break">Break</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => handleSavePeriod(period.id)}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingPeriodId(null)}>
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
                              <Button size="sm" variant="ghost" onClick={() => startEditPeriod(period)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeletePeriod(period.id)}>
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
