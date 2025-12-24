import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Plus, Search, AlertCircle, Trash2, Users, 
  Mail, GraduationCap, Edit2, X, Check
} from 'lucide-react'

export default function FacultyImproved() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    email: '',
    abbr: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('faculty')
        .select('id, name, email, abbr')
        .order('name')

      if (fetchError) throw fetchError
      setFaculty(data || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      setError(null)

      const payload = {
        name: formData.name,
        email: formData.email || null,
        abbr: formData.abbr || null,
      }

      if (formData.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('faculty')
          .update(payload)
          .eq('id', formData.id)

        if (updateError) throw updateError
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('faculty')
          .insert([payload])

        if (insertError) throw insertError
      }

      setShowForm(false)
      setFormData({ id: null, name: '', email: '', abbr: '' })
      loadData()
    } catch (err) {
      console.error('Error saving faculty:', err)
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this faculty member? This will also remove their course assignments in the Assignments tab.')) return
    
    try {
      const { error: deleteError } = await supabase
        .from('faculty')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      setError(err.message)
    }
  }

  function handleEdit(fac) {
    setFormData({
      id: fac.id,
      name: fac.name,
      email: fac.email || '',
      abbr: fac.abbr || '',
    })
    setShowForm(true)
  }

  function handleAddNew() {
    setFormData({ id: null, name: '', email: '', abbr: '' })
    setShowForm(true)
  }

  // Filter faculty by search term
  const filteredFaculty = faculty.filter(f => {
    const matchesSearch = !searchTerm || 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.abbr?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="text-blue-600" size={32} />
            Faculty Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage faculty members. Assign them to courses in the Assignments tab.</p>
        </div>
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2" size={18} />
          Add Faculty
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search by name, email, or abbreviation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Faculty List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredFaculty.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          <Users className="mx-auto mb-4 text-gray-400" size={48} />
          <p>{searchTerm ? 'No faculty members found matching your search' : 'No faculty members yet'}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFaculty.map(fac => (
            <Card key={fac.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                {/* Avatar and Name */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {fac.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{fac.name}</h3>
                    {fac.abbr && (
                      <div className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium">
                        {fac.abbr}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                {fac.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail size={14} className="flex-shrink-0" />
                    <span className="truncate">{fac.email}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(fac)}
                    className="flex-1"
                  >
                    <Edit2 size={14} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(fac.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/70 via-blue-900/70 to-indigo-900/70 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto border-2 border-primary shadow-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <form onSubmit={handleSubmit}>
              {/* Form Header */}
              <div className="p-6 border-b-2 border-primary/30 bg-gradient-to-r from-primary via-blue-600 to-indigo-600">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-3 text-white drop-shadow-lg">
                    <GraduationCap className="text-white" size={28} />
                    {formData.id ? 'Edit Faculty' : 'Add New Faculty'}
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(false)}
                    className="bg-white/20 border-white/50 text-white hover:bg-white/30 hover:text-white"
                  >
                    <X size={18} />
                  </Button>
                </div>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-primary to-blue-600 rounded-full"></span>
                    <Users size={16} className="text-primary" />
                    Full Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Dr. John Smith"
                    required
                    className="text-base"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-primary to-blue-600 rounded-full"></span>
                    <Mail size={16} className="text-primary" />
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., john.smith@university.edu"
                    className="text-base"
                  />
                </div>

                {/* Abbreviation */}
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-primary to-blue-600 rounded-full"></span>
                    Abbreviation / Short Code
                  </label>
                  <Input
                    type="text"
                    value={formData.abbr}
                    onChange={(e) => setFormData({ ...formData, abbr: e.target.value })}
                    placeholder="e.g., JS, JMS"
                    maxLength={10}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Used in timetables and reports for quick identification
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-l-4 border-amber-500 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    <strong className="text-amber-900 dark:text-amber-100">💡 Note:</strong> After creating a faculty member, assign them to courses 
                    in the <strong className="text-primary">Assignments</strong> tab.
                  </p>
                </div>
              </div>

              {/* Form Footer */}
              <div className="p-6 border-t-2 border-primary/20 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="border-2 border-slate-300 hover:border-primary hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg hover:shadow-xl transition-all">
                  <Check className="mr-2" size={18} />
                  {formData.id ? 'Update Faculty' : 'Create Faculty'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
