import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useScopeStore, useStructureStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Plus, Edit2, Trash2, RefreshCw, Sparkles, TrendingUp, Users, BookOpen, Layers } from 'lucide-react'

function StatCard({ label, value, helper, icon: Icon, color = 'primary' }) {
  const colorClasses = {
    primary: 'from-primary/10 to-primary/5 border-primary/20',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    green: 'from-green-500/10 to-green-500/5 border-green-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
  }
  
  return (
    <Card className={cn(
      "p-6 border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br",
      colorClasses[color] || colorClasses.primary
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">{label}</div>
          <div className="text-3xl font-bold text-foreground">{value}</div>
          {helper && <div className="mt-2 text-xs text-muted-foreground">{helper}</div>}
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-background/80 flex items-center justify-center shadow-sm">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Overview() {
  const queryClient = useQueryClient()
  const { departmentId, branchId, semesterId, classId, batchId, level } = useScopeStore()
  const { selectedNode, selectNodeAndReveal, triggerRefresh, clearSelection } = useStructureStore()

  const [createDialog, setCreateDialog] = useState(null)
  const [editDialog, setEditDialog] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [formData, setFormData] = useState({})

  const hasScope = useMemo(() => Boolean(level && (departmentId || branchId || semesterId || classId || batchId)), [
    level,
    departmentId,
    branchId,
    semesterId,
    classId,
    batchId,
  ])

  const statsQuery = useQuery({
    queryKey: ['overviewStats', { level, departmentId, branchId, semesterId, classId, batchId }],
    enabled: hasScope,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)

      const base = {
        branchesCount: 0,
        semestersCount: 0,
        activeSemestersCount: 0,
        classesCount: 0,
        subjectsCount: 0,
        batchesCount: 0,
        offeringsCount: 0,
        timetableStatus: '—',
      }

      if (level === 'department' && departmentId) {
        const branchesRes = await supabase
          .from('branches')
          .select('*', { count: 'exact', head: true })
          .eq('department_id', departmentId)
        if (branchesRes.error) throw branchesRes.error

        const branchIdsRes = await supabase.from('branches').select('id').eq('department_id', departmentId)
        if (branchIdsRes.error) throw branchIdsRes.error

        const branchIds = (branchIdsRes.data || []).map((b) => b.id)
        let semestersCount = 0
        if (branchIds.length > 0) {
          const semestersRes = await supabase
            .from('semesters')
            .select('*', { count: 'exact', head: true })
            .in('branch_id', branchIds)
          if (semestersRes.error) throw semestersRes.error
          semestersCount = semestersRes.count || 0
        }

        return { ...base, branchesCount: branchesRes.count || 0, semestersCount }
      }

      if (level === 'branch' && branchId) {
        const semestersRes = await supabase
          .from('semesters')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branchId)
        if (semestersRes.error) throw semestersRes.error

        const activeRes = await supabase
          .from('semesters')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branchId)
          .lte('start_date', today)
          .gte('end_date', today)
        if (activeRes.error) throw activeRes.error

        return {
          ...base,
          semestersCount: semestersRes.count || 0,
          activeSemestersCount: activeRes.count || 0,
        }
      }

      if (level === 'semester' && semesterId) {
        const [classesRes, subjectsRes] = await Promise.all([
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('semester_id', semesterId),
          supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('semester_id', semesterId),
        ])

        if (classesRes.error) throw classesRes.error
        if (subjectsRes.error) throw subjectsRes.error

        return {
          ...base,
          classesCount: classesRes.count || 0,
          subjectsCount: subjectsRes.count || 0,
        }
      }

      if (level === 'class' && classId) {
        const batchesRes = await supabase.from('batches').select('id', { count: 'exact' }).eq('class_id', classId)
        if (batchesRes.error) throw batchesRes.error

        const batchIds = (batchesRes.data || []).map((b) => b.id)
        let offeringsCount = 0
        if (batchIds.length > 0) {
          const offeringsRes = await supabase
            .from('course_offerings')
            .select('*', { count: 'exact', head: true })
            .in('batch_id', batchIds)
          if (offeringsRes.error) throw offeringsRes.error
          offeringsCount = offeringsRes.count || 0
        }

        return {
          ...base,
          batchesCount: batchesRes.count || 0,
          offeringsCount,
        }
      }

      if (level === 'batch' && batchId) {
        const versionsRes = await supabase
          .from('timetable_versions')
          .select('id, status, created_at')
          .eq('batch_id', batchId)
          .order('created_at', { ascending: false })
        if (versionsRes.error) throw versionsRes.error

        const versions = versionsRes.data || []
        const hasPublished = versions.some((v) => v.status === 'published')
        const hasDraft = versions.some((v) => v.status === 'draft')
        const timetableStatus = hasPublished ? 'Published' : hasDraft ? 'Draft' : 'Not started'

        return { ...base, timetableStatus }
      }

      return base
    },
  })

  const canHaveChildren = Boolean(selectedNode) && ['department', 'branch', 'semester', 'class'].includes(selectedNode?.type)

  const childrenQuery = useQuery({
    queryKey: ['overviewChildren', { parentType: selectedNode?.type || null, parentId: selectedNode?.id || null }],
    enabled: Boolean(selectedNode?.id) && canHaveChildren,
    queryFn: async () => {
      if (!selectedNode) return []

      const makeChild = (child) => ({
        ...child,
        parentPath: Array.isArray(selectedNode.parentPath) ? [...selectedNode.parentPath, selectedNode] : [selectedNode],
      })

      if (selectedNode.type === 'department') {
        const res = await supabase
          .from('branches')
          .select('id, name, abbreviation')
          .eq('department_id', selectedNode.id)
          .order('name')
        if (res.error) throw res.error
        return (res.data || []).map((b) =>
          makeChild({ id: b.id, type: 'branch', name: b.name, meta: b.abbreviation || null })
        )
      }

      if (selectedNode.type === 'branch') {
        const res = await supabase
          .from('semesters')
          .select('id, semester_number, start_date, end_date')
          .eq('branch_id', selectedNode.id)
          .order('semester_number')
        if (res.error) throw res.error

        return (res.data || []).map((s) => {
          const meta =
            s.start_date && s.end_date
              ? `${new Date(s.start_date).toLocaleDateString('en-US', { month: 'short' })} - ${new Date(
                  s.end_date
                ).toLocaleDateString('en-US', { month: 'short' })}`
              : null
          return makeChild({ id: s.id, type: 'semester', name: `Semester ${s.semester_number}`, meta })
        })
      }

      if (selectedNode.type === 'semester') {
        const res = await supabase
          .from('classes')
          .select('id, class_number')
          .eq('semester_id', selectedNode.id)
          .order('class_number')
        if (res.error) throw res.error
        return (res.data || []).map((c) => makeChild({ id: c.id, type: 'class', name: `Class ${c.class_number}`, meta: null }))
      }

      if (selectedNode.type === 'class') {
        const res = await supabase
          .from('batches')
          .select('id, batch_letter')
          .eq('class_id', selectedNode.id)
          .order('batch_letter')
        if (res.error) throw res.error
        return (res.data || []).map((b) => makeChild({ id: b.id, type: 'batch', name: `Batch ${b.batch_letter}`, meta: null }))
      }

      return []
    },
  })

  const createMutation = useMutation({
    mutationFn: async ({ type, data }) => {
      if (!supabase) throw new Error('Supabase not configured')

      if (type === 'branch') {
        const res = await supabase.from('branches').insert([data]).select().single()
        if (res.error) throw res.error
        return { type, data: res.data }
      }

      if (type === 'semester') {
        const res = await supabase.from('semesters').insert([data]).select().single()
        if (res.error) throw res.error
        return { type, data: res.data }
      }

      if (type === 'class') {
        const res = await supabase.from('classes').insert([data]).select().single()
        if (res.error) throw res.error
        return { type, data: res.data }
      }

      if (type === 'batch') {
        const res = await supabase.from('batches').insert([data]).select().single()
        if (res.error) throw res.error
        return { type, data: res.data }
      }

      throw new Error('Unknown type')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] })
      queryClient.invalidateQueries({ queryKey: ['overviewChildren'] })
      setCreateDialog(null)
      setFormData({})
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, data }) => {
      if (!supabase) throw new Error('Supabase not configured')

      if (type === 'branch') {
        const res = await supabase.from('branches').update(data).eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'semester') {
        const res = await supabase.from('semesters').update(data).eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'class') {
        const res = await supabase.from('classes').update(data).eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'batch') {
        const res = await supabase.from('batches').update(data).eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      throw new Error('Unknown type')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] })
      queryClient.invalidateQueries({ queryKey: ['overviewChildren'] })
      setEditDialog(null)
      setFormData({})
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }) => {
      if (!supabase) throw new Error('Supabase not configured')

      if (type === 'department') {
        const res = await supabase.from('departments').delete().eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'branch') {
        const res = await supabase.from('branches').delete().eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'semester') {
        const res = await supabase.from('semesters').delete().eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'class') {
        const res = await supabase.from('classes').delete().eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      if (type === 'batch') {
        const res = await supabase.from('batches').delete().eq('id', id)
        if (res.error) throw res.error
        return { type, id }
      }

      throw new Error('Unknown type')
    },
    onSuccess: ({ type, id }) => {
      queryClient.invalidateQueries({ queryKey: ['overviewStats'] })
      queryClient.invalidateQueries({ queryKey: ['overviewChildren'] })
      // If we deleted the currently selected node, clear the selection
      if (selectedNode?.id === id) {
        clearSelection()
      }
      setDeleteDialog(null)
      // Refresh the tree when a node is deleted
      triggerRefresh()
    },
  })

  const stats = statsQuery.data || {
    branchesCount: 0,
    semestersCount: 0,
    activeSemestersCount: 0,
    classesCount: 0,
    subjectsCount: 0,
    batchesCount: 0,
    offeringsCount: 0,
    timetableStatus: '—',
  }

  if (!hasScope) {
    return <div className="text-sm text-muted-foreground">Select a node from the tree.</div>
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['overviewStats'] })
    queryClient.invalidateQueries({ queryKey: ['overviewChildren'] })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 via-transparent to-transparent p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {selectedNode?.name || 'Overview'}
              <Sparkles className="h-5 w-5 text-primary/60" />
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedNode?.type?.charAt(0).toUpperCase() + selectedNode?.type?.slice(1)} • Summary for the current tree scope
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={statsQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", statsQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialog(selectedNode)}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {statsQuery.error ? (
        <Card className="p-4 border-2 border-destructive bg-destructive/10">
          <div className="text-sm font-semibold text-destructive">Error</div>
          <div className="mt-1 text-sm text-foreground">{statsQuery.error?.message || 'Failed to load overview'}</div>
        </Card>
      ) : null}

      {statsQuery.isLoading ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading statistics...
        </div>
      ) : null}

      {level === 'department' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Branches" value={stats.branchesCount} icon={Layers} color="blue" />
          <StatCard label="Semesters" value={stats.semestersCount} helper="All semesters under this department" icon={BookOpen} color="green" />
        </div>
      ) : null}

      {level === 'branch' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Semesters" value={stats.semestersCount} icon={BookOpen} color="blue" />
          <StatCard label="Active Semesters" value={stats.activeSemestersCount} helper="Based on start/end date" icon={TrendingUp} color="green" />
        </div>
      ) : null}

      {level === 'semester' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Classes" value={stats.classesCount} icon={Users} color="purple" />
          <StatCard label="Subjects" value={stats.subjectsCount} icon={BookOpen} color="blue" />
        </div>
      ) : null}

      {level === 'class' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Batches" value={stats.batchesCount} icon={Users} color="purple" />
          <StatCard label="Assignments" value={stats.offeringsCount} helper="Total course offerings across this class's batches" icon={Layers} color="amber" />
        </div>
      ) : null}

      {level === 'batch' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Timetable Status" value={stats.timetableStatus} icon={TrendingUp} color="green" />
          <StatCard label="Scope" value="Batch" helper="Scheduling is always batch-scoped" icon={Users} color="blue" />
        </div>
      ) : null}

      {canHaveChildren ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Navigate</div>
            <Button
              size="sm"
              onClick={() => {
                const childType =
                  selectedNode?.type === 'department'
                    ? 'branch'
                    : selectedNode?.type === 'branch'
                      ? 'semester'
                      : selectedNode?.type === 'semester'
                        ? 'class'
                        : selectedNode?.type === 'class'
                          ? 'batch'
                          : null
                setCreateDialog(childType)
                setFormData({})
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create{' '}
              {selectedNode?.type === 'department'
                ? 'Branch'
                : selectedNode?.type === 'branch'
                  ? 'Semester'
                  : selectedNode?.type === 'semester'
                    ? 'Class'
                    : selectedNode?.type === 'class'
                      ? 'Batch'
                      : ''}
            </Button>
          </div>
          {childrenQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : childrenQuery.error ? (
            <div className="text-sm text-destructive">{childrenQuery.error?.message || 'Failed to load children'}</div>
          ) : (childrenQuery.data || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No items yet.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(childrenQuery.data || []).map((n) => (
                <div
                  key={`${n.type}-${n.id}`}
                  className={cn('rounded-lg border-2 border-border bg-card p-4 group relative hover:shadow-md transition-all')}
                >
                  <button
                    type="button"
                    onClick={() => selectNodeAndReveal(n)}
                    className={cn('w-full text-left hover:opacity-80 transition-opacity')}
                  >
                    <div className="text-sm font-medium text-foreground truncate">{n.name}</div>
                    {n.meta ? <div className="mt-1 text-xs text-muted-foreground truncate">{n.meta}</div> : null}
                    <div className="mt-2 text-[10px] text-muted-foreground uppercase tracking-wide">{n.type}</div>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditDialog(n)
                        if (n.type === 'branch') {
                          setFormData({ name: n.name, abbreviation: n.meta || '' })
                        } else if (n.type === 'semester') {
                          const parts = n.name.match(/Semester (\d+)/)
                          setFormData({ semester_number: parts ? parts[1] : '', start_date: '', end_date: '' })
                        } else if (n.type === 'class') {
                          const parts = n.name.match(/Class (\d+)/)
                          setFormData({ class_number: parts ? parts[1] : '' })
                        } else if (n.type === 'batch') {
                          const parts = n.name.match(/Batch ([A-Z])/)
                          setFormData({ batch_letter: parts ? parts[1] : '' })
                        }
                      }}
                      className="rounded-md bg-card p-1.5 hover:bg-secondary border-2 border-border text-foreground hover:text-foreground transition-all"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteDialog(n)
                      }}
                      className="rounded-md bg-card p-1.5 hover:bg-destructive/10 border-2 border-border text-destructive hover:text-destructive transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Create Dialog */}
      <Dialog open={Boolean(createDialog)} onOpenChange={(open) => !open && setCreateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create{' '}
              {createDialog === 'branch'
                ? 'Branch'
                : createDialog === 'semester'
                  ? 'Semester'
                  : createDialog === 'class'
                    ? 'Class'
                    : createDialog === 'batch'
                      ? 'Batch'
                      : ''}
            </DialogTitle>
            <DialogDescription>
              {createDialog === 'branch' && 'Add a new branch to this department.'}
              {createDialog === 'semester' && 'Add a new semester to this branch. Dates are optional.'}
              {createDialog === 'class' && 'Add a new class to this semester.'}
              {createDialog === 'batch' && 'Add a new batch to this class.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {createDialog === 'branch' && (
              <>
                <div>
                  <Label htmlFor="name">Branch Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div>
                  <Label htmlFor="abbreviation">Abbreviation (optional)</Label>
                  <Input
                    id="abbreviation"
                    value={formData.abbreviation || ''}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="e.g., CS"
                  />
                </div>
              </>
            )}
            {createDialog === 'semester' && (
              <>
                <div>
                  <Label htmlFor="semester_number">Semester Number</Label>
                  <Input
                    id="semester_number"
                    type="number"
                    value={formData.semester_number || ''}
                    onChange={(e) => setFormData({ ...formData, semester_number: e.target.value })}
                    placeholder="e.g., 1"
                  />
                </div>
                <div>
                  <Label htmlFor="start_date">Start Date (optional)</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date (optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </>
            )}
            {createDialog === 'class' && (
              <div>
                <Label htmlFor="class_number">Class Number</Label>
                <Input
                  id="class_number"
                  type="number"
                  value={formData.class_number || ''}
                  onChange={(e) => setFormData({ ...formData, class_number: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
            )}
            {createDialog === 'batch' && (
              <div>
                <Label htmlFor="batch_letter">Batch Letter</Label>
                <Input
                  id="batch_letter"
                  value={formData.batch_letter || ''}
                  onChange={(e) => setFormData({ ...formData, batch_letter: e.target.value.toUpperCase() })}
                  placeholder="e.g., A"
                  maxLength={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const payload = { ...formData }
                if (createDialog === 'branch') payload.department_id = departmentId
                if (createDialog === 'semester') {
                  payload.branch_id = branchId
                  if (!payload.start_date) delete payload.start_date
                  if (!payload.end_date) delete payload.end_date
                }
                if (createDialog === 'class') payload.semester_id = semesterId
                if (createDialog === 'batch') payload.class_id = classId

                createMutation.mutate({ type: createDialog, data: payload })
              }}
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editDialog)} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editDialog?.type}</DialogTitle>
            <DialogDescription>Update the details for this {editDialog?.type}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editDialog?.type === 'branch' && (
              <>
                <div>
                  <Label htmlFor="edit_name">Branch Name</Label>
                  <Input
                    id="edit_name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_abbreviation">Abbreviation (optional)</Label>
                  <Input
                    id="edit_abbreviation"
                    value={formData.abbreviation || ''}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                  />
                </div>
              </>
            )}
            {editDialog?.type === 'semester' && (
              <>
                <div>
                  <Label htmlFor="edit_semester_number">Semester Number</Label>
                  <Input
                    id="edit_semester_number"
                    type="number"
                    value={formData.semester_number || ''}
                    onChange={(e) => setFormData({ ...formData, semester_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_start_date">Start Date (optional)</Label>
                  <Input
                    id="edit_start_date"
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_end_date">End Date (optional)</Label>
                  <Input
                    id="edit_end_date"
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </>
            )}
            {editDialog?.type === 'class' && (
              <div>
                <Label htmlFor="edit_class_number">Class Number</Label>
                <Input
                  id="edit_class_number"
                  type="number"
                  value={formData.class_number || ''}
                  onChange={(e) => setFormData({ ...formData, class_number: e.target.value })}
                />
              </div>
            )}
            {editDialog?.type === 'batch' && (
              <div>
                <Label htmlFor="edit_batch_letter">Batch Letter</Label>
                <Input
                  id="edit_batch_letter"
                  value={formData.batch_letter || ''}
                  onChange={(e) => setFormData({ ...formData, batch_letter: e.target.value.toUpperCase() })}
                  maxLength={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const payload = { ...formData }
                if (editDialog.type === 'semester') {
                  if (!payload.start_date) payload.start_date = null
                  if (!payload.end_date) payload.end_date = null
                }
                updateMutation.mutate({ type: editDialog.type, id: editDialog.id, data: payload })
              }}
              disabled={updateMutation.isLoading}
            >
              {updateMutation.isLoading ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteDialog)} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog?.type}?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{deleteDialog?.name}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate({ type: deleteDialog.type, id: deleteDialog.id })
              }}
              disabled={deleteMutation.isLoading}
            >
              {deleteMutation.isLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
