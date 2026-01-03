import { useState, useEffect } from 'react'
import { 
  Calculator, 
  Zap, 
  Eye, 
  Building2, 
  BookOpen, 
  Calendar,
  School,
  Users,
  Check,
  AlertCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Database,
  Layers
} from 'lucide-react'
import { api, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge, TypeBadge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { StatCard, MiniStat, StatsRow } from '../components/shared/StatCard'
import { FilterSelect, FilterGrid } from '../components/shared/Filters'
import { PageHeader } from '../components/shared/PageHeader'
import { LoadingScreen, LoadingSpinner, EmptyState } from '../components/shared/Loading'

export function SemesterTotals() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [filters, setFilters] = useState({
    department: '', branch: '', semester: '', classId: '', batchId: ''
  })
  
  const [result, setResult] = useState(null)
  const [bulkResult, setBulkResult] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calculatingBulk, setCalculatingBulk] = useState(false)
  const [totals, setTotals] = useState(null)
  const [totalsLoading, setTotalsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    api('/test/all-batches').then(data => {
      if (data.batches) setBatches(data.batches)
      setLoading(false)
    })
  }, [])

  // Build hierarchy with proper filtering
  const departments = [...new Set(batches.map(b => b.department).filter(Boolean))].sort()
  
  const branches = [...new Set(
    batches
      .filter(b => !filters.department || b.department === filters.department)
      .map(b => b.branch)
      .filter(Boolean)
  )].sort()
  
  const semesters = [...new Set(
    batches
      .filter(b => (!filters.department || b.department === filters.department) &&
                   (!filters.branch || b.branch === filters.branch))
      .map(b => b.semester)
      .filter(Boolean)
  )].sort((a, b) => a - b)
  
  const classes = [...new Map(
    batches
      .filter(b => (!filters.department || b.department === filters.department) &&
                   (!filters.branch || b.branch === filters.branch) &&
                   (!filters.semester || b.semester === filters.semester))
      .map(b => [b.class_id, { id: b.class_id, name: b.class_display, semester_id: b.semester_id }])
  ).values()]
  
  const batchOptions = batches.filter(b => 
    (!filters.department || b.department === filters.department) &&
    (!filters.branch || b.branch === filters.branch) &&
    (!filters.semester || b.semester === filters.semester) &&
    (!filters.classId || b.class_id === filters.classId)
  )

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    if (key === 'department') {
      newFilters.branch = ''
      newFilters.semester = ''
      newFilters.classId = ''
      newFilters.batchId = ''
    } else if (key === 'branch') {
      newFilters.semester = ''
      newFilters.classId = ''
      newFilters.batchId = ''
    } else if (key === 'semester') {
      newFilters.classId = ''
      newFilters.batchId = ''
    } else if (key === 'classId') {
      newFilters.batchId = ''
    }
    setFilters(newFilters)
    setResult(null)
    setBulkResult(null)
    setTotals(null)
  }

  const selectedBatch = batches.find(b => b.id === filters.batchId)
  const selectedClass = classes.find(c => c.id === filters.classId)
  const batchesInClass = batchOptions.length

  const calculateTotals = async () => {
    if (!filters.batchId || !selectedBatch?.semester_id) {
      return alert('Please select a batch first')
    }
    setCalculating(true)
    setResult(null)
    setTotals(null)

    const res = await api(`/test/calculate-semester-totals?batch_id=${filters.batchId}&semester_id=${selectedBatch.semester_id}`, {
      method: 'POST'
    })
    setResult(res)
    setCalculating(false)
    
    // Auto-refresh existing totals after calculation
    if (!res.error) {
      viewTotals()
    }
  }

  const viewTotals = async () => {
    if (!filters.batchId || !selectedBatch?.semester_id) return
    setTotalsLoading(true)
    setTotals(null)
    
    try {
      const res = await api(`/test/semester-totals/${filters.batchId}/${selectedBatch.semester_id}`)
      setTotals(res)
    } catch (e) {
      setTotals({ error: e.message })
    }
    setTotalsLoading(false)
  }

  const calculateAllInClass = async () => {
    if (!filters.classId || !selectedClass?.semester_id) {
      return alert('Please select a class first')
    }
    setCalculatingBulk(true)
    setBulkResult(null)

    const res = await api(`/test/calculate-semester-totals-bulk?class_id=${filters.classId}&semester_id=${selectedClass.semester_id}`, {
      method: 'POST'
    })
    setBulkResult(res)
    setCalculatingBulk(false)
  }

  const clearAll = () => {
    setFilters({ department: '', branch: '', semester: '', classId: '', batchId: '' })
    setResult(null)
    setBulkResult(null)
    setTotals(null)
  }

  if (loading) return <LoadingScreen message="Loading batches..." />

  const totalSubjects = result?.subjects?.length || totals?.totals?.length || 0
  const totalClasses = (result?.subjects || totals?.totals || [])
    .reduce((sum, s) => sum + (s.total_classes_in_semester || 0), 0)

  return (
    <div className="page-container">
      <PageHeader 
        title="Semester Totals Calculator" 
        subtitle="Pre-compute expected total classes per subject for the semester"
      />

      {/* Quick Stats */}
      {selectedBatch && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Selected Batch" 
            value={selectedBatch.batch_display}
            icon={Users}
            color="primary"
          />
          <StatCard 
            title="Class" 
            value={selectedBatch.class_display}
            icon={School}
            color="info"
          />
          <StatCard 
            title="Subjects" 
            value={totalSubjects || '-'}
            icon={BookOpen}
            color="success"
          />
          <StatCard 
            title="Total Classes" 
            value={totalClasses || '-'}
            icon={Calculator}
            color="warning"
          />
        </div>
      )}

      {/* Filters Card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Select Scope</CardTitle>
              <CardDescription>Filter down to a specific batch or calculate for entire class</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {(filters.department || filters.batchId) && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="space-y-4 pt-2">
            <FilterGrid columns={5}>
              <FilterSelect
                label="Department"
                icon={Building2}
                value={filters.department}
                onChange={v => updateFilter('department', v)}
                options={departments.map(d => ({ value: d, label: d }))}
                placeholder="All Departments"
              />
              <FilterSelect
                label="Branch"
                icon={BookOpen}
                value={filters.branch}
                onChange={v => updateFilter('branch', v)}
                options={branches.map(b => ({ value: b, label: b }))}
                placeholder="All Branches"
                disabled={!filters.department}
              />
              <FilterSelect
                label="Semester"
                icon={Calendar}
                value={filters.semester}
                onChange={v => updateFilter('semester', Number(v))}
                options={semesters.map(s => ({ value: s, label: `Semester ${s}` }))}
                placeholder="All Semesters"
                disabled={!filters.branch}
              />
              <FilterSelect
                label="Class"
                icon={School}
                value={filters.classId}
                onChange={v => updateFilter('classId', v)}
                options={classes.map(c => ({ value: c.id, label: c.name }))}
                placeholder="All Classes"
                disabled={!filters.semester}
              />
              <FilterSelect
                label="Batch"
                icon={Users}
                value={filters.batchId}
                onChange={v => updateFilter('batchId', v)}
                options={batchOptions.map(b => ({ value: b.id, label: b.batch_display }))}
                placeholder="Select Batch"
                disabled={!filters.classId}
              />
            </FilterGrid>

            {/* Selection Summary */}
            {selectedBatch && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                <Check className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-sm">
                  <span className="font-medium">{selectedBatch.department}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="font-medium">{selectedBatch.branch}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span>Sem {selectedBatch.semester}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span>{selectedBatch.class_display}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="font-semibold text-success">{selectedBatch.batch_display}</span>
                </span>
              </div>
            )}

            {filters.classId && !filters.batchId && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-info/10 border border-info/30">
                <Layers className="w-5 h-5 text-info flex-shrink-0" />
                <span className="text-sm">
                  <span className="font-medium">{batchesInClass} batch{batchesInClass !== 1 ? 'es' : ''}</span>
                  <span className="text-muted-foreground"> in {selectedClass?.name}. Select a specific batch or calculate all at once.</span>
                </span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Action Buttons */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={calculateTotals} 
              disabled={calculating || !filters.batchId}
              loading={calculating}
              size="lg"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Single Batch
            </Button>
            
            <Button 
              onClick={calculateAllInClass} 
              disabled={calculatingBulk || !filters.classId}
              loading={calculatingBulk}
              variant="secondary"
              size="lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Bulk Calculate ({batchesInClass} batches)
            </Button>
            
            <div className="h-8 w-px bg-border mx-2" />
            
            <Button 
              onClick={viewTotals} 
              disabled={!filters.batchId || totalsLoading} 
              variant="outline"
              size="lg"
            >
              {totalsLoading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              View Saved Totals
            </Button>
          </div>
          
          {!filters.classId && (
            <p className="text-xs text-muted-foreground mt-3">
              Select at least a class to enable bulk calculation, or select a specific batch for single calculation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Single Batch Result */}
        {result && !result.error && (
          <Card className="animate-fade-in lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Check className="w-5 h-5 text-success" />
                Calculation Complete
              </CardTitle>
              <CardDescription>
                Computed in {result.duration_ms}ms • {result.subjects_calculated} subjects calculated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show calculation breakdown if available */}
              {result.subjects?.[0]?.calculation_details && (
                <div className="p-4 rounded-lg bg-secondary/50 border">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Academic Calendar Applied
                  </h4>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Semester Period</span>
                      <span className="font-medium">
                        {result.subjects[0].calculation_details.semester_start} → {result.subjects[0].calculation_details.semester_end}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Total Calendar Days</span>
                      <span className="font-medium">{result.subjects[0].calculation_details.total_calendar_days || '-'} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Non-Teaching Days Excluded</span>
                      <span className="font-semibold text-warning">{result.subjects[0].calculation_details.non_teaching_days_excluded || 0} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Teaching Weeks</span>
                      <span className="font-semibold text-success">{result.subjects[0].calculation_details.teaching_weeks || '-'} weeks</span>
                    </div>
                  </div>
                  
                  {/* Detailed Non-Teaching Breakdown */}
                  {result.subjects[0].calculation_details.non_teaching_breakdown && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        📋 Non-Teaching Days Breakdown
                      </h5>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Sundays & Saturdays */}
                        <div className="p-2 rounded bg-background/50">
                          <span className="text-muted-foreground block">🗓️ Weekly Offs</span>
                          <span className="font-medium">
                            {result.subjects[0].calculation_details.non_teaching_breakdown.sundays_count} Sundays
                          </span>
                          <span className="text-muted-foreground"> + </span>
                          <span className="font-medium">
                            {result.subjects[0].calculation_details.non_teaching_breakdown.saturdays_count} Saturdays
                          </span>
                          <span className="text-muted-foreground block text-[10px]">
                            (Pattern: {result.subjects[0].calculation_details.non_teaching_breakdown.saturday_pattern})
                          </span>
                        </div>
                        
                        {/* Holidays */}
                        <div className="p-2 rounded bg-background/50">
                          <span className="text-muted-foreground block">🎉 Holidays</span>
                          {result.subjects[0].calculation_details.non_teaching_breakdown.holidays?.length > 0 ? (
                            <ul className="space-y-0.5 mt-1">
                              {result.subjects[0].calculation_details.non_teaching_breakdown.holidays.map((h, i) => (
                                <li key={i} className="flex justify-between">
                                  <span className="font-medium truncate pr-1">{h.name}</span>
                                  <span className="text-muted-foreground whitespace-nowrap">{h.start_date}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground italic">No holidays</span>
                          )}
                        </div>
                        
                        {/* Vacations */}
                        <div className="p-2 rounded bg-background/50">
                          <span className="text-muted-foreground block">🏖️ Vacations</span>
                          {result.subjects[0].calculation_details.non_teaching_breakdown.vacations?.length > 0 ? (
                            <ul className="space-y-0.5 mt-1">
                              {result.subjects[0].calculation_details.non_teaching_breakdown.vacations.map((v, i) => (
                                <li key={i}>
                                  <span className="font-medium">{v.name}</span>
                                  <span className="text-muted-foreground block text-[10px]">
                                    {v.start_date} → {v.end_date} ({v.days} days)
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground italic">No vacations</span>
                          )}
                        </div>
                        
                        {/* Exams */}
                        <div className="p-2 rounded bg-background/50">
                          <span className="text-muted-foreground block">📝 Exam Periods</span>
                          {result.subjects[0].calculation_details.non_teaching_breakdown.exams?.length > 0 ? (
                            <ul className="space-y-0.5 mt-1">
                              {result.subjects[0].calculation_details.non_teaching_breakdown.exams.map((e, i) => (
                                <li key={i}>
                                  <span className="font-medium">{e.name}</span>
                                  <span className="text-muted-foreground block text-[10px]">
                                    {e.start_date} → {e.end_date} ({e.days} days)
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground italic">No exam periods</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {result.subjects[0].calculation_details.formula && (
                    <p className="text-xs text-info mt-3 font-medium">
                      📊 {result.subjects[0].calculation_details.formula}
                    </p>
                  )}
                </div>
              )}
              
              <StatsRow>
                <MiniStat label="Subjects" value={result.subjects_calculated} color="primary" />
                <MiniStat label="Persisted" value={result.subjects_persisted} color="success" />
                <MiniStat 
                  label="Total Classes" 
                  value={result.subjects?.reduce((sum, s) => sum + s.total_classes_in_semester, 0) || 0} 
                  color="info" 
                />
              </StatsRow>
              
              {result.subjects && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Slots/Week</TableHead>
                        <TableHead className="text-right">Total Classes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.subjects.map(s => (
                        <TableRow key={`${s.subject_code}-${s.class_type}`}>
                          <TableCell>
                            <span className="font-medium">{s.subject_code}</span>
                          </TableCell>
                          <TableCell><TypeBadge type={s.class_type} size="sm" /></TableCell>
                          <TableCell className="text-center">{s.slots_per_week}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-primary">{s.total_classes_in_semester}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Existing Totals */}
        {(totals?.totals || totalsLoading) && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="w-5 h-5 text-info" />
                Saved Semester Totals
              </CardTitle>
              <CardDescription>
                {totals?.count || 0} records from database
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : totals?.totals?.length === 0 ? (
                <EmptyState 
                  icon="📊"
                  title="No totals found"
                  description="Run the calculation first to generate semester totals"
                />
              ) : (
                <div className="space-y-4">
                  {/* Show calculation details from saved data */}
                  {totals?.totals?.[0]?.calculation_details && (
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <h4 className="font-semibold text-xs mb-2 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Saved Calculation Details
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Period:</span>{' '}
                          <span className="font-medium">
                            {totals.totals[0].calculation_details.semester_start} → {totals.totals[0].calculation_details.semester_end}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Non-Teaching Days:</span>{' '}
                          <span className="font-semibold text-warning">{totals.totals[0].calculation_details.non_teaching_days_excluded || 0}</span>
                        </div>
                      </div>
                      {totals.totals[0].calculated_at && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Calculated: {new Date(totals.totals[0].calculated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-center">Slots/Week</TableHead>
                          <TableHead className="text-center">Weeks</TableHead>
                          <TableHead className="text-right">Total Classes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totals?.totals?.map(s => (
                          <TableRow key={`${s.subject_code}-${s.class_type}`}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{s.subject_code}</span>
                                {s.subject_name && (
                                  <span className="text-xs text-muted-foreground block">{s.subject_name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell><TypeBadge type={s.class_type} size="sm" /></TableCell>
                            <TableCell className="text-center">{s.slots_per_week}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{s.teaching_weeks || '-'}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-primary">{s.total_classes_in_semester}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error States */}
      {result?.error && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Calculation Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{result.error}</p>
            {result.message && (
              <p className="text-xs text-muted-foreground mt-2">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {totals?.error && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Error Loading Totals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{totals.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Bulk Result */}
      {bulkResult && !bulkResult.error && (
        <Card className="mt-6 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              Bulk Calculation Complete
            </CardTitle>
            <CardDescription>
              Processed {bulkResult.batches_processed} batches in {bulkResult.duration_ms}ms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatsRow className="mb-4">
              <MiniStat label="Batches Processed" value={bulkResult.batches_processed} color="success" />
              <MiniStat label="Total Subjects" value={bulkResult.total_subjects} color="primary" />
              <MiniStat label="Avg Duration" value={`${Math.round(bulkResult.duration_ms / (bulkResult.batches_processed || 1))}ms`} />
            </StatsRow>
            
            {bulkResult.results && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-center">Subjects</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResult.results.map(r => (
                      <TableRow key={r.batch_id}>
                        <TableCell className="font-medium">{r.batch_name}</TableCell>
                        <TableCell className="text-center">{r.subjects_calculated}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="success" size="sm">Done</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.duration_ms}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {bulkResult.errors?.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="text-sm font-medium text-destructive mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {bulkResult.errors.length} Error{bulkResult.errors.length > 1 ? 's' : ''}
                </div>
                {bulkResult.errors.map((e, i) => (
                  <div key={i} className="text-xs text-destructive/80 mt-1">{e}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {bulkResult?.error && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Bulk Calculation Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{bulkResult.error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
