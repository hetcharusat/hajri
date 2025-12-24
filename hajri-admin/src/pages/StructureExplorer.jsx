import { useState, useEffect, useMemo } from 'react'
import { StructureTree } from '@/components/StructureTree/StructureTree'
import { DetailPanel } from '@/components/DetailPanel/DetailPanel'
import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { EntityForm } from '@/components/EntityForm/EntityForm'
import { SubjectForm } from '@/components/Forms/SubjectForm'
import { FacultyForm } from '@/components/Forms/FacultyForm'
import { RoomForm } from '@/components/Forms/RoomForm'
import { TimetablePanel } from '@/components/Timetable/TimetablePanel'
import { PeriodTemplatesTab } from '@/components/PeriodTemplatesTab'
import OfferingsNew from '@/pages/OfferingsNew'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, BookOpen, Users, GraduationCap, MapPin, Calendar, Grid3x3, Clock, Layers } from 'lucide-react'
import { useStructureStore } from '@/lib/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'

export default function StructureExplorer() {
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formNode, setFormNode] = useState(null)
  const [formType, setFormType] = useState('structure') // 'structure', 'subject', 'faculty', 'room'
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('structure')
  const { selectedNode } = useStructureStore()

  const selectedDepartmentId = useMemo(() => {
    if (!selectedNode) return ''
    if (selectedNode.type === 'department') return selectedNode.id
    if (selectedNode.department_id) return selectedNode.department_id
    if (Array.isArray(selectedNode.parentPath)) {
      const deptNode = [...selectedNode.parentPath].reverse().find((p) => p?.type === 'department')
      return deptNode?.id || ''
    }
    return ''
  }, [selectedNode])

  const selectedSemesterId = useMemo(() => {
    if (!selectedNode) return ''
    if (selectedNode.type === 'semester') return selectedNode.id
    if (selectedNode.semester_id) return selectedNode.semester_id
    if (Array.isArray(selectedNode.parentPath)) {
      const semNode = [...selectedNode.parentPath].reverse().find((p) => p?.type === 'semester')
      return semNode?.id || ''
    }
    return ''
  }, [selectedNode])

  const availableTabs = useMemo(() => {
    const baseTabs = ['structure', 'subjects', 'offerings', 'faculty', 'rooms', 'periods']
    if (selectedNode?.type === 'batch') baseTabs.splice(2, 0, 'timetable')
    return baseTabs
  }, [selectedNode?.type])

  // If the user is on a contextual tab (e.g. timetable) and clicks a different tree node,
  // ensure the active tab remains valid to avoid a blank panel.
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('structure')
    }
  }, [activeTab, availableTabs])

  // Clear old persisted state on mount
  useEffect(() => {
    localStorage.removeItem('hajri-structure-explorer')
  }, [])

  const handleAddRoot = () => {
    setFormNode({ type: 'root' })
    setFormMode('add')
    setFormType('structure')
    setFormOpen(true)
  }

  const handleAddChild = (parentNode) => {
    setFormNode(parentNode)
    setFormMode('add')
    setFormType('structure')
    setFormOpen(true)
  }

  const handleAddSubject = (context) => {
    setFormNode(context)
    setFormMode('add')
    setFormType('subject')
    setFormOpen(true)
  }

  const handleAddFaculty = () => {
    setFormNode(selectedNode || null)
    setFormMode('add')
    setFormType('faculty')
    setFormOpen(true)
  }

  const handleAddRoom = () => {
    setFormNode(selectedNode || null)
    setFormMode('add')
    setFormType('room')
    setFormOpen(true)
  }

  const handleEdit = (node) => {
    setFormNode(node)
    setFormMode('edit')
    
    if (node.type === 'subject') {
      setFormType('subject')
    } else if (node.type === 'faculty') {
      setFormType('faculty')
    } else if (node.type === 'room') {
      setFormType('room')
    } else {
      setFormType('structure')
    }
    
    setFormOpen(true)
  }

  const handleDelete = async (node) => {
    const confirmMsg = getDeleteConfirmMessage(node)
    if (!confirm(confirmMsg)) return

    try {
      let table = `${node.type}s`
      if (node.type === 'class') table = 'classes'
      if (node.type === 'branch') table = 'branches'
      if (node.type === 'faculty') table = 'faculty'
      
      await supabase.from(table).delete().eq('id', node.id).throwOnError()
      
      handleRefresh()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const getDeleteConfirmMessage = (node) => {
    const cascadeWarnings = {
      department: 'This will delete all branches, semesters, classes, batches, and students under this department.',
      branch: 'This will delete all semesters, classes, batches, students, and subjects under this branch.',
      semester: 'This will delete all classes, batches, and students under this semester.',
      class: 'This will delete all batches and students under this class.',
      batch: 'This will delete all students in this batch.',
    }
    
    const warning = cascadeWarnings[node.type] || ''
    return `Are you sure you want to delete this ${node.type}?\n\n${warning}\n\nThis action cannot be undone.`
  }

  const handleFormSuccess = () => {
    handleRefresh()
  }

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  const renderForm = () => {
    switch (formType) {
      case 'subject':
        return (
          <SubjectForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            node={formNode}
            mode={formMode}
            onSuccess={handleFormSuccess}
          />
        )
      case 'faculty':
        return (
          <FacultyForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            node={formNode}
            mode={formMode}
            onSuccess={handleFormSuccess}
          />
        )
      case 'room':
        return (
          <RoomForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            node={formNode}
            mode={formMode}
            onSuccess={handleFormSuccess}
          />
        )
      default:
        return (
          <EntityForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            node={formNode}
            mode={formMode}
            onSuccess={handleFormSuccess}
          />
        )
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-background to-muted/20">
      {/* Left Panel - Tree Navigation */}
      <div className="w-80 border-r-2 border-border flex flex-col shadow-lg">
        <StructureTree key={refreshKey} onAddRoot={handleAddRoot} />
      </div>

      {/* Right Panel - Contextual Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-border px-6 py-3 bg-gradient-to-r from-background to-muted/10">
            <TabsList className="w-full justify-start gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 shadow-inner overflow-x-auto">
              <TabsTrigger value="structure" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Grid3x3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="subjects" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <BookOpen className="h-4 w-4 mr-2" />
                Subjects
              </TabsTrigger>
              <TabsTrigger value="offerings" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Layers className="h-4 w-4 mr-2" />
                Offerings
              </TabsTrigger>
              {selectedNode?.type === 'batch' && (
                <TabsTrigger value="timetable" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Timetable
                </TabsTrigger>
              )}
              <TabsTrigger value="faculty" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <GraduationCap className="h-4 w-4 mr-2" />
                Faculty
              </TabsTrigger>
              <TabsTrigger value="rooms" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <MapPin className="h-4 w-4 mr-2" />
                Rooms
              </TabsTrigger>
              <TabsTrigger value="periods" className="rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Clock className="h-4 w-4 mr-2" />
                Periods
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto bg-gradient-to-br from-background via-transparent to-muted/5">
            <TabsContent value="structure" className="h-full m-0 p-0">
              <DetailPanel
                key={`${selectedNode?.id}-${refreshKey}`}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                onAddSubject={handleAddSubject}
              />
            </TabsContent>

            <TabsContent value="subjects" className="h-full m-0 p-6">
              {selectedNode?.type === 'semester' ? (
                <SubjectsTab
                  semesterId={selectedNode.id}
                  refreshKey={refreshKey}
                  onAdd={() => handleAddSubject(selectedNode)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Semester</h3>
                  <p className="text-muted-foreground max-w-md">
                    Please select a semester from the tree to view and manage its subjects (courses).
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="offerings" className="h-full m-0 p-0">
              <div className="h-full overflow-auto">
                <OfferingsNew embedded={true} />
              </div>
            </TabsContent>

            {selectedNode?.type === 'batch' && (
                <TabsContent value="timetable" className="h-full m-0 p-0">
                  <TimetablePanel
                    batchId={selectedNode.id}
                    refreshKey={refreshKey}
                  />
                </TabsContent>
            )}

            <TabsContent value="faculty" className="h-full m-0 p-6">
              {selectedSemesterId ? (
                <FacultyTab
                  semesterId={selectedSemesterId}
                  refreshKey={refreshKey}
                  onAdd={handleAddFaculty}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <GraduationCap className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Semester</h3>
                  <p className="text-muted-foreground max-w-md">
                    Please select a semester from the tree to view and manage its faculty.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rooms" className="h-full m-0 p-6">
              {selectedDepartmentId ? (
                <RoomsTab
                  departmentId={selectedDepartmentId}
                  refreshKey={refreshKey}
                  onAdd={handleAddRoom}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MapPin className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Department</h3>
                  <p className="text-muted-foreground max-w-md">
                    Please select a department from the tree to view and manage its rooms.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="periods" className="h-full m-0 p-6">
              <PeriodTemplatesTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Overlays */}
      <CommandPalette />
      {renderForm()}

      {/* Context-Aware FAB */}
      {selectedNode && (
        <div className="fixed bottom-8 right-8 flex flex-col gap-2">
          <Button
            className="h-14 w-14 rounded-full shadow-2xl hover:shadow-xl hover:scale-110 transition-all duration-200 bg-gradient-to-br from-primary to-primary/80"
            onClick={() => handleAddChild(selectedNode)}
            title="Add child entity"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Subjects Tab Component
function SubjectsTab({ semesterId, refreshKey, onAdd, onEdit, onDelete }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubjects()
  }, [semesterId, refreshKey])

  const loadSubjects = async () => {
    try {
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .eq('semester_id', semesterId)
        .order('code')
      
      setSubjects(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading subjects...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{subjects.length} Subjects</h3>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Subject
        </Button>
      </div>
      
      {subjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No subjects yet</p>
          <Button onClick={onAdd} className="mt-4">Add First Subject</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <div key={subject.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-sm text-muted-foreground">{subject.code}</div>
                  <h4 className="font-medium">{subject.name}</h4>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit({ ...subject, type: 'subject' })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete({ ...subject, type: 'subject' })}>
                    Delete
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {subject.credits} credits • {subject.type}
                {subject.semesters && ` • Sem ${subject.semesters.semester_number}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Faculty Tab Component
function FacultyTab({ semesterId, refreshKey, onAdd, onEdit, onDelete }) {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [supportsSemesterLink, setSupportsSemesterLink] = useState(null) // null | boolean

  useEffect(() => {
    loadFaculty()
  }, [semesterId, refreshKey])

  const loadFaculty = async () => {
    try {
      let semesterLink = supportsSemesterLink
      if (semesterLink === null) {
        const semProbe = await supabase.from('semester_faculty').select('semester_id, faculty_id').limit(1)
        semesterLink = !semProbe.error
        setSupportsSemesterLink(semesterLink)
      }

      if (!semesterLink) {
        setFaculty([])
        return
      }

      const res = await supabase
        .from('semester_faculty')
        .select('faculty:faculty_id(*)')
        .eq('semester_id', semesterId)

      if (res.error) throw res.error
      const list = (res.data || []).map((r) => r.faculty).filter(Boolean)
      setFaculty(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading faculty...</div>

  if (supportsSemesterLink === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <GraduationCap className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Semester faculty is not enabled</h3>
        <p className="text-muted-foreground max-w-md">
          Create the <span className="font-mono">semester_faculty</span> table (see SUPABASE_SCHEMA_UPDATES.sql) to manage faculty per semester.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{faculty.length} Faculty Members</h3>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Faculty
        </Button>
      </div>
      
      {faculty.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No faculty members yet</p>
          <Button onClick={onAdd} className="mt-4">Add First Faculty</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {faculty.map((member) => (
            <div key={member.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{member.name}</h4>
                  {(member.abbr || member.abbreviation) && (
                    <div className="text-xs text-muted-foreground">{member.abbr || member.abbreviation}</div>
                  )}
                  <div className="text-sm text-muted-foreground">{member.email}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit({ ...member, type: 'faculty' })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete({ ...member, type: 'faculty' })}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Rooms Tab Component
function RoomsTab({ departmentId, refreshKey, onAdd, onEdit, onDelete }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [supportsDepartmentLink, setSupportsDepartmentLink] = useState(null) // null | boolean

  useEffect(() => {
    loadRooms()
  }, [departmentId, refreshKey])

  const loadRooms = async () => {
    try {
      // Detect schema support for rooms.department_id. If it doesn't exist, don't filter.
      let supports = supportsDepartmentLink
      if (supports === null) {
        const probe = await supabase.from('rooms').select('id, department_id').limit(1)
        supports = !probe.error
        setSupportsDepartmentLink(supports)
      }

      let query = supabase
        .from('rooms')
        .select('*')
        .order('room_number')

      if (supports) {
        query = query.eq('department_id', departmentId)
      }

      const { data } = await query
      
      setRooms(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading rooms...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{rooms.length} Rooms</h3>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>
      
      {rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No rooms yet</p>
          <Button onClick={onAdd} className="mt-4">Add First Room</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-lg">{room.room_number}</h4>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit({ ...room, type: 'room' })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete({ ...room, type: 'room' })}>
                    Delete
                  </Button>
                </div>
              </div>
              {room.type && (
                <div className="text-xs px-2 py-1 bg-secondary rounded-full inline-block mt-2">
                  {room.type}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
