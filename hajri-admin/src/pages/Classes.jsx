import { useEffect, useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    branchId: '',
  })

  const [formData, setFormData] = useState({
    branch_id: '',
    semester_id: '',
    class_number: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      const [classesRes, branchesRes] = await Promise.all([
        supabase
          .from('classes')
          .select(`
            *,
            semesters(
              id,
              semester_number,
              branches(id, name, abbreviation)
            )
          `)
          .order('class_number', { ascending: true }),
        supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true }),
      ])

      if (classesRes.error) throw classesRes.error
      if (branchesRes.error) throw branchesRes.error

      setClasses(classesRes.data || [])
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

  const filteredClasses = useMemo(() => {
    if (!filters.branchId) return classes
    return classes.filter((c) => c.semesters?.branches?.id === filters.branchId)
  }, [classes, filters.branchId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.semester_id || !formData.class_number) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.from('classes').insert([
        {
          semester_id: formData.semester_id,
          class_number: parseInt(formData.class_number),
        },
      ])

      if (error) throw error

      setFormData({ branch_id: '', semester_id: '', class_number: '' })
      setSemesters([])
      await loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this class? This will cascade to all batches under it.')) return

    try {
      setError('')
      const { error } = await supabase.from('classes').delete().eq('id', id)
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Classes</h1>
          <p className="text-muted-foreground">
            Manage classes within each semester (Class 1, Class 2, etc.)
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
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Add Class</CardTitle>
              <CardDescription>Create a new class for a semester</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="form-branch">Branch *</Label>
                  <select
                    id="form-branch"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.branch_id}
                    onChange={(e) => {
                      const branchId = e.target.value
                      setFormData({ ...formData, branch_id: branchId, semester_id: '' })
                      loadSemestersForBranch(branchId)
                    }}
                    disabled={saving}
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-semester">Semester *</Label>
                  <select
                    id="form-semester"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.semester_id}
                    onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
                    disabled={saving || !formData.branch_id}
                  >
                    <option value="">Select semester</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        Semester {s.semester_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="class-number">Class Number *</Label>
                  <Input
                    id="class-number"
                    type="number"
                    min="1"
                    placeholder="e.g. 1, 2, 3"
                    value={formData.class_number}
                    onChange={(e) => setFormData({ ...formData, class_number: e.target.value })}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in batch name: 2CE<strong>1</strong>-A
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !formData.semester_id || !formData.class_number}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Class
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Classes List</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-3 mt-2">
                  <Label htmlFor="filter-branch" className="text-sm">Filter:</Label>
                  <select
                    id="filter-branch"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={filters.branchId}
                    onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No classes found. Add your first class to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Class Number</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">
                          {cls.semesters?.branches?.name || '—'}
                        </TableCell>
                        <TableCell>
                          Semester {cls.semesters?.semester_number || '—'}
                        </TableCell>
                        <TableCell className="font-mono font-bold">
                          Class {cls.class_number}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cls.id)}
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
