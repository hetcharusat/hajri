import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { BookOpen, Plus, Trash2, Download, AlertCircle, Edit2, Shuffle, X } from 'lucide-react'

export default function Subjects() {
  const { semesterId } = useScopeStore()

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    credits: 3,
    type: 'LECTURE',
    is_elective: false
  })
  const [error, setError] = useState('')
  
  // Edit mode
  const [editingSubject, setEditingSubject] = useState(null)
  const [editFormData, setEditFormData] = useState({})

  useEffect(() => {
    if (!semesterId) {
      setSubjects([])
      setLoading(false)
      return
    }
    fetchData(semesterId)
  }, [semesterId])

  const fetchData = async (targetSemesterId) => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('subjects')
        .select(`
          *,
          semesters(
            id,
            semester_number,
            branches(id, name, abbreviation)
          )
        `)
        .eq('semester_id', targetSemesterId)
        .order('is_elective', { ascending: true })
        .order('code', { ascending: true })

      if (error) throw error
      setSubjects(data || [])
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
          type: formData.type,
          is_elective: formData.is_elective
        }])

      if (error) throw error

      await fetchData(semesterId)
      setFormData({ code: '', name: '', credits: 3, type: 'LECTURE', is_elective: false })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject? This will remove all related timetable entries and offerings.')) return

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

  const handleEdit = (subject) => {
    setEditingSubject(subject)
    setEditFormData({
      code: subject.code,
      name: subject.name,
      credits: subject.credits,
      type: subject.type,
      is_elective: subject.is_elective || false
    })
  }

  const handleSaveEdit = async () => {
    if (!editingSubject) return

    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          code: editFormData.code.trim().toUpperCase(),
          name: editFormData.name.trim(),
          credits: parseInt(editFormData.credits),
          type: editFormData.type,
          is_elective: editFormData.is_elective
        })
        .eq('id', editingSubject.id)

      if (error) throw error

      await fetchData(semesterId)
      setEditingSubject(null)
      setEditFormData({})
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingSubject(null)
    setEditFormData({})
  }

  const exportToCSV = () => {
    const headers = ['code', 'name', 'branch', 'semester', 'credits', 'type', 'is_elective']
    const rows = subjects.map(s => [
      s.code,
      s.name,
      s.semesters?.branches?.abbreviation || '',
      s.semesters?.semester_number || '',
      s.credits,
      s.type,
      s.is_elective ? 'Yes' : 'No'
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

  // Separate regular and elective subjects for display
  const regularSubjects = subjects.filter(s => !s.is_elective)
  const electiveSubjects = subjects.filter(s => s.is_elective)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Subjects</h1>
          <p className="text-muted-foreground">Semester-scoped curriculum (regular &amp; elective subjects)</p>
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
          <Button variant="ghost" size="sm" onClick={() => setError('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Add Subject Form */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Add New Subject</CardTitle>
            <CardDescription>Enter subject details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Subject Code *</Label>
                  <Input
                    id="code"
                    placeholder="CS101"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    disabled={!semesterId}
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
                    disabled={!semesterId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="credits">Credits</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="1"
                    max="6"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    disabled={!semesterId}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <EnhancedSelect
                    value={{ value: formData.type, label: formData.type === 'LECTURE' ? 'Lecture' : formData.type === 'LAB' ? 'Lab' : 'Tutorial' }}
                    onChange={(option) => setFormData({ ...formData, type: option?.value || 'LECTURE' })}
                    options={[
                      { value: 'LECTURE', label: 'Lecture' },
                      { value: 'LAB', label: 'Lab' },
                      { value: 'TUTORIAL', label: 'Tutorial' }
                    ]}
                    placeholder="Select type"
                    isDisabled={!semesterId}
                  />
                </div>

                {/* Elective Toggle */}
                <div className="col-span-2 flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border bg-muted/30">
                  <input
                    type="checkbox"
                    id="is_elective"
                    checked={formData.is_elective}
                    onChange={(e) => setFormData({ ...formData, is_elective: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={!semesterId}
                  />
                  <div className="flex-1">
                    <Label htmlFor="is_elective" className="cursor-pointer font-medium">
                      <Shuffle className="inline h-4 w-4 mr-1 text-orange-500" />
                      Elective Subject
                    </Label>
                    <p className="text-xs text-muted-foreground">Can share time slot with other electives</p>
                  </div>
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

        {/* Subjects Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regular Subjects */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                Regular Subjects ({regularSubjects.length})
              </CardTitle>
              <CardDescription>Core curriculum subjects</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading subjects...</p>
                </div>
              ) : !semesterId ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select a Semester to view subjects.
                </div>
              ) : regularSubjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="mx-auto h-10 w-10 opacity-50 mb-3" />
                  <p>No regular subjects yet</p>
                </div>
              ) : (
                <SubjectsTable 
                  subjects={regularSubjects} 
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </CardContent>
          </Card>

          {/* Elective Subjects */}
          <Card className="border-2 border-orange-500/30">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shuffle className="mr-2 h-5 w-5 text-orange-500" />
                Elective Subjects ({electiveSubjects.length})
              </CardTitle>
              <CardDescription>Subjects that can share time slots</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              ) : !semesterId ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select a Semester to view subjects.
                </div>
              ) : electiveSubjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shuffle className="mx-auto h-10 w-10 opacity-50 mb-3" />
                  <p>No elective subjects yet</p>
                  <p className="text-xs mt-1">Mark a subject as elective when adding</p>
                </div>
              ) : (
                <SubjectsTable 
                  subjects={electiveSubjects}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isElective
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Subject Dialog */}
      <Dialog open={!!editingSubject} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update subject details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={editFormData.code || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Credits</Label>
                <Input
                  type="number"
                  min="1"
                  max="6"
                  value={editFormData.credits || 3}
                  onChange={(e) => setEditFormData({ ...editFormData, credits: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Type</Label>
              <EnhancedSelect
                value={{ 
                  value: editFormData.type, 
                  label: editFormData.type === 'LECTURE' ? 'Lecture' : editFormData.type === 'LAB' ? 'Lab' : 'Tutorial' 
                }}
                onChange={(option) => setEditFormData({ ...editFormData, type: option?.value || 'LECTURE' })}
                options={[
                  { value: 'LECTURE', label: 'Lecture' },
                  { value: 'LAB', label: 'Lab' },
                  { value: 'TUTORIAL', label: 'Tutorial' }
                ]}
              />
            </div>

            {/* Elective Toggle in Edit */}
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border bg-muted/30">
              <input
                type="checkbox"
                id="edit_is_elective"
                checked={editFormData.is_elective || false}
                onChange={(e) => setEditFormData({ ...editFormData, is_elective: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <Label htmlFor="edit_is_elective" className="cursor-pointer font-medium">
                  <Shuffle className="inline h-4 w-4 mr-1 text-orange-500" />
                  Elective Subject
                </Label>
                <p className="text-xs text-muted-foreground">Can share time slot with other electives</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Reusable table component
function SubjectsTable({ subjects, onEdit, onDelete, isElective = false }) {
  return (
    <div className="rounded-md border-2 border-border max-h-[400px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Credits</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((subject) => (
            <TableRow key={subject.id}>
              <TableCell className="font-medium font-mono">
                {isElective && <Shuffle className="inline h-3 w-3 mr-1 text-orange-500" />}
                {subject.code}
              </TableCell>
              <TableCell>{subject.name}</TableCell>
              <TableCell>{subject.credits}</TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-1 rounded ${
                  subject.type === 'LAB' ? 'bg-purple-500/20 text-purple-400' :
                  subject.type === 'TUTORIAL' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {subject.type}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(subject)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(subject.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
