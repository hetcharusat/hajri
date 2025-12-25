import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useScopeStore } from '../lib/store'
import { Plus, Upload, Download, Search, AlertCircle, Trash2, MapPin } from 'lucide-react'

export default function Rooms() {
  const { departmentId } = useScopeStore()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState(null)
  
  const [formData, setFormData] = useState({
    room_number: '',
    type: 'CLASSROOM',
  })

  useEffect(() => {
    if (departmentId) {
      loadData()
    } else {
      setRooms([])
      setLoading(false)
    }
  }, [departmentId])

  async function loadData() {
    if (!departmentId) {
      setRooms([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('department_id', departmentId)
        .order('room_number', { ascending: true })

      if (fetchError) throw fetchError
      setRooms(data || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!departmentId) {
      setError('Please select a department from the tree to add rooms')
      return
    }

    try {
      setError(null)

      const { error: insertError } = await supabase
        .from('rooms')
        .insert([{
          ...formData,
          department_id: departmentId,
        }])

      if (insertError) throw insertError

      setShowForm(false)
      setFormData({ room_number: '', type: 'CLASSROOM' })
      loadData()
    } catch (err) {
      console.error('Error creating room:', err)
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this room?')) return
    
    try {
      const { error: deleteError } = await supabase
        .from('rooms')
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

    if (!departmentId) {
      setError('Please select a department from the tree to import rooms')
      e.target.value = ''
      return
    }

    try {
      setError(null)
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const roomNumIdx = headers.indexOf('room_number')
      const typeIdx = headers.indexOf('type')

      if (roomNumIdx === -1) {
        throw new Error('CSV must have a room_number column')
      }

      const roomsToInsert = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        
        const roomNumber = values[roomNumIdx]
        const type = values[typeIdx] || 'CLASSROOM'

        if (!roomNumber) continue

        roomsToInsert.push({
          room_number: roomNumber,
          type: type,
          department_id: departmentId,
        })
      }

      if (roomsToInsert.length === 0) {
        throw new Error('No valid rooms found in CSV')
      }

      const { error: insertError } = await supabase
        .from('rooms')
        .insert(roomsToInsert)

      if (insertError) throw insertError

      alert(`Successfully imported ${roomsToInsert.length} rooms!`)
      loadData()
    } catch (err) {
      console.error('Error importing CSV:', err)
      setError(err.message)
    }

    e.target.value = ''
  }

  function handleCSVExport() {
    const headers = ['room_number', 'type']
    const rows = rooms.map(r => [
      r.room_number,
      r.type,
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rooms-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filteredRooms = rooms.filter(r => {
    const matchesSearch = !searchTerm || 
      r.room_number.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = !filterType || r.type === filterType

    return matchesSearch && matchesType
  })

  const typeColors = {
    CLASSROOM: 'bg-secondary text-secondary-foreground',
    LAB: 'bg-secondary text-secondary-foreground',
    HALL: 'bg-secondary text-secondary-foreground',
  }

  if (loading) {
    return <div className="p-6">Loading rooms...</div>
  }

  if (!departmentId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Room Management</h1>
          <p className="text-muted-foreground">Manage classrooms, labs, and halls</p>
        </div>
        <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Select a Department</h2>
          <p className="text-muted-foreground">
            Please select a department from the tree to view and manage rooms.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Room Management</h1>
        <p className="text-muted-foreground">Manage classrooms, labs, and halls for the selected department</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-muted-foreground">Total Rooms</h3>
          </div>
          <p className="text-2xl font-bold">{rooms.length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-muted-foreground">Classrooms</h3>
          </div>
          <p className="text-2xl font-bold">{rooms.filter(r => r.type === 'CLASSROOM').length}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-muted-foreground">Labs</h3>
          </div>
          <p className="text-2xl font-bold">{rooms.filter(r => r.type === 'LAB').length}</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-destructive">
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
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
            <label className="px-4 py-2 bg-secondary text-secondary-foreground rounded font-medium hover:bg-secondary/80 cursor-pointer flex items-center gap-2">
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
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded font-medium hover:bg-secondary/80 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          
          <div className="flex gap-2 items-center">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border-2 border-border bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors w-64"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border border-border mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-foreground">Room Type</label>
            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="w-full border-2 border-border bg-background rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            >
              <option value="">All Types</option>
              <option value="CLASSROOM">Classroom</option>
              <option value="LAB">Lab</option>
              <option value="HALL">Hall</option>
            </select>
          </div>
          {(filterType || searchTerm) && (
            <button
              onClick={() => {
                setFilterType(null)
                setSearchTerm('')
              }}
              className="self-end px-4 py-2 bg-secondary text-secondary-foreground rounded font-medium hover:bg-secondary/80"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/20">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Room Number</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{room.room_number}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${typeColors[room.type]}`}>
                      {room.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRooms.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-muted-foreground">
                    No rooms found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Room</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Room Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  className="w-full border-2 border-border bg-background rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  placeholder="e.g., 101, A-204"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border-2 border-border bg-background rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  required
                >
                  <option value="CLASSROOM">Classroom</option>
                  <option value="LAB">Lab</option>
                  <option value="HALL">Hall</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ room_number: '', type: 'CLASSROOM' })
                  }}
                  className="flex-1 px-4 py-2 border-2 border-border bg-background rounded-md font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
                >
                  Add Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
