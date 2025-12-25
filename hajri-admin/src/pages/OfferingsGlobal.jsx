import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
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
          <p className="text-muted-foreground mt-1">Manage all course offerings across semesters and batches</p>
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
            <Filter className="text-foreground" size={20} />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>

          <div className="grid grid-responsive gap-4">
            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-foreground">Branch</label>
              <EnhancedSelect
                value={selectedBranch ? { value: selectedBranch, label: branches.find(b => b.id === selectedBranch)?.name || 'All Branches' } : null}
                onChange={(option) => setSelectedBranch(option?.value || '')}
                options={branches.map(b => ({ value: b.id, label: `${b.abbreviation} - ${b.name}` }))}
                placeholder="All Branches"
                isClearable
              />
            </div>

            {/* Semester Filter */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-foreground">Semester</label>
              <EnhancedSelect
                value={selectedSemester ? { value: selectedSemester, label: semesters.find(s => s.id === selectedSemester) ? `Semester ${semesters.find(s => s.id === selectedSemester).semester_number} - ${semesters.find(s => s.id === selectedSemester).branches?.abbreviation}` : 'All Semesters' } : null}
                onChange={(option) => setSelectedSemester(option?.value || '')}
                options={semesters.map(s => ({ value: s.id, label: `Semester ${s.semester_number} - ${s.branches?.abbreviation}` }))}
                placeholder="All Semesters"
                isClearable
              />
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
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
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* By Subject View */}
          {viewMode === 'by-subject' && (
            <div className="space-y-3">
              {filteredSubjects.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-2">
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
                        className="p-4 bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition border-2 border-border rounded-lg"
                        onClick={() => toggleExpand(subject.id)}
                      >
                        <div className="flex items-center gap-4">
                          <BookOpen className="text-blue-600" size={20} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{subject.code}</span>
                              <span className={`text-xs px-2 py-1 rounded-full border-2 ${subjectTypeColors[subject.type] || 'bg-muted text-foreground border-border'}`}>
                                {subject.type}
                              </span>
                            </div>
                            <p className="text-sm text-foreground font-medium">{subject.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{subjectOfferings.length} offerings</span>
                          <span className="text-sm text-muted-foreground">
                            Sem {subject.semesters?.semester_number} ({subject.semesters?.branches?.abbreviation})
                          </span>
                        </div>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {subjectOfferings.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
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
                            <EnhancedSelect
                              onChange={(option) => {
                                if (option?.value) {
                                  handleCreateOffering(subject.id, option.value)
                                }
                              }}
                              options={batches.map(batch => ({
                                value: batch.id,
                                label: `Batch ${batch.batch_letter} (Sem ${batch.classes?.semesters?.semester_number})`
                              }))}
                              placeholder="+ Add offering to batch..."
                              isClearable
                            />
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
                <Card className="p-8 text-center text-muted-foreground border-2">
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
                        className="p-4 bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition border-2 border-border rounded-lg"
                        onClick={() => toggleExpand(batch.id)}
                      >
                        <div className="flex items-center gap-4">
                          <Layers className="text-purple-600" size={20} />
                          <div>
                            <span className="font-semibold text-lg">Batch {batch.batch_letter}</span>
                            <p className="text-sm text-foreground font-medium">
                              Semester {batch.classes?.semesters?.semester_number} - {batch.classes?.semesters?.branches?.abbreviation}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{batchOfferings.length} subjects</span>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {batchOfferings.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
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
                <Card className="p-8 text-center text-muted-foreground border-2">
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
                        className="p-4 bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition border-2 border-border rounded-lg"
                        onClick={() => toggleExpand(fac.id)}
                      >
                        <div className="flex items-center gap-4">
                          <GraduationCap className="text-green-600" size={20} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{fac.name}</span>
                              {fac.abbr && (
                                <span className="text-xs px-2 py-1 bg-muted rounded border-2 border-border">
                                  {fac.abbr}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground font-medium">{fac.email}</p>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{facultyOfferings.length} courses</span>
                      </div>

                      {/* Offerings List */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {facultyOfferings.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
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
              <BookOpen size={16} className="text-muted-foreground" />
              <span className="font-medium">{offering.subjects?.code}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border-2 ${subjectTypeColors[offering.subjects?.type] || 'bg-muted text-foreground border-border'}`}>
                {offering.subjects?.type}
              </span>
              <span className="text-sm text-foreground font-medium">{offering.subjects?.name}</span>
            </div>
          )}

          {/* Batch Info */}
          {showBatch && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers size={14} className="text-muted-foreground" />
              <span>Batch {offering.batches?.batch_letter}</span>
              <span className="text-gray-400">•</span>
              <span>Sem {offering.batches?.classes?.semesters?.semester_number}</span>
            </div>
          )}

          {/* Faculty Selection */}
          <div className="flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            {isEditing ? (
              <div className="flex-1">
                <EnhancedSelect
                  value={selectedFacultyId ? { value: selectedFacultyId, label: faculty.find(f => f.id === selectedFacultyId) ? `${faculty.find(f => f.id === selectedFacultyId).name} ${faculty.find(f => f.id === selectedFacultyId).abbr ? `(${faculty.find(f => f.id === selectedFacultyId).abbr})` : ''}` : 'Select Faculty...' } : null}
                  onChange={(option) => setSelectedFacultyId(option?.value || '')}
                  options={faculty.map(f => ({
                    value: f.id,
                    label: `${f.name} ${f.abbr ? `(${f.abbr})` : ''}`
                  }))}
                  placeholder="Select Faculty..."
                  isClearable
                />
              </div>
            ) : (
              <span className="text-sm text-foreground">
                {offering.faculty?.name || (
                  <span className="text-muted-foreground">No faculty assigned</span>
                )}
              </span>
            )}
          </div>

          {/* Room Selection */}
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-muted-foreground" />
            {isEditing ? (
              <div className="flex-1">
                <EnhancedSelect
                  value={selectedRoomId ? { value: selectedRoomId, label: filteredRooms.find(r => r.id === selectedRoomId) ? `${filteredRooms.find(r => r.id === selectedRoomId).room_number} (${filteredRooms.find(r => r.id === selectedRoomId).type})` : 'Select Room...' } : null}
                  onChange={(option) => setSelectedRoomId(option?.value || '')}
                  options={filteredRooms.map(r => ({
                    value: r.id,
                    label: `${r.room_number} (${r.type})`
                  }))}
                  placeholder="Select Room..."
                  isClearable
                />
              </div>
            ) : (
              <span className="text-sm text-foreground">
                {offering.rooms?.room_number || (
                  <span className="text-muted-foreground">No room assigned</span>
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
