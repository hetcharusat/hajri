import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'

export default function Semesters() {
  const [semesters, setSemesters] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [semesterNumber, setSemesterNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [semestersRes, branchesRes] = await Promise.all([
        supabase
          .from('semesters')
          .select(`
            *,
            branches(id, name, abbreviation)
          `)
          .order('semester_number', { ascending: true }),
        supabase.from('branches').select('*').order('name', { ascending: true })
      ])

      if (semestersRes.error) throw semestersRes.error
      if (branchesRes.error) throw branchesRes.error

      setSemesters(semestersRes.data || [])
      setBranches(branchesRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!branchId || !semesterNumber || !startDate || !endDate) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('semesters')
        .insert([{
          branch_id: branchId,
          semester_number: parseInt(semesterNumber),
          start_date: startDate,
          end_date: endDate
        }])

      if (error) throw error

      setBranchId('')
      setSemesterNumber('')
      setStartDate('')
      setEndDate('')
      await fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this semester? This will affect all related classes, batches, subjects, and students.')) return

    try {
      const { error } = await supabase.from('semesters').delete().eq('id', id)
      if (error) throw error
      await fetchData()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Semesters</h1>
          <p className="text-muted-foreground">
            Manage semesters (1-8) for each branch with start/end dates
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Add Semester</CardTitle>
              <CardDescription>Create a semester for a branch</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <select
                    id="branch"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select a branch...</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semester_number">Semester Number</Label>
                  <select
                    id="semester_number"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={semesterNumber}
                    onChange={(e) => setSemesterNumber(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select semester...</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <option key={num} value={num}>
                        Semester {num}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={saving || !branchId || !semesterNumber || !startDate || !endDate}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Semester
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Semesters List</CardTitle>
              <CardDescription>
                {semesters.length} semester{semesters.length !== 1 ? 's' : ''} defined
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : semesters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No semesters found. Add your first semester to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="w-[100px]">Sem #</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semesters.map((sem) => (
                        <TableRow key={sem.id}>
                          <TableCell>
                            <div className="font-medium">{sem.branches?.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {sem.branches?.abbreviation}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-bold text-lg">
                              {sem.semester_number}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {sem.start_date ? new Date(sem.start_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {sem.end_date ? new Date(sem.end_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(sem.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
