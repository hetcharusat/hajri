import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { BookOpen, Plus, Trash2, Upload, Download, AlertCircle } from 'lucide-react'

export default function Subjects() {
  const { semesterId } = useScopeStore()

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    credits: 3,
    type: 'LECTURE'
  })
  const [error, setError] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!semesterId) {
      setSubjects([])
      setLoading(false)
      return
    }
    fetchData(semesterId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId])

  const fetchData = async (targetSemesterId) => {
    try {
      setLoading(true)

      const subjectsRes = await supabase
        .from('subjects')
        .select(
          `
          *,
          semesters(
            id,
            semester_number,
            branches(id, name, abbreviation)
          )
        `
        )
        .eq('semester_id', targetSemesterId)
        .order('code', { ascending: true })

      if (subjectsRes.error) throw subjectsRes.error
      setSubjects(subjectsRes.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!semesterId) return
    if (!formData.code.trim() || !formData.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('subjects')
        .insert([{
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          semester_id: semesterId,
          credits: parseInt(formData.credits),
          type: formData.type
        }])

      if (error) throw error

      await fetchData(semesterId)
      setFormData({ code: '', name: '', credits: 3, type: 'LECTURE' })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject? This will remove all related timetable entries.')) return

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id)

      if (error) throw error
      if (semesterId) await fetchData(semesterId)
    } catch (e) {
      setError(e.message)
    }
  }

  const exportToCSV = () => {
    const headers = ['code', 'name', 'branch', 'semester', 'credits', 'type']
    const rows = subjects.map(s => [
      s.code,
      s.name,
      s.semesters?.branches?.abbreviation || '',
      s.semesters?.semester_number || '',
      s.credits,
      s.type
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subjects.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Subjects</h1>
            <p className="text-muted-foreground">Semester-scoped curriculum (shared across classes)</p>
          </div>
          <Button onClick={exportToCSV} variant="outline" disabled={!semesterId || subjects.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

      {!semesterId && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/30 p-6">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Semester scope required</p>
            <p className="text-sm text-muted-foreground">Select a Semester node in the Tree Explorer to manage subjects.</p>
          </div>
        </div>
      )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Error</p>
              <p className="text-sm text-foreground">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Add Subject Form */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Add New Subject</CardTitle>
              <CardDescription>Enter subject details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Subject Code *</Label>
                  <Input
                    id="code"
                    placeholder="CS101"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Subject Name *</Label>
                  <Input
                    id="name"
                    placeholder="Introduction to Programming"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credits">Credits</Label>
                    <Input
                      id="credits"
                      type="number"
                      min="1"
                      max="6"
                      value={formData.credits}
                      onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <select
                      id="type"
                      className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="LECTURE">Lecture</option>
                      <option value="LAB">Lab</option>
                      <option value="TUTORIAL">Tutorial</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={saving || !semesterId}>
                  {saving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Subject
                    </>
                  )}
                </Button>
              </form>


            </CardContent>
          </Card>

          {/* Subjects Table */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                All Subjects ({subjects.length})
              </CardTitle>
              <CardDescription>View and manage all subjects</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading subjects...</p>
                </div>
              ) : !semesterId ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select a Semester node in the Tree Explorer to view subjects.
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No subjects found. Add your first subject above.</p>
                </div>
              ) : (
                <div className="rounded-md border-2 border-border max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Sem</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjects.map((subject) => (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">{subject.code}</TableCell>
                          <TableCell>{subject.name}</TableCell>
                          <TableCell>
                            <span className="text-xs bg-secondary px-2 py-1 rounded font-mono">
                              {subject.semesters?.branches?.abbreviation || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-bold">
                              {subject.semesters?.semester_number || '—'}
                            </span>
                          </TableCell>
                          <TableCell>{subject.credits}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded ${
                              subject.type === 'LAB' ? 'bg-blue-500/20 text-blue-400' :
                              subject.type === 'TUTORIAL' ? 'bg-green-500/20 text-green-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                              {subject.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(subject.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
  )
}
