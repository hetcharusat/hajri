import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'

export default function Branches() {
  const { departmentId: scopeDepartmentId } = useScopeStore()

  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    department_id: '',
  })

  useEffect(() => {
    loadData()
  }, [scopeDepartmentId])

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      department_id: scopeDepartmentId || '',
    }))
  }, [scopeDepartmentId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      let branchesQ = supabase
        .from('branches')
        .select('*, departments(name)')
        .order('name', { ascending: true })

      if (scopeDepartmentId) branchesQ = branchesQ.eq('department_id', scopeDepartmentId)

      const [branchesRes, deptsRes] = await Promise.all([
        branchesQ,
        supabase
          .from('departments')
          .select('*')
          .order('name', { ascending: true }),
      ])

      if (branchesRes.error) throw branchesRes.error
      if (deptsRes.error) throw deptsRes.error

      setBranches(branchesRes.data || [])
      setDepartments(deptsRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const visibleBranches = useMemo(() => branches, [branches])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.abbreviation.trim()) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.from('branches').insert([
        {
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim().toUpperCase(),
          department_id: formData.department_id || null,
        },
      ])

      if (error) throw error

      setFormData({ name: '', abbreviation: '', department_id: '' })
      await loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this branch? This will cascade to all semesters, classes, and batches.')) return

    try {
      setError('')
      const { error } = await supabase.from('branches').delete().eq('id', id)
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Branches</h1>
          <p className="text-muted-foreground">
            Manage academic programs/branches (Computer Engineering, Mechanical, etc.)
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
              <CardTitle>Add Branch</CardTitle>
              <CardDescription>Create a new program/branch</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Branch Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Computer Engineering"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Abbreviation *</Label>
                  <Input
                    id="abbreviation"
                    placeholder="e.g. CE, ME"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    disabled={saving}
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in batch names: 2CE1-A
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department (Building)</Label>
                  <select
                    id="department"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    disabled={saving}
                  >
                    <option value="">None</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Optional: link to a building/location
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !formData.name.trim() || !formData.abbreviation.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Branch
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Branches List</CardTitle>
              <CardDescription>
                  {visibleBranches.length} branch{visibleBranches.length !== 1 ? 'es' : ''} registered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
                ) : visibleBranches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No branches found. Add your first branch to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[100px]">Abbr</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBranches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell className="font-mono font-bold">{branch.abbreviation}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {branch.departments?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(branch.id)}
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
