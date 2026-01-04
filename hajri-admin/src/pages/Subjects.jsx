import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { BookOpen, Plus, Trash2, Download, AlertCircle, Edit2, Shuffle, X, Search, RefreshCw } from 'lucide-react'

const SUBJECT_TYPES = [
  { value: 'LECTURE', label: 'Lecture', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'LAB', label: 'Lab', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'TUTORIAL', label: 'Tutorial', color: 'bg-emerald-500/20 text-emerald-400' }
]

export default function Subjects() {
  const { semesterId } = useScopeStore()

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  
  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    abbreviation: '',
    credits: 3,
    type: 'LECTURE',
    is_elective: false
  })
  
  // Edit mode
  const [editingSubject, setEditingSubject] = useState(null)
  const [editFormData, setEditFormData] = useState({})

  // Filter subjects based on search
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects
    const q = searchQuery.toLowerCase()
    return subjects.filter(s => 
      s.code?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.abbreviation?.toLowerCase().includes(q)
    )
  }, [subjects, searchQuery])

  // Separate regular and elective subjects
  const regularSubjects = useMemo(() => filteredSubjects.filter(s => !s.is_elective), [filteredSubjects])
  const electiveSubjects = useMemo(() => filteredSubjects.filter(s => s.is_elective), [filteredSubjects])

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
      setError('')

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
        .order('code', { ascending: true })

      if (error) throw error
      setSubjects(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ code: '', name: '', abbreviation: '', credits: 3, type: 'LECTURE', is_elective: false })
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
          name: formData.name.trim().toUpperCase(),
          abbreviation: formData.abbreviation.trim().toUpperCase() || null,
          semester_id: semesterId,
          credits: parseInt(formData.credits) || 3,
          type: formData.type,
          is_elective: formData.is_elective
        }])

      if (error) throw error

      await fetchData(semesterId)
      resetForm()
      setShowAddForm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This will remove all related timetable entries.`)) return

    try {
      setError('')
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
      code: subject.code || '',
      name: subject.name || '',
      abbreviation: subject.abbreviation || '',
      credits: subject.credits || 3,
      type: subject.type || 'LECTURE',
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
          name: editFormData.name.trim().toUpperCase(),
          abbreviation: editFormData.abbreviation?.trim().toUpperCase() || null,
          credits: parseInt(editFormData.credits) || 3,
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
    const headers = ['code', 'name', 'abbreviation', 'credits', 'type', 'is_elective']
    const rows = subjects.map(s => [
      s.code,
      `"${s.name}"`,
      s.abbreviation || '',
      s.credits,
      s.type,
      s.is_elective ? 'Yes' : 'No'
    ])

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subjects_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getTypeStyle = (type) => {
    return SUBJECT_TYPES.find(t => t.value === type)?.color || 'bg-gray-500/20 text-gray-400'
  }

  // No semester selected
  if (!semesterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No Semester Selected</h2>
        <p className="text-muted-foreground max-w-md">
          Select a Semester from the Tree Explorer on the left to manage subjects.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Subjects</h1>
          <p className="text-sm text-muted-foreground">
            {subjects.length} subjects • {regularSubjects.length} regular • {electiveSubjects.length} elective
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchData(semesterId)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV} 
            disabled={subjects.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button 
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Subject
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-destructive">{error}</div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setError('')}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects by code, name, or abbreviation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Subjects Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Regular Subjects */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Regular Subjects
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {regularSubjects.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {regularSubjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No regular subjects found
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                    {regularSubjects.map((subject) => (
                      <SubjectRow
                        key={subject.id}
                        subject={subject}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        getTypeStyle={getTypeStyle}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Elective Subjects */}
            <Card className="border-orange-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shuffle className="h-4 w-4 text-orange-500" />
                  Elective Subjects
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {electiveSubjects.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {electiveSubjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No elective subjects found
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                    {electiveSubjects.map((subject) => (
                      <SubjectRow
                        key={subject.id}
                        subject={subject}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        getTypeStyle={getTypeStyle}
                        isElective
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Add Subject Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
            <DialogDescription>Enter subject details for this semester</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code *</Label>
                <Input
                  placeholder="CEUC101"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Abbreviation (OCR)</Label>
                <Input
                  placeholder="CCP"
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="COMPUTER CONCEPTS AND PROGRAMMING"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Credits</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <EnhancedSelect
                  value={SUBJECT_TYPES.find(t => t.value === formData.type)}
                  onChange={(option) => setFormData({ ...formData, type: option?.value || 'LECTURE' })}
                  options={SUBJECT_TYPES}
                  placeholder="Type"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Elective?</Label>
                <div className="flex items-center h-9 px-3 border rounded-md bg-muted/30">
                  <input
                    type="checkbox"
                    id="add_is_elective"
                    checked={formData.is_elective}
                    onChange={(e) => setFormData({ ...formData, is_elective: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <Label htmlFor="add_is_elective" className="ml-2 text-xs cursor-pointer">
                    Yes
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setShowAddForm(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Adding...' : 'Add Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={!!editingSubject} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update subject details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input
                  value={editFormData.code || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Abbreviation (OCR)</Label>
                <Input
                  value={editFormData.abbreviation || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, abbreviation: e.target.value.toUpperCase() })}
                  className="font-mono"
                  placeholder="Short name for OCR"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Credits</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={editFormData.credits || 3}
                  onChange={(e) => setEditFormData({ ...editFormData, credits: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <EnhancedSelect
                  value={SUBJECT_TYPES.find(t => t.value === editFormData.type)}
                  onChange={(option) => setEditFormData({ ...editFormData, type: option?.value || 'LECTURE' })}
                  options={SUBJECT_TYPES}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Elective?</Label>
                <div className="flex items-center h-9 px-3 border rounded-md bg-muted/30">
                  <input
                    type="checkbox"
                    id="edit_is_elective"
                    checked={editFormData.is_elective || false}
                    onChange={(e) => setEditFormData({ ...editFormData, is_elective: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <Label htmlFor="edit_is_elective" className="ml-2 text-xs cursor-pointer">
                    Yes
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
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

// Individual subject row component
function SubjectRow({ subject, onEdit, onDelete, getTypeStyle, isElective = false }) {
  return (
    <div className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
      {/* Code */}
      <div className="w-24 shrink-0">
        <span className="font-mono text-xs font-medium">
          {isElective && <Shuffle className="inline h-3 w-3 mr-1 text-orange-500" />}
          {subject.code}
        </span>
      </div>
      
      {/* Name + Abbr */}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{subject.name}</div>
        {subject.abbreviation && (
          <span className="inline-block mt-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            {subject.abbreviation}
          </span>
        )}
      </div>
      
      {/* Type Badge */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getTypeStyle(subject.type)}`}>
        {subject.type}
      </span>
      
      {/* Credits */}
      <span className="text-xs text-muted-foreground w-8 text-center shrink-0">
        {subject.credits}cr
      </span>
      
      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(subject)}
          className="h-7 w-7 p-0"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(subject.id, subject.name)}
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
