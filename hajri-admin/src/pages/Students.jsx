import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Upload, Download, Search, Filter, AlertCircle, Trash2, Users as UsersIcon, GraduationCap, Mail } from 'lucide-react'

export default function AppUsers() {
  const [students, setStudents] = useState([])
  const [departments, setDepartments] = useState([])
  const [semesters, setSemesters] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState(null)
  const [filterSemester, setFilterSemester] = useState(null)
  const [filterBatch, setFilterBatch] = useState(null)
  
  const [formData, setFormData] = useState({
    roll_number: '',
    name: '',
    email: '',
    department_id: '',
    semester_id: '',
    batch_id: '',
    enrollment_year: new Date().getFullYear(),
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const [
        { data: studentsData },
        { data: deptData },
        { data: semData },
        { data: batchData },
      ] = await Promise.all([
        supabase.from('students').select(`
          *,
          departments(code, name),
          semesters(name, year),
          batches(name)
        `),
        supabase.from('departments').select('*'),
        supabase.from('semesters').select('*'),
        supabase.from('batches').select('*, departments(code, name)'),
      ])

      setStudents(studentsData || [])
      setDepartments(deptData || [])
      setSemesters(semData || [])
      setBatches(batchData || [])
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

      const { error: insertError } = await supabase
        .from('students')
        .insert([formData])

      if (insertError) throw insertError

      setShowForm(false)
      setFormData({
        roll_number: '',
        name: '',
        email: '',
        department_id: '',
        semester_id: '',
        batch_id: '',
        enrollment_year: new Date().getFullYear(),
      })
      loadData()
    } catch (err) {
      console.error('Error creating student:', err)
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this student?')) return
    
    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      setError(err.message)
    }
  }

  async function handleCSVImport(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError(null)
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      // Parse CSV headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rollIdx = headers.indexOf('roll_number')
      const nameIdx = headers.indexOf('name')
      const emailIdx = headers.indexOf('email')
      const deptCodeIdx = headers.indexOf('department_code')
      const semesterNameIdx = headers.indexOf('semester_name')
      const batchNameIdx = headers.indexOf('batch_name')
      const yearIdx = headers.indexOf('enrollment_year')

      if (rollIdx === -1 || nameIdx === -1) {
        throw new Error('CSV must have roll_number and name columns')
      }

      const studentsToInsert = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        
        const rollNumber = values[rollIdx]
        const name = values[nameIdx]
        const email = values[emailIdx] || null
        const deptCode = values[deptCodeIdx] || null
        const semesterName = values[semesterNameIdx] || null
        const batchName = values[batchNameIdx] || null
        const year = values[yearIdx] ? parseInt(values[yearIdx]) : new Date().getFullYear()

        if (!rollNumber || !name) continue

        // Find IDs from codes/names
        const dept = deptCode ? departments.find(d => d.code === deptCode) : null
        const sem = semesterName ? semesters.find(s => s.name === semesterName) : null
        const batch = batchName && dept ? batches.find(b => 
          b.name === batchName && b.departments?.code === deptCode
        ) : null

        studentsToInsert.push({
          roll_number: rollNumber,
          name: name,
          email: email,
          department_id: dept?.id || null,
          semester_id: sem?.id || null,
          batch_id: batch?.id || null,
          enrollment_year: year,
        })
      }

      if (studentsToInsert.length === 0) {
        throw new Error('No valid students found in CSV')
      }

      const { error: insertError } = await supabase
        .from('students')
        .insert(studentsToInsert)

      if (insertError) throw insertError

      alert(`Successfully imported ${studentsToInsert.length} students!`)
      loadData()
    } catch (err) {
      console.error('Error importing CSV:', err)
      setError(err.message)
    }

    e.target.value = ''
  }

  function handleCSVExport() {
    const headers = ['roll_number', 'name', 'email', 'department_code', 'semester_name', 'batch_name', 'enrollment_year']
    const rows = students.map(s => [
      s.roll_number,
      s.name,
      s.email || '',
      s.departments?.code || '',
      s.semesters?.name || '',
      s.batches?.name || '',
      s.enrollment_year || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = !searchTerm || 
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDept = !filterDepartment || s.department_id === filterDepartment
    const matchesSem = !filterSemester || s.semester_id === filterSemester
    const matchesBatch = !filterBatch || s.batch_id === filterBatch

    return matchesSearch && matchesDept && matchesSem && matchesBatch
  })

  if (loading) {
    return <div className="p-6">Loading students...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">App Users Management</h1>
        <p className="text-gray-600">Manage application users (students who use the mobile app)</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-muted-foreground">Total App Users</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{students.length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-sm text-muted-foreground">Departments</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{departments.length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-sm text-muted-foreground">With Email</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{students.filter(s => s.email).length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-sm text-muted-foreground">Filtered</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{filteredStudents.length}</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-card p-4 rounded-lg border border-border mb-6">
        <div className="flex gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add App User
            </button>
            <label className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 cursor-pointer flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
            </label>
            <button
              onClick={handleCSVExport}
              className="px-4 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          
          <div className="flex gap-2 items-center">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by roll number, name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border rounded w-80"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border border-border mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              value={filterDepartment || ''}
              onChange={(e) => setFilterDepartment(e.target.value || null)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Semester</label>
            <select
              value={filterSemester || ''}
              onChange={(e) => setFilterSemester(e.target.value || null)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Semesters</option>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.year}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Batch</label>
            <select
              value={filterBatch || ''}
              onChange={(e) => setFilterBatch(e.target.value || null)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.departments?.name}
                </option>
              ))}
            </select>
          </div>
          {(filterDepartment || filterSemester || filterBatch || searchTerm) && (
            <button
              onClick={() => {
                setFilterDepartment(null)
                setFilterSemester(null)
                setFilterBatch(null)
                setSearchTerm('')
              }}
              className="self-end px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Roll Number</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Department</th>
                <th className="px-4 py-3 text-left font-semibold">Semester</th>
                <th className="px-4 py-3 text-left font-semibold">Batch</th>
                <th className="px-4 py-3 text-left font-semibold">Year</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{student.roll_number}</td>
                  <td className="px-4 py-3">{student.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{student.email || '-'}</td>
                  <td className="px-4 py-3">
                    {student.departments ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {student.departments.code}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {student.semesters ? `${student.semesters.name} (${student.semesters.year})` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {student.batches ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                        {student.batches.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{student.enrollment_year || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(student.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Student</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Roll Number *</label>
                  <input
                    type="text"
                    value={formData.roll_number}
                    onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Semester</label>
                  <select
                    value={formData.semester_id}
                    onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select Semester</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Batch</label>
                  <select
                    value={formData.batch_id}
                    onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select Batch</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} - {b.departments?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Enrollment Year</label>
                  <input
                    type="number"
                    value={formData.enrollment_year}
                    onChange={(e) => setFormData({ ...formData, enrollment_year: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    min="2000"
                    max="2100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({
                      roll_number: '',
                      name: '',
                      email: '',
                      department_id: '',
                      semester_id: '',
                      batch_id: '',
                      enrollment_year: new Date().getFullYear(),
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
