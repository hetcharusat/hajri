import { useState, useEffect } from 'react'
import { 
  Search,
  Building2,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Users
} from 'lucide-react'
import { api, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge, TypeBadge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Select } from '../components/ui/select'
import { PageHeader } from '../components/shared/PageHeader'
import { SearchBox } from '../components/shared/Filters'
import { LoadingScreen, LoadingSpinner, EmptyState } from '../components/shared/Loading'

export function Batches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ department: '', branch: '', semester: '' })
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batchDetails, setBatchDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    api('/test/all-batches').then(data => {
      if (data.batches) setBatches(data.batches)
      setLoading(false)
    })
  }, [])

  const departments = [...new Set(batches.map(b => b.department).filter(Boolean))].sort()
  const branches = [...new Set(
    batches.filter(b => !filters.department || b.department === filters.department).map(b => b.branch).filter(Boolean)
  )].sort()
  const semesters = [...new Set(
    batches.filter(b => 
      (!filters.department || b.department === filters.department) &&
      (!filters.branch || b.branch === filters.branch)
    ).map(b => b.semester).filter(Boolean)
  )].sort((a, b) => a - b)

  const filteredBatches = batches.filter(b => {
    if (filters.department && b.department !== filters.department) return false
    if (filters.branch && b.branch !== filters.branch) return false
    if (filters.semester && b.semester !== filters.semester) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        b.label?.toLowerCase().includes(searchLower) ||
        b.department?.toLowerCase().includes(searchLower) ||
        b.branch?.toLowerCase().includes(searchLower) ||
        b.class_display?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const loadDetails = async (batch) => {
    setSelectedBatch(batch)
    setBatchDetails(null)
    setDetailsLoading(true)
    const details = await api(`/test/batch/${batch.id}`)
    setBatchDetails(details)
    setDetailsLoading(false)
  }

  if (loading) return <LoadingScreen message="Loading batches..." />

  return (
    <div className="page-container">
      <PageHeader 
        title="Batches Explorer" 
        subtitle={`${batches.length} batches registered in the system`}
      />

      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        {/* Left Panel - List */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Search */}
              <SearchBox 
                value={search} 
                onChange={setSearch} 
                placeholder="Search batches..."
              />

              {/* Compact Filters */}
              <div className="grid grid-cols-3 gap-2">
                <Select 
                  value={filters.department} 
                  onChange={e => setFilters({ ...filters, department: e.target.value, branch: '', semester: '' })}
                  className="text-xs"
                >
                  <option value="">All Depts</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select 
                  value={filters.branch} 
                  onChange={e => setFilters({ ...filters, branch: e.target.value, semester: '' })}
                  disabled={!filters.department}
                  className="text-xs"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
                <Select 
                  value={filters.semester} 
                  onChange={e => setFilters({ ...filters, semester: Number(e.target.value) || '' })}
                  disabled={!filters.branch}
                  className="text-xs"
                >
                  <option value="">All Sems</option>
                  {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
                </Select>
              </div>

              {/* Results Count */}
              <div className="text-xs text-muted-foreground">
                Showing {filteredBatches.length} of {batches.length} batches
              </div>
            </CardContent>
          </Card>

          {/* Batch List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredBatches.map(b => (
              <button
                key={b.id}
                onClick={() => loadDetails(b)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition-all",
                  selectedBatch?.id === b.id 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="lecture" size="sm">{b.department}</Badge>
                  <Badge variant="success" size="sm">Sem {b.semester}</Badge>
                </div>
                <div className="font-semibold text-sm mb-1">{b.branch}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {b.class_display}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {b.batch_display}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Details */}
        <div>
          {!selectedBatch ? (
            <Card>
              <EmptyState 
                icon="🎓"
                title="Select a Batch"
                description="Click on a batch from the list to view its details, subjects, and timetable"
              />
            </Card>
          ) : detailsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" />
              </CardContent>
            </Card>
          ) : batchDetails?.error ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{batchDetails.error}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Batch Header */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-1">{selectedBatch.branch}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedBatch.department} • Semester {selectedBatch.semester}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="lecture">{selectedBatch.class_display}</Badge>
                      <Badge variant="lab">{selectedBatch.batch_display}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subjects */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Subjects ({batchDetails.subjects?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {batchDetails.subjects?.map(s => (
                      <div 
                        key={`${s.code}-${s.type}`} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg"
                      >
                        <span className="font-medium text-sm">{s.code}</span>
                        <TypeBadge type={s.type} size="sm" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Timetable */}
              {batchDetails.timetable?.weekly_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Weekly Timetable ({Object.keys(batchDetails.timetable.weekly_summary).length} entries)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Slots/Week</TableHead>
                          <TableHead>Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(batchDetails.timetable.weekly_summary)
                          .sort(([, a], [, b]) => (a.code || '').localeCompare(b.code || ''))
                          .map(([key, data]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{data.code || key}</TableCell>
                            <TableCell><TypeBadge type={data.type} /></TableCell>
                            <TableCell>{data.slots_per_week}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {data.days?.join(', ')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
