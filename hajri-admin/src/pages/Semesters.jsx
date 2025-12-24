import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Semester</CardTitle>
              <CardDescription>Create a semester for a branch</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Select
                    value={branchId || 'none'}
                    onValueChange={(val) => setBranchId(val === 'none' ? '' : val)}
                    disabled={saving}
                  >
                    <SelectTrigger id="branch">
                      <SelectValue placeholder="Select a branch..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a branch...</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} ({branch.abbreviation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semester_number">Semester Number</Label>
                  <Select
                    value={semesterNumber || 'none'}
                    onValueChange={(val) => setSemesterNumber(val === 'none' ? '' : val)}
                    disabled={saving}
                  >
                    <SelectTrigger id="semester_number">
                      <SelectValue placeholder="Select semester..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select semester...</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          Semester {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          <Card>
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
