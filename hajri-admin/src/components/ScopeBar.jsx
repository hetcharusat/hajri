import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useScopeStore } from '@/lib/store'
import { SearchableSelect } from '@/components/SearchableSelect'

export function ScopeBar() {
  const {
    departmentId,
    branchId,
    semesterId,
    classId,
    batchId,
    setDepartmentId,
    setBranchId,
    setSemesterId,
    setClassId,
    setBatchId,
    clear,
  } = useScopeStore()

  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadDepartments = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .order('name', { ascending: true })
        if (error) throw error
        if (!cancelled) setDepartments(data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (supabase) loadDepartments()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBranches = async () => {
      if (!supabase) return
      try {
        setLoading(true)
        let q = supabase
          .from('branches')
          .select('id, name, abbreviation, department_id')
          .order('name', { ascending: true })

        if (departmentId) q = q.eq('department_id', departmentId)

        const { data, error } = await q
        if (error) throw error
        if (!cancelled) setBranches(data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBranches()
    return () => {
      cancelled = true
    }
  }, [departmentId])

  useEffect(() => {
    let cancelled = false

    const loadSemesters = async () => {
      if (!supabase) return
      if (!branchId) {
        setSemesters([])
        return
      }

      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('semesters')
          .select('id, semester_number, branch_id')
          .eq('branch_id', branchId)
          .order('semester_number', { ascending: true })

        if (error) throw error
        if (!cancelled) setSemesters(data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSemesters()
    return () => {
      cancelled = true
    }
  }, [branchId])

  useEffect(() => {
    let cancelled = false

    const loadClasses = async () => {
      if (!supabase) return
      if (!semesterId) {
        setClasses([])
        return
      }

      try {
        setLoading(true)
        
        // Try to query with name column first
        let data = []
        try {
          const result = await supabase
            .from('classes')
            .select('id, class_number, semester_id, name')
            .eq('semester_id', semesterId)
            .order('class_number', { ascending: true })
          
          if (result.error) throw result.error
          data = result.data || []
        } catch (err) {
          // If name column doesn't exist, query without it
          const result = await supabase
            .from('classes')
            .select('id, class_number, semester_id')
            .eq('semester_id', semesterId)
            .order('class_number', { ascending: true })
          
          if (result.error) throw result.error
          data = result.data || []
        }
        
        if (!cancelled) setClasses(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadClasses()
    return () => {
      cancelled = true
    }
  }, [semesterId])

  useEffect(() => {
    let cancelled = false

    const loadBatches = async () => {
      if (!supabase) return
      if (!classId) {
        setBatches([])
        return
      }

      try {
        setLoading(true)
        
        // Try to query with name column first
        let data = []
        try {
          const result = await supabase
            .from('batches')
            .select('id, batch_letter, class_id, name')
            .eq('class_id', classId)
            .order('batch_letter', { ascending: true })
          
          if (result.error) throw result.error
          data = result.data || []
        } catch (err) {
          // If name column doesn't exist, query without it
          const result = await supabase
            .from('batches')
            .select('id, batch_letter, class_id')
            .eq('class_id', classId)
            .order('batch_letter', { ascending: true })
          
          if (result.error) throw result.error
          data = result.data || []
        }
        
        if (!cancelled) setBatches(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBatches()
    return () => {
      cancelled = true
    }
  }, [classId])

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId) || null,
    [departments, departmentId]
  )
  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) || null,
    [branches, branchId]
  )
  const selectedSemester = useMemo(
    () => semesters.find((s) => s.id === semesterId) || null,
    [semesters, semesterId]
  )
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId]
  )
  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === batchId) || null,
    [batches, batchId]
  )

  const breadcrumb = [
    selectedDepartment?.name,
    selectedBranch ? `${selectedBranch.abbreviation || ''}${selectedBranch.abbreviation ? ' - ' : ''}${selectedBranch.name}` : null,
    selectedSemester ? `Semester ${selectedSemester.semester_number}` : null,
    selectedClass ? (selectedClass.name || `Class ${selectedClass.class_number}`) : null,
    selectedBatch ? (selectedBatch.name || `Batch ${selectedBatch.batch_letter}`) : null,
  ].filter(Boolean)

  return (
    <div className="mx-2 mt-4 rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-foreground">Scope</div>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={loading}>
          Clear
        </Button>
      </div>

      {breadcrumb.length > 0 ? (
        <div className="mt-1 text-xs text-muted-foreground truncate">
          {breadcrumb.join('  ›  ')}
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">Pick where you are working</div>
      )}

      <div className="mt-3 space-y-2">
        <SearchableSelect
          label="Department"
          placeholder="Search building..."
          value={departmentId}
          onValueChange={setDepartmentId}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          disabled={loading}
        />

        <SearchableSelect
          label="Branch"
          placeholder={departmentId ? 'Search branch...' : 'Select department (optional)'}
          value={branchId}
          onValueChange={setBranchId}
          options={branches.map((b) => ({ value: b.id, label: b.name, meta: b.abbreviation }))}
          disabled={loading || branches.length === 0}
        />

        <SearchableSelect
          label="Semester"
          placeholder={branchId ? 'Search semester...' : 'Select branch first'}
          value={semesterId}
          onValueChange={setSemesterId}
          options={semesters.map((s) => ({ value: s.id, label: `Semester ${s.semester_number}` }))}
          disabled={loading || !branchId}
        />

        <SearchableSelect
          label="Class"
          placeholder={semesterId ? 'Search class...' : 'Select semester first'}
          value={classId}
          onValueChange={setClassId}
          options={classes.map((c) => ({ value: c.id, label: c.name || `Class ${c.class_number}` }))}
          disabled={loading || !semesterId}
        />

        <SearchableSelect
          label="Batch"
          placeholder={classId ? 'Search batch...' : 'Select class first'}
          value={batchId}
          onValueChange={setBatchId}
          options={batches.map((b) => ({ value: b.id, label: b.name || `Batch ${b.batch_letter}` }))}
          disabled={loading || !classId}
        />
      </div>
    </div>
  )
}
