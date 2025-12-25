import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { AlertCircle, BookOpen, Check, Filter, GraduationCap, Layers, MapPin, Plus, Search, Trash2, User, X } from 'lucide-react'

export default function OfferingsGlobal() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Filters
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  
  // Data
  const [subjects, setSubjects] = useState([])
  const [faculty, setFaculty] = useState([])
  const [rooms, setRooms] = useState([])
  const [offerings, setOfferings] = useState([])
  const [batches, setBatches] = useState([])
  
  // View mode
  const [viewMode, setViewMode] = useState('by-subject') // 'by-subject' | 'by-batch' | 'by-faculty'
  const [expandedItems, setExpandedItems] = useState(new Set())

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    if (branches.length > 0 && semesters.length > 0) {
      loadFilteredData()
    }
  }, [selectedBranch, selectedSemester])

  async function loadAllData() {
    try {
      setLoading(true)
      setError('')

      const [branchesRes, semestersRes, facultyRes, roomsRes] = await Promise.all([
        supabase.from('branches').select('id, name, abbreviation').order('name'),
        supabase.from('semesters').select('id, semester_number, branches(name, abbreviation)').order('semester_number'),
        supabase.from('faculty').select('id, name, email, abbr').order('name'),
        supabase.from('rooms').select('id, room_number, type, department_id').order('room_number'),
      ])

      if (branchesRes.error) throw branchesRes.error
      if (semestersRes.error) throw semestersRes.error
      if (facultyRes.error) throw facultyRes.error
      if (roomsRes.error) throw roomsRes.error

      setBranches(branchesRes.data || [])
      setSemesters(semestersRes.data || [])
      setFaculty(facultyRes.data || [])
      setRooms(roomsRes.data || [])

      // Load all data initially
      await loadFilteredData()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadFilteredData() {
    try {
      setLoading(true)

      // Build queries with filters
      let subjectsQuery = supabase
        .from('subjects')
        .select('id, code, name, type, credits, semester_id, semesters(semester_number, branches(id, name, abbreviation))')
        .order('code')

      let batchesQuery = supabase
        .from('batches')
        .select('id, batch_letter, class_id, classes(id, semester_id, semesters(semester_number, branches(id, name, abbreviation)))')
        .order('batch_letter')

      // Apply semester filter
      if (selectedSemester) {
        subjectsQuery = subjectsQuery.eq('semester_id', selectedSemester)
        batchesQuery = batchesQuery.eq('classes.semester_id', selectedSemester)
      }

      const [subjectsRes, batchesRes] = await Promise.all([
        subjectsQuery,
        batchesQuery
      ])

      if (subjectsRes.error) throw subjectsRes.error
      if (batchesRes.error) throw batchesRes.error

      let filteredSubjects = subjectsRes.data || []
      let filteredBatches = batchesRes.data || []

      // Apply branch filter
      if (selectedBranch) {
        filteredSubjects = filteredSubjects.filter(s => s.semesters?.branches?.id === selectedBranch)
        filteredBatches = filteredBatches.filter(b => b.classes?.semesters?.branches?.id === selectedBranch)
      }

      setSubjects(filteredSubjects)
      setBatches(filteredBatches)

      // Load all offerings
      const { data: offeringsData, error: offeringsError } = await supabase
        .from('course_offerings')
        .select(`
          id, 
          subject_id, 
          faculty_id, 
          default_room_id, 
          batch_id,
          subjects(code, name, type, semester_id),
          faculty(name, abbr),
          rooms(room_number),
          batches(batch_letter, classes(semester_id, semesters(semester_number, branches(id, abbreviation, department_id))))
        `)

      if (offeringsError) throw offeringsError
      setOfferings(offeringsData || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOffering(subjectId, batchId) {
    try {
      setError('')
      const { error: insertError } = await supabase
        .from('course_offerings')
        .insert({
          subject_id: subjectId,
          batch_id: batchId,
          faculty_id: null,
          default_room_id: null
        })

      if (insertError) throw insertError
      await loadFilteredData()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleUpdateOffering(offeringId, updates) {
    try {
      setError('')
      const { error: updateError } = await supabase
        .from('course_offerings')
        .update(updates)
        .eq('id', offeringId)

      if (updateError) throw updateError
      await loadFilteredData()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeleteOffering(offeringId) {
    try {
      setError('')
      const { error: deleteError } = await supabase
        .from('course_offerings')
        .delete()
        .eq('id', offeringId)

      if (deleteError) throw deleteError
      await loadFilteredData()
    } catch (e) {
      setError(e.message)
    }
  }

  function toggleExpand(itemId) {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  // Filter by search term
  const filteredSubjects = subjects.filter(s => 
    !searchTerm || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getOfferingsForSubject = (subjectId) => {
    return offerings.filter(o => o.subject_id === subjectId)
  }

  const getOfferingsForBatch = (batchId) => {
    return offerings.filter(o => o.batch_id === batchId)
  }

  const getOfferingsForFaculty = (facultyId) => {
    return offerings.filter(o => o.faculty_id === facultyId)
  }

  const subjectTypeColors = {
    'LECTURE': 'bg-blue-100 text-blue-800 border-blue-300',
    'LAB': 'bg-purple-100 text-purple-800 border-purple-300',
    'TUTORIAL': 'bg-green-100 text-green-800 border-green-300',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Course Offerings - Global View</h1>
          <p className="text-gray-600 mt-1">Manage all course offerings across semesters and batches</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="text-gray-500" size={20} />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.abbreviation} - {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Semesters</option>
                {semesters.map(sem => (
                  <option key={sem.id} value={sem.id}>
                    Semester {sem.semester_number} - {sem.branches?.abbreviation}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm font-medium">View by:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'by-subject' ? 'default' : 'outline'}
                onClick={() => setViewMode('by-subject')}
              >
                <BookOpen size={16} className="mr-2" />
                Subjects
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'by-batch' ? 'default' : 'outline'}
                onClick={() => setViewMode('by-batch')}
              >
                <Layers size={16} className="mr-2" />
                Batches
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'by-faculty' ? 'default' : 'outline'}
                onClick={() => setViewMode('by-faculty')}
              >
                <User size={16} className="mr-2" />
                Faculty
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Area */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* By Subject View */}
          {viewMode === 'by-subject' && (
            <div className="space-y-3">
              {filteredSubjects.length === 0 ? (
                <Card className="p-8 text-center text-gray-500">
                  No subjects found matching your filters
                </Card>
              ) : (
                filteredSubjects.map(subject => {
                  const subjectOfferings = getOfferingsForSubject(subject.id)
                  const isExpanded = expandedItems.has(subject.id)

                  return (
                    <Card key={subject.id} className="overflow-hidden">
                      {/* Subject Header */}
                      <div
                        className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => toggleExpand(subject.id)}
                      >
                        <div className="flex items-center gap-4">
                          <BookOpen className="text-blue-600" size={20} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{subject.code}</span>
                              <span className={`text-xs px-2 py-1 rounded-full border ${subjectTypeColors[subject.type] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                {subject.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{subject.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{subjectOfferings.length} offerings</span>
                          <span className="text-sm text-gray-500">
                            Sem {subject.semesters?.semester_number} ({subject.semesters?.branches?.abbreviation})
                          </span>
                        </div>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {subjectOfferings.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No offerings yet for this subject
                            </div>
                          ) : (
                            subjectOfferings.map(offering => (
                              <OfferingRow
                                key={offering.id}
                                offering={offering}
                                faculty={faculty}
                                rooms={rooms}
                                onUpdate={handleUpdateOffering}
                                onDelete={handleDeleteOffering}
                              />
                            ))
                          )}

                          {/* Add Offering Button */}
                          <div className="pt-2 border-t">
                            <select
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleCreateOffering(subject.id, e.target.value)
                                  e.target.value = ''
                                }
                              }}
                            >
                              <option value="">+ Add offering to batch...</option>
                              {batches.map(batch => (
                                <option key={batch.id} value={batch.id}>
                                  Batch {batch.batch_letter} (Sem {batch.classes?.semesters?.semester_number})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* By Batch View */}
          {viewMode === 'by-batch' && (
            <div className="space-y-3">
              {batches.length === 0 ? (
                <Card className="p-8 text-center text-gray-500">
                  No batches found matching your filters
                </Card>
              ) : (
                batches.map(batch => {
                  const batchOfferings = getOfferingsForBatch(batch.id)
                  const isExpanded = expandedItems.has(batch.id)

                  return (
                    <Card key={batch.id} className="overflow-hidden">
                      {/* Batch Header */}
                      <div
                        className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => toggleExpand(batch.id)}
                      >
                        <div className="flex items-center gap-4">
                          <Layers className="text-purple-600" size={20} />
                          <div>
                            <span className="font-semibold text-lg">Batch {batch.batch_letter}</span>
                            <p className="text-sm text-gray-600">
                              Semester {batch.classes?.semesters?.semester_number} - {batch.classes?.semesters?.branches?.abbreviation}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{batchOfferings.length} subjects</span>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {batchOfferings.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No subjects assigned to this batch yet
                            </div>
                          ) : (
                            batchOfferings.map(offering => (
                              <OfferingRow
                                key={offering.id}
                                offering={offering}
                                faculty={faculty}
                                rooms={rooms}
                                onUpdate={handleUpdateOffering}
                                onDelete={handleDeleteOffering}
                                showSubject
                              />
                            ))
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* By Faculty View */}
          {viewMode === 'by-faculty' && (
            <div className="space-y-3">
              {faculty.length === 0 ? (
                <Card className="p-8 text-center text-gray-500">
                  No faculty members found
                </Card>
              ) : (
                faculty.map(fac => {
                  const facultyOfferings = getOfferingsForFaculty(fac.id)
                  const isExpanded = expandedItems.has(fac.id)

                  return (
                    <Card key={fac.id} className="overflow-hidden">
                      {/* Faculty Header */}
                      <div
                        className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => toggleExpand(fac.id)}
                      >
                        <div className="flex items-center gap-4">
                          <GraduationCap className="text-green-600" size={20} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{fac.name}</span>
                              {fac.abbr && (
                                <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                                  {fac.abbr}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{fac.email}</p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{facultyOfferings.length} courses</span>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {facultyOfferings.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No courses assigned to this faculty yet
                            </div>
                          ) : (
                            facultyOfferings.map(offering => (
                              <OfferingRow
                                key={offering.id}
                                offering={offering}
                                faculty={faculty}
                                rooms={rooms}
                                onUpdate={handleUpdateOffering}
                                onDelete={handleDeleteOffering}
                                showSubject
                                showBatch
                              />
                            ))
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Offering Row Component
function OfferingRow({ offering, faculty, rooms, onUpdate, onDelete, showSubject, showBatch }) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedFacultyId, setSelectedFacultyId] = useState(offering.faculty_id || '')
  const [selectedRoomId, setSelectedRoomId] = useState(offering.default_room_id || '')

  // Filter rooms by batch's department
  const batchDepartmentId = offering.batches?.classes?.semesters?.branches?.department_id
  const filteredRooms = batchDepartmentId 
    ? rooms.filter(r => r.department_id === batchDepartmentId)
    : []

  const subjectTypeColors = {
    'LECTURE': 'bg-blue-100 text-blue-800 border-blue-300',
    'LAB': 'bg-purple-100 text-purple-800 border-purple-300',
    'TUTORIAL': 'bg-green-100 text-green-800 border-green-300',
  }

  function handleSave() {
    onUpdate(offering.id, {
      faculty_id: selectedFacultyId || null,
      default_room_id: selectedRoomId || null,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    setSelectedFacultyId(offering.faculty_id || '')
    setSelectedRoomId(offering.default_room_id || '')
    setIsEditing(false)
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Subject Info */}
          {showSubject && (
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-gray-400" />
              <span className="font-medium">{offering.subjects?.code}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${subjectTypeColors[offering.subjects?.type] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                {offering.subjects?.type}
              </span>
              <span className="text-sm text-gray-600">{offering.subjects?.name}</span>
            </div>
          )}

          {/* Batch Info */}
          {showBatch && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Layers size={14} className="text-gray-400" />
              <span>Batch {offering.batches?.batch_letter}</span>
              <span className="text-gray-400">•</span>
              <span>Sem {offering.batches?.classes?.semesters?.semester_number}</span>
            </div>
          )}

          {/* Faculty Selection */}
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            {isEditing ? (
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="flex-1 px-3 py-2 border-2 border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                <option value="">Select Faculty...</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.abbr && `(${f.abbr})`}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">
                {offering.faculty?.name || (
                  <span className="text-gray-400">No faculty assigned</span>
                )}
              </span>
            )}
          </div>

          {/* Room Selection */}
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-400" />
            {isEditing ? (
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="flex-1 px-3 py-2 border-2 border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                <option value="">Select Room...</option>
                {filteredRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.type})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">
                {offering.rooms?.room_number || (
                  <span className="text-gray-400">No room assigned</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Check size={16} />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(offering.id)} className="text-red-600 hover:text-red-700">
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
