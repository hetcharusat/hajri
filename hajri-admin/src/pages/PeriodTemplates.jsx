import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { 
  AlertCircle, 
  Plus, 
  Trash2, 
  Clock, 
  Edit2, 
  Check, 
  X, 
  Coffee, 
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Search,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const { semesterId } = useScopeStore()

  const [uiError, setUiError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [expandedTemplate, setExpandedTemplate] = useState(null)
  
  // Dialog states
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  
  // Import dialog states
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importSearchQuery, setImportSearchQuery] = useState('')
  const [importFilterBranch, setImportFilterBranch] = useState('all')
  const [importFilterSemester, setImportFilterSemester] = useState('all')
  const [selectedImportTemplate, setSelectedImportTemplate] = useState('')
  
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [periodForm, setPeriodForm] = useState({
    period_number: 1,
    name: '',
    start_time: '09:00:00',
    end_time: '10:00:00',
    is_break: false
  })

  // Fetch current semester info
  const currentSemesterQuery = useQuery({
    queryKey: ['currentSemester', semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      if (!supabase || !semesterId) return null
      const { data, error } = await supabase
        .from('semesters')
        .select('*, branch:branches(id, name, abbreviation, department:departments(id, name))')
        .eq('id', semesterId)
        .single()
      if (error) throw error
      return data
    },
  })

  const currentSemester = currentSemesterQuery.data

  // Fetch all semesters for import filter
  const allSemestersQuery = useQuery({
    queryKey: ['allSemesters'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('semesters')
        .select('id, semester_number, branch:branches(id, name, abbreviation)')
        .order('semester_number')
      if (error) throw error
      return data || []
    },
  })

  const allSemesters = allSemestersQuery.data || []

  // Get unique branches from semesters for filter
  const branchesForFilter = useMemo(() => {
    const branchMap = new Map()
    allSemesters.forEach(sem => {
      if (sem.branch && !branchMap.has(sem.branch.id)) {
        branchMap.set(sem.branch.id, sem.branch)
      }
    })
    return Array.from(branchMap.values())
  }, [allSemesters])

  // Fetch templates for CURRENT semester only
  const templatesQuery = useQuery({
    queryKey: ['periodTemplates', semesterId],
    enabled: !!semesterId,
    queryFn: async () => {
      if (!supabase || !semesterId) return []
      const { data, error } = await supabase
        .from('period_templates')
        .select('*')
        .eq('semester_id', semesterId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const templates = templatesQuery.data || []

  // Fetch ALL templates for import (excluding current semester)
  const allTemplatesQuery = useQuery({
    queryKey: ['allPeriodTemplates'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('period_templates')
        .select('*, semester:semesters(id, semester_number, branch:branches(id, name, abbreviation))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const allTemplates = allTemplatesQuery.data || []

  // Filter templates for import (exclude current semester, apply filters)
  const importableTemplates = useMemo(() => {
    let filtered = allTemplates.filter(t => t.semester_id !== semesterId)
    
    // Filter by branch
    if (importFilterBranch !== 'all') {
      filtered = filtered.filter(t => t.semester?.branch?.id === importFilterBranch)
    }
    
    // Filter by semester number
    if (importFilterSemester !== 'all') {
      filtered = filtered.filter(t => t.semester?.semester_number === parseInt(importFilterSemester))
    }
    
    // Filter by search query
    if (importSearchQuery.trim()) {
      const query = importSearchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.semester?.branch?.name?.toLowerCase().includes(query) ||
        t.semester?.branch?.abbreviation?.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [allTemplates, semesterId, importFilterBranch, importFilterSemester, importSearchQuery])

  const effectiveTemplateId = useMemo(() => {
    if (selectedTemplateId) return selectedTemplateId
    const active = templates.find((t) => t.is_active)
    if (active?.id) return active.id
    if (templates[0]?.id) return templates[0].id
    return null
  }, [selectedTemplateId, templates])

  const setActiveMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!supabase || !semesterId) throw new Error('Supabase not configured or no semester selected')
      // Only deactivate templates in current semester
      await supabase
        .from('period_templates')
        .update({ is_active: false })
        .eq('semester_id', semesterId)

      const { error } = await supabase
        .from('period_templates')
        .update({ is_active: true })
        .eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })
    },
    onError: (e) => setUiError(e?.message || 'Failed to set active template'),
  })

  const createTemplateMutation = useMutation({
    mutationFn: async (name) => {
      if (!supabase || !semesterId) throw new Error('Supabase not configured or no semester selected')
      const insertData = { 
        name, 
        slots: [], 
        is_active: false,
        semester_id: semesterId
      }
      const { data, error } = await supabase
        .from('period_templates')
        .insert([insertData])
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async (created) => {
      setSelectedTemplateId(created?.id || null)
      setExpandedTemplate(created?.id || null)
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })
      setCreateTemplateOpen(false)
      setNewTemplateName('')
    },
    onError: (e) => setUiError(e?.message || 'Failed to create template'),
  })

  // Import template mutation - copies from another semester to current semester
  const importTemplateMutation = useMutation({
    mutationFn: async (sourceTemplateId) => {
      if (!supabase || !semesterId) throw new Error('Supabase not configured or no semester selected')
      
      // Get source template from allTemplates
      const sourceTemplate = allTemplates.find(t => t.id === sourceTemplateId)
      if (!sourceTemplate) throw new Error('Source template not found')
      
      const insertData = { 
        name: sourceTemplate.name,
        slots: sourceTemplate.slots || [],
        is_active: false,
        semester_id: semesterId
      }
      
      const { data, error } = await supabase
        .from('period_templates')
        .insert([insertData])
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: async (created) => {
      setSelectedTemplateId(created?.id || null)
      setExpandedTemplate(created?.id || null)
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })
      await queryClient.invalidateQueries({ queryKey: ['allPeriodTemplates'] })
      setImportDialogOpen(false)
      setImportSearchQuery('')
      setImportFilterBranch('all')
      setImportFilterSemester('all')
      setSelectedImportTemplate('')
    },
    onError: (e) => setUiError(e?.message || 'Failed to import template'),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { error } = await supabase.from('period_templates').delete().eq('id', templateId)
      if (error) throw error
    },
    onSuccess: async () => {
      setSelectedTemplateId(null)
      setExpandedTemplate(null)
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })
      await queryClient.invalidateQueries({ queryKey: ['allPeriodTemplates'] })
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
      await queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })
      setPeriodDialogOpen(false)
    },
    onError: (e) => setUiError(e?.message || 'Failed to update template slots'),
  })

  function handleCreateTemplate(e) {
    e.preventDefault()
    if (!newTemplateName.trim()) return
    setUiError('')
    createTemplateMutation.mutate(newTemplateName.trim())
  }

  function handleImportTemplate(templateId) {
    if (!templateId) return
    setUiError('')
    importTemplateMutation.mutate(templateId)
  }

  function handleSetActive(templateId) {
    setUiError('')
    setActiveMutation.mutate(templateId)
  }

  function handleDeleteTemplate(templateId) {
    if (!confirm('Delete this template? All periods will be deleted.')) return
    setUiError('')
    deleteTemplateMutation.mutate(templateId)
  }

  function incrementTime(time, minutes) {
    const [h, m] = time.split(':').map(Number)
    const totalMinutes = h * 60 + m + minutes
    const newH = Math.floor(totalMinutes / 60) % 24
    const newM = totalMinutes % 60
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`
  }

  function openAddPeriodDialog(template) {
    setSelectedTemplateId(template.id)
    const slots = normalizeSlots(template?.slots)
    const maxPeriod = Math.max(...slots.map(p => p.period_number), 0)
    const lastPeriod = slots[slots.length - 1]
    
    setPeriodForm({
      period_number: maxPeriod + 1,
      name: `Period ${maxPeriod + 1}`,
      start_time: lastPeriod?.end_time || '09:00:00',
      end_time: incrementTime(lastPeriod?.end_time || '09:00:00', 60),
      is_break: false
    })
    setEditingPeriod(null)
    setPeriodDialogOpen(true)
  }

  function openEditPeriodDialog(template, period) {
    setSelectedTemplateId(template.id)
    setPeriodForm({
      period_number: period.period_number,
      name: period.name,
      start_time: period.start_time,
      end_time: period.end_time,
      is_break: period.is_break
    })
    setEditingPeriod(period)
    setPeriodDialogOpen(true)
  }

  function handleSavePeriod(e) {
    e.preventDefault()
    if (!selectedTemplateId) return
    setUiError('')

    const template = templates.find(t => t.id === selectedTemplateId)
    const currentPeriods = normalizeSlots(template?.slots)

    let nextSlots
    if (editingPeriod) {
      nextSlots = currentPeriods.map((p) =>
        p.id === editingPeriod.id
          ? {
              ...p,
              period_number: Number(periodForm.period_number),
              name: periodForm.name,
              start_time: normalizeTimeString(periodForm.start_time),
              end_time: normalizeTimeString(periodForm.end_time),
              is_break: Boolean(periodForm.is_break),
            }
          : p
      )
    } else {
      nextSlots = [...currentPeriods, {
        id: newSlotId(),
        period_number: Number(periodForm.period_number),
        name: periodForm.name,
        start_time: normalizeTimeString(periodForm.start_time),
        end_time: normalizeTimeString(periodForm.end_time),
        is_break: Boolean(periodForm.is_break),
      }]
    }

    updateSlotsMutation.mutate({ templateId: selectedTemplateId, slots: nextSlots })
  }

  function handleDeletePeriod(template, periodId) {
    if (!confirm('Delete this period?')) return
    setUiError('')

    const currentPeriods = normalizeSlots(template?.slots)
    const nextSlots = currentPeriods.filter((p) => p.id !== periodId)
    updateSlotsMutation.mutate({ templateId: template.id, slots: nextSlots })
  }

  function formatTimeDisplay(time) {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2, '0')} ${period}`
  }

  function calculateDuration(start, end) {
    if (!start || !end) return ''
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff <= 0) return ''
    const hours = Math.floor(diff / 60)
    const mins = diff % 60
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
  }

  const loading = templatesQuery.isLoading || currentSemesterQuery.isLoading
  const error = uiError || templatesQuery.error?.message || currentSemesterQuery.error?.message || null

  // No semester selected - show message
  if (!semesterId) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Semester</h3>
            <p className="text-sm text-muted-foreground">
              Please select a semester from the sidebar to view and manage period templates.
              Each semester has its own set of period templates.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading period templates...</p>
        </div>
      </div>
    )
  }

  const semesterLabel = currentSemester 
    ? `${currentSemester.branch?.abbreviation || currentSemester.branch?.name || ''} Sem ${currentSemester.semester_number}`
    : 'Current Semester'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 via-transparent to-transparent p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Clock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Period Templates</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs gap-1">
                <GraduationCap className="h-3 w-3" />
                {semesterLabel}
              </Badge>
              <span className="text-sm text-muted-foreground">
                • {templates.length} template{templates.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['periodTemplates', semesterId] })}
            disabled={templatesQuery.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", templatesQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
          
          {/* Import Button */}
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open)
            if (!open) {
              setImportSearchQuery('')
              setImportFilterBranch('all')
              setImportFilterSemester('all')
              setSelectedImportTemplate('')
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Import Period Template</DialogTitle>
                <DialogDescription>
                  Import a period template from another semester into {semesterLabel}
                </DialogDescription>
              </DialogHeader>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-3 py-4 border-b">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={importSearchQuery}
                      onChange={(e) => setImportSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={importFilterBranch} onValueChange={setImportFilterBranch}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchesForFilter.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.abbreviation || branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={importFilterSemester} onValueChange={setImportFilterSemester}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All Semesters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {[1,2,3,4,5,6,7,8].map((num) => (
                      <SelectItem key={num} value={String(num)}>
                        Semester {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Template List */}
              <div className="flex-1 overflow-y-auto py-2 min-h-[200px] max-h-[400px]">
                {importableTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {allTemplates.length <= 1 
                        ? 'No templates available to import' 
                        : 'No templates match your filters'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {importableTemplates.map((template) => {
                      const periods = normalizeSlots(template.slots)
                      const isSelected = selectedImportTemplate === template.id
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedImportTemplate(template.id)}
                          className={cn(
                            'p-3 rounded-lg border cursor-pointer transition-colors',
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/30'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-8 w-8 rounded-md flex items-center justify-center",
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                <Clock className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{template.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {template.semester?.branch?.abbreviation || 'Unknown'} Sem {template.semester?.semester_number}
                                  </Badge>
                                  <span>{periods.length} periods</span>
                                  <span>{periods.filter(p => !p.is_break).length} classes</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              
              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleImportTemplate(selectedImportTemplate)}
                  disabled={!selectedImportTemplate || importTemplateMutation.isPending}
                >
                  {importTemplateMutation.isPending ? 'Importing...' : 'Import to ' + semesterLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTemplate}>
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a period template for {semesterLabel}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <Label htmlFor="template-name" className="text-foreground">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Default (8 AM - 5 PM)"
                    className="mt-2"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateTemplateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newTemplateName.trim() || createTemplateMutation.isPending}>
                    {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setUiError('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create a period template for {semesterLabel} to define the schedule structure
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setCreateTemplateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
              {allTemplates.length > 0 && (
                <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Import from Other Semester
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const templatePeriods = normalizeSlots(template.slots)
            const isExpanded = expandedTemplate === template.id
            const totalDuration = templatePeriods.reduce((acc, p) => {
              const [sh, sm] = p.start_time.split(':').map(Number)
              const [eh, em] = p.end_time.split(':').map(Number)
              return acc + ((eh * 60 + em) - (sh * 60 + sm))
            }, 0)
            const classCount = templatePeriods.filter(p => !p.is_break).length
            const breakCount = templatePeriods.filter(p => p.is_break).length

            return (
              <Card 
                key={template.id} 
                className={cn(
                  'transition-all overflow-hidden',
                  template.is_active && 'ring-2 ring-primary/50'
                )}
              >
                {/* Template Header - Clickable */}
                <div 
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      {template.is_active && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {classCount} classes
                      </span>
                      {breakCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Coffee className="h-3 w-3" />
                          {breakCount} breaks
                        </span>
                      )}
                      {totalDuration > 0 && (
                        <span>
                          {Math.floor(totalDuration / 60)}h {totalDuration % 60}m total
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!template.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleSetActive(template.id) }}
                        disabled={setActiveMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Set Active
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id) }}
                      disabled={template.is_active || deleteTemplateMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content - Periods */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10">
                    {/* Period List Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                      <span className="text-sm font-medium text-muted-foreground">
                        {templatePeriods.length} Period{templatePeriods.length !== 1 ? 's' : ''}
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => openAddPeriodDialog(template)}
                        disabled={updateSlotsMutation.isPending}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Period
                      </Button>
                    </div>

                    {templatePeriods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
                        <p className="text-sm text-muted-foreground mb-3">No periods defined yet</p>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openAddPeriodDialog(template)}
                          className="gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add First Period
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {templatePeriods.map((period) => (
                          <div 
                            key={period.id}
                            className={cn(
                              'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30',
                              period.is_break && 'bg-amber-500/5'
                            )}
                          >
                            {/* Period Number */}
                            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted text-sm font-bold shrink-0">
                              {period.period_number}
                            </div>

                            {/* Period Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{period.name}</span>
                                {period.is_break ? (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs gap-1">
                                    <Coffee className="h-3 w-3" />
                                    Break
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    Class
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Time Info */}
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <div className="font-mono text-muted-foreground">
                                  {formatTimeDisplay(period.start_time)} → {formatTimeDisplay(period.end_time)}
                                </div>
                                <div className="text-xs text-muted-foreground/60">
                                  {calculateDuration(period.start_time, period.end_time)}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openEditPeriodDialog(template, period)}
                                disabled={updateSlotsMutation.isPending}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleDeletePeriod(template, period.id)}
                                disabled={updateSlotsMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Period Dialog */}
      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSavePeriod}>
            <DialogHeader>
              <DialogTitle>
                {editingPeriod ? 'Edit Period' : 'Add New Period'}
              </DialogTitle>
              <DialogDescription>
                {editingPeriod 
                  ? 'Modify the period details below'
                  : 'Enter the details for the new period'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 py-6">
              {/* Period Number & Name */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="period-number" className="text-xs text-muted-foreground">Slot #</Label>
                  <Input
                    id="period-number"
                    type="number"
                    min="1"
                    value={periodForm.period_number}
                    onChange={(e) => setPeriodForm({ ...periodForm, period_number: parseInt(e.target.value) || 1 })}
                    className="mt-1.5"
                  />
                </div>
                <div className="col-span-4">
                  <Label htmlFor="period-name" className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    id="period-name"
                    value={periodForm.name}
                    onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                    placeholder="e.g., Period 1, Lunch Break"
                    className="mt-1.5"
                  />
                </div>
              </div>
              
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time" className="text-xs text-muted-foreground">Start Time</Label>
                  <TimePicker
                    id="start-time"
                    value={periodForm.start_time}
                    onChange={(val) => setPeriodForm({ ...periodForm, start_time: val })}
                    placeholder="9:00 AM"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="end-time" className="text-xs text-muted-foreground">End Time</Label>
                  <TimePicker
                    id="end-time"
                    value={periodForm.end_time}
                    onChange={(val) => setPeriodForm({ ...periodForm, end_time: val })}
                    placeholder="10:00 AM"
                    className="mt-1.5"
                  />
                </div>
              </div>
              
              {/* Type Selection */}
              <div>
                <Label htmlFor="period-type" className="text-xs text-muted-foreground">Period Type</Label>
                <Select 
                  value={periodForm.is_break ? 'break' : 'class'} 
                  onValueChange={(val) => setPeriodForm({ ...periodForm, is_break: val === 'break' })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-500" />
                        Class Period
                      </span>
                    </SelectItem>
                    <SelectItem value="break">
                      <span className="flex items-center gap-2">
                        <Coffee className="h-4 w-4 text-amber-500" />
                        Break / Lunch
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPeriodDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSlotsMutation.isPending}>
                {updateSlotsMutation.isPending ? 'Saving...' : (editingPeriod ? 'Save Changes' : 'Add Period')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
