import { useEffect, useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    branchId: '',
  })

  const [formData, setFormData] = useState({
    branch_id: '',
    semester_id: '',
    class_id: '',
    batch_letter: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [batchesRes, branchesRes] = await Promise.all([
        supabase
          .from('batches')
          .select(`
            *,
            classes(
              id,
              class_number,
              semesters(
                id,
                semester_number,
                branches(id, name, abbreviation)
              )
            )
          `)
          .order('batch_letter', { ascending: true }),
        supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true }),
      ])

      if (batchesRes.error) throw batchesRes.error
      if (branchesRes.error) throw branchesRes.error

      setBatches(batchesRes.data || [])
      setBranches(branchesRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSemestersForBranch = async (branchId) => {
    if (!branchId) {
      setSemesters([])
      setClasses([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('semesters')
        .select('*')
        .eq('branch_id', branchId)
        .order('semester_number', { ascending: true })

      if (error) throw error
      setSemesters(data || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const loadClassesForSemester = async (semesterId) => {
    if (!semesterId) {
      setClasses([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('semester_id', semesterId)
        .order('class_number', { ascending: true })

      if (error) throw error
      setClasses(data || [])
    } catch (e) {
      setError(e.message)
    }
  }

  const getBatchDisplayName = (batch) => {
    const semNum = batch.classes?.semesters?.semester_number || '?'
    const abbr = batch.classes?.semesters?.branches?.abbreviation || '??'
    const classNum = batch.classes?.class_number || '?'
    const letter = batch.batch_letter || '?'
    return `${semNum}${abbr}${classNum}-${letter}`
  }

  const filteredBatches = useMemo(() => {
    if (!filters.branchId) return batches
    return batches.filter((b) => b.classes?.semesters?.branches?.id === filters.branchId)
  }, [batches, filters.branchId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.class_id || !formData.batch_letter.trim()) return

    setSaving(true)
    setError('')

    try {
      // Generate auto-name: {semester_no}{branch_abbr}{class_no}-{batch_letter}
      let autoName = null
      try {
        const { data: classInfo } = await supabase
          .from('classes')
          .select('class_number, semesters(semester_number, branches(abbreviation))')
          .eq('id', formData.class_id)
          .single()
        
        if (classInfo?.semesters?.branches?.abbreviation) {
          autoName = `${classInfo.semesters.semester_number}${classInfo.semesters.branches.abbreviation}${classInfo.class_number}-${formData.batch_letter.trim().toUpperCase()}`
        }
      } catch (err) {
        console.warn('Auto-name generation failed:', err)
      }

      const { error } = await supabase.from('batches').insert([
        {
          class_id: formData.class_id,
          batch_letter: formData.batch_letter.trim().toUpperCase(),
          name: autoName || `Batch ${formData.batch_letter.trim().toUpperCase()}`,
        },
      ])

      if (error) throw error

      setFormData({ branch_id: '', semester_id: '', class_id: '', batch_letter: '' })
      setSemesters([])
      setClasses([])
      await loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this batch? This will cascade to all students, offerings, and timetables.')) return

    try {
      setError('')
      const { error } = await supabase.from('batches').delete().eq('id', id)
      if (error) throw error
      await loadData()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Batches</h1>
          <p className="text-muted-foreground">
            Manage batches within each class (naming: 2CE1-A, 2CE1-B, etc.)
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Batch</CardTitle>
              <CardDescription>Create a new batch for a class</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="form-branch">Branch *</Label>
                  <Select
                    value={formData.branch_id || 'none'}
                    onValueChange={(val) => {
                      const branchId = val === 'none' ? '' : val
                      setFormData({ ...formData, branch_id: branchId, semester_id: '', class_id: '' })
                      loadSemestersForBranch(branchId)
                    }}
                    disabled={saving}
                  >
                    <SelectTrigger id="form-branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select branch</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.abbreviation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-semester">Semester *</Label>
                  <Select
                    value={formData.semester_id || 'none'}
                    onValueChange={(val) => {
                      const semId = val === 'none' ? '' : val
                      setFormData({ ...formData, semester_id: semId, class_id: '' })
                      loadClassesForSemester(semId)
                    }}
                    disabled={saving || !formData.branch_id}
                  >
                    <SelectTrigger id="form-semester">
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select semester</SelectItem>
                      {semesters.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Semester {s.semester_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-class">Class *</Label>
                  <Select
                    value={formData.class_id || 'none'}
                    onValueChange={(val) => setFormData({ ...formData, class_id: val === 'none' ? '' : val })}
                    disabled={saving || !formData.semester_id}
                  >
                    <SelectTrigger id="form-class">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select class</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          Class {c.class_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batch-letter">Batch Letter *</Label>
                  <Input
                    id="batch-letter"
                    placeholder="A, B, C, D"
                    value={formData.batch_letter}
                    onChange={(e) => setFormData({ ...formData, batch_letter: e.target.value })}
                    disabled={saving}
                    maxLength={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Single letter: used in batch name 2CE1-<strong>A</strong>
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !formData.class_id || !formData.batch_letter.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Batch
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Batches List</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-3 mt-2">
                  <Label htmlFor="filter-branch" className="text-sm">Filter:</Label>
                  <Select
                    value={filters.branchId || 'all'}
                    onValueChange={(val) => setFilters({ ...filters, branchId: val === 'all' ? '' : val })}
                  >
                    <SelectTrigger id="filter-branch" className="h-9 w-[220px]">
                      <SelectValue placeholder="All branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No batches found. Add your first batch to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono font-bold text-lg">
                          {getBatchDisplayName(batch)}
                        </TableCell>
                        <TableCell>
                          {batch.classes?.semesters?.branches?.name || '—'}
                        </TableCell>
                        <TableCell>
                          Semester {batch.classes?.semesters?.semester_number || '—'}
                        </TableCell>
                        <TableCell>
                          Class {batch.classes?.class_number || '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(batch.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
