import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useScopeStore, useStructureStore } from '@/lib/store'
import { AlertCircle, BookOpen, Check, GraduationCap, MapPin, Plus, Trash2, User, X, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Navigate } from 'react-router-dom'

export default function OfferingsNew({ embedded = false }) {
  const { selectedNode } = useStructureStore()
  const { batchId } = useScopeStore()
  const [error, setError] = useState('')

  // Fetch batch and semester
  const { data: batchData } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, class_id, classes(semester_id)')
        .eq('id', batchId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!batchId,
  })

  const semesterId = batchData?.classes?.semester_id

  // Fetch semester subjects
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects', semesterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, code, name, type, credits')
        .eq('semester_id', semesterId)
        .order('code')
      if (error) throw error
      return data || []
    },
    enabled: !!semesterId,
  })

  // Fetch faculty (global)
  const { data: faculty = [] } = useQuery({
    queryKey: ['faculty'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faculty')
        .select('id, name, email, abbr')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // Fetch rooms (global)
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_number, type, capacity')
        .order('room_number')
      if (error) throw error
      return data || []
    },
  })

  // Fetch offerings for batch
  const { data: offerings = [], isLoading: loadingOfferings } = useQuery({
    queryKey: ['offerings', batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_offerings')
        .select('id, subject_id, faculty_id, default_room_id, faculty(name), subjects(code, name, type)')
        .eq('batch_id', batchId)
      if (error) throw error
      return data || []
    },
    enabled: !!batchId,
  })

  const queryClient = useQueryClient()

  // Save/Update offering mutation
  const saveMutation = useMutation({
    mutationFn: async ({ subjectId, facultyId, roomId }) => {
      const { data, error } = await supabase
        .from('course_offerings')
        .upsert([{
          batch_id: batchId,
          subject_id: subjectId,
          faculty_id: facultyId || null,
          default_room_id: roomId || null,
        }], { onConflict: 'batch_id,subject_id' })
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings', batchId] })
      setError('')
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  // Delete offering mutation
  const deleteMutation = useMutation({
    mutationFn: async (offeringId) => {
      const { error } = await supabase
        .from('course_offerings')
        .delete()
        .eq('id', offeringId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings', batchId] })
      setError('')
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  // Auto-assign all unassigned subjects
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const unassignedSubjects = subjects.filter(s => !offerings.find(o => o.subject_id === s.id))
      
      const promises = unassignedSubjects.map(subject => 
        supabase
          .from('course_offerings')
          .upsert([{
            batch_id: batchId,
            subject_id: subject.id,
            faculty_id: null,
            default_room_id: null,
          }], { onConflict: 'batch_id,subject_id' })
      )

      await Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerings', batchId] })
      setError('')
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleSave = (subjectId, facultyId, roomId) => {
    saveMutation.mutate({ subjectId, facultyId, roomId })
  }

  const handleDelete = (offeringId) => {
    if (!confirm('Remove this offering? This will also remove any scheduled timetable entries.')) return
    deleteMutation.mutate(offeringId)
  }

  const handleAutoAssign = () => {
    if (!confirm('Create offerings for all unassigned subjects?')) return
    autoAssignMutation.mutate()
  }

  const getOfferingForSubject = (subjectId) => {
    return offerings.find(o => o.subject_id === subjectId)
  }

  const loading = loadingSubjects || loadingOfferings
  const assignedCount = offerings.length
  const totalCount = subjects.length
  const unassignedCount = totalCount - assignedCount
  const completeCount = offerings.filter(o => o.faculty_id).length

  // Redirect if no valid selection (AFTER all hooks)
  if (!selectedNode || !batchId) {
    return embedded ? (
      <div className="space-y-6 p-6">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Batch scope required</p>
            <p className="text-sm text-muted-foreground">Select a Batch node in the Tree Explorer to manage assignments.</p>
          </div>
        </div>
      </div>
    ) : (
      <Navigate to="/app/overview" replace />
    )
  }

  const contentInner = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Assignments</h1>
          <p className="text-muted-foreground">Assign faculty and default rooms to courses in this batch</p>
        </div>

        <div className="flex items-center gap-2">
          {unassignedCount > 0 && (
            <Button 
              onClick={handleAutoAssign}
              disabled={autoAssignMutation.isPending}
              variant="outline"
            >
              {autoAssignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Create {unassignedCount} Missing
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total Subjects
            </CardDescription>
            <CardTitle className="text-3xl">{totalCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              With Faculty
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{completeCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Unassigned
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{unassignedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading assignments...</p>
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No subjects found</p>
            <p className="text-sm text-muted-foreground">Add subjects to the semester first</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const offering = getOfferingForSubject(subject.id)
            return (
              <SubjectOfferingCard
                key={subject.id}
                subject={subject}
                offering={offering}
                faculty={faculty}
                rooms={rooms}
                onSave={handleSave}
                onDelete={handleDelete}
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            )
          })}
        </div>
      )}
    </>
  )

  const content = <div className="space-y-6">{contentInner}</div>

  return embedded ? <div className="space-y-6 p-6">{contentInner}</div> : content
}

function SubjectOfferingCard({ subject, offering, faculty, rooms, onSave, onDelete, isSaving, isDeleting }) {
  const [editing, setEditing] = useState(!offering)
  const [selectedFacultyId, setSelectedFacultyId] = useState(offering?.faculty_id || '')
  const [selectedRoomId, setSelectedRoomId] = useState(offering?.default_room_id || '')

  const handleSave = () => {
    onSave(subject.id, selectedFacultyId, selectedRoomId)
    setEditing(false)
  }

  const handleCancel = () => {
    setSelectedFacultyId(offering?.faculty_id || '')
    setSelectedRoomId(offering?.default_room_id || '')
    setEditing(false)
  }

  const typeColors = {
    THEORY: 'bg-blue-500',
    LAB: 'bg-purple-500',
    TUTORIAL: 'bg-green-500',
  }

  const hasChanges = selectedFacultyId !== (offering?.faculty_id || '') || selectedRoomId !== (offering?.default_room_id || '')
  const isComplete = offering && offering.faculty_id

  return (
    <Card className={cn(
      "transition-all duration-200",
      editing && "ring-2 ring-primary/20",
      isComplete && !editing && "border-green-500/30 bg-green-50/30 dark:bg-green-950/10"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          {/* Subject Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-bold">{subject.code}</span>
                <Badge variant="secondary" className={cn(
                  "font-bold text-white",
                  typeColors[subject.type] || 'bg-gray-500'
                )}>
                  {subject.type}
                </Badge>
                <span className="text-xs text-muted-foreground">({subject.credits} credits)</span>
                {isComplete && !editing && (
                  <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Assigned
                  </Badge>
                )}
                {!offering && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1">
                    <Info className="h-3 w-3" />
                    Not Created
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-base font-medium text-muted-foreground">{subject.name}</div>
          </div>

          {/* Quick Actions */}
          {!editing && offering && (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setEditing(true)}
                disabled={isSaving || isDeleting}
              >
                Edit
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onDelete(offering.id)}
                disabled={isSaving || isDeleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {editing ? (
          <div className="space-y-4">
            {/* Faculty Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Assign Faculty *
              </label>
              <Select value={selectedFacultyId || 'none'} onValueChange={(val) => setSelectedFacultyId(val === 'none' ? '' : val)}>
                <SelectTrigger className={cn(
                  "h-11 border-2",
                  !selectedFacultyId && "border-amber-500/50"
                )}>
                  <SelectValue placeholder="Select a faculty member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No faculty assigned --</SelectItem>
                  {faculty.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2">
                        <span>{f.name}</span>
                        {f.abbr && <span className="text-xs text-muted-foreground">({f.abbr})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Default Room (Optional)
              </label>
              <Select value={selectedRoomId || 'none'} onValueChange={(val) => setSelectedRoomId(val === 'none' ? '' : val)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="No default room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No default room --</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span>Room {r.room_number}</span>
                        {r.type && <span className="text-xs text-muted-foreground">({r.type})</span>}
                        {r.capacity && <span className="text-xs text-muted-foreground">• Cap: {r.capacity}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !hasChanges}
                className="flex-1"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isSaving && <Check className="mr-2 h-4 w-4" />}
                {offering ? 'Update Assignment' : 'Create Assignment'}
              </Button>
              {offering && (
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              )}
            </div>

            {!selectedFacultyId && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Faculty assignment is recommended before scheduling
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display Mode */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <GraduationCap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Faculty</div>
                  <div className="text-sm font-medium truncate">
                    {offering?.faculty?.name || (
                      <span className="text-muted-foreground italic">Not assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Default Room</div>
                  <div className="text-sm font-medium truncate">
                    {offering?.default_room_id ? (
                      <>Room {rooms.find(r => r.id === offering.default_room_id)?.room_number || '—'}</>
                    ) : (
                      <span className="text-muted-foreground italic">Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!offering && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3">
                <Info className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Create an offering to schedule this subject in the timetable</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
