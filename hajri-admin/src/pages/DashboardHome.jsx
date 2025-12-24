import { useMemo } from 'react'
import { useScopeStore } from '@/lib/store'

export default function DashboardHome() {
  const { departmentId, branchId, semesterId, classId, batchId } = useScopeStore()

  const hasAnyScope = useMemo(
    () => Boolean(departmentId || branchId || semesterId || classId || batchId),
    [departmentId, branchId, semesterId, classId, batchId]
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admins don’t explore. Pick a job from the sidebar.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Current Context</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {hasAnyScope ? (
            <div className="space-y-1">
              <div>Department: {departmentId || '—'}</div>
              <div>Branch: {branchId || '—'}</div>
              <div>Semester: {semesterId || '—'}</div>
              <div>Class: {classId || '—'}</div>
              <div>Batch: {batchId || '—'}</div>
            </div>
          ) : (
            <div>No context selected. Use “Change Context”.</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">What to do next</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Structure: set up departments → branches → semesters → classes → batches</li>
          <li>Subjects: define semester curriculum (shared across all classes)</li>
          <li>Faculty: define capabilities (not scheduling)</li>
          <li>Assignments: link subject + faculty (optional class)</li>
          <li>Timetable: schedule per batch with conflict checks</li>
        </ul>
      </div>
    </div>
  )
}
