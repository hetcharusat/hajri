import { useState, useEffect } from 'react'

const API_URL = '/engine'

async function api(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  return res.json()
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api('/health').then(setHealth)
  }, [])

  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'semester-totals', icon: '📅', label: 'Semester Totals' },
    { id: 'batches', icon: '🎓', label: 'Batches' },
    { id: 'predictions', icon: '📈', label: 'Predictions' },
    { id: 'debug', icon: '🔧', label: 'Debug' }
  ]

  return (
    <div className="app">
      <style>{globalStyles}</style>
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚙️</span>
            <div>
              <div className="logo-title">HAJRI</div>
              <div className="logo-subtitle">Engine Admin</div>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className={`status-indicator ${health?.status === 'healthy' ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{health?.status === 'healthy' ? 'Engine Online' : 'Connecting...'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'semester-totals' && <SemesterTotalsTab />}
        {tab === 'batches' && <BatchesTab />}
        {tab === 'predictions' && <PredictionsTab />}
        {tab === 'debug' && <DebugTab />}
      </main>
    </div>
  )
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================
function DashboardTab() {
  const [stats, setStats] = useState({ batches: 0, loading: true })

  useEffect(() => {
    api('/test/all-batches').then(data => {
      setStats({ batches: data.batches?.length || 0, loading: false })
    })
  }, [])

  return (
    <div className="page">
      <PageHeader 
        title="Dashboard" 
        subtitle="Monitor and manage HAJRI Engine"
      />
      
      <div className="stats-grid">
        <StatCard icon="🎓" label="Total Batches" value={stats.loading ? '...' : stats.batches} color="blue" />
        <StatCard icon="✅" label="Engine Status" value="Healthy" color="green" />
        <StatCard icon="🔌" label="API Version" value="v1.0" color="purple" />
        <StatCard icon="📡" label="Endpoints" value="12" color="orange" />
      </div>

      <div className="grid-2">
        <Card title="Quick Actions">
          <div className="action-list">
            <ActionItem icon="📖" label="View API Docs" onClick={() => window.open('/engine/docs', '_blank')} />
            <ActionItem icon="📅" label="Calculate Semester Totals" onClick={() => {}} />
            <ActionItem icon="🔍" label="Test Predictions" onClick={() => {}} />
          </div>
        </Card>

        <Card title="Available Endpoints">
          <div className="endpoint-list">
            <EndpointItem method="GET" path="/health" desc="Health check" />
            <EndpointItem method="POST" path="/snapshots" desc="OCR submission" />
            <EndpointItem method="GET" path="/predictions" desc="Bunk predictions" />
            <EndpointItem method="POST" path="/admin/calculate-semester-totals" desc="Calculate totals" />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// SEMESTER TOTALS TAB
// ============================================================================
function SemesterTotalsTab() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Hierarchical selection
  const [filters, setFilters] = useState({
    department: '', branch: '', semester: '', classId: '', batchId: ''
  })
  
  const [result, setResult] = useState(null)
  const [bulkResult, setBulkResult] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calculatingBulk, setCalculatingBulk] = useState(false)
  const [totals, setTotals] = useState(null)

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
    // Reset dependent filters
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

    const res = await api(`/test/calculate-semester-totals?batch_id=${filters.batchId}&semester_id=${selectedBatch.semester_id}`, {
      method: 'POST'
    })
    setResult(res)
    setCalculating(false)
  }

  const viewTotals = async () => {
    if (!filters.batchId || !selectedBatch?.semester_id) return
    const res = await api(`/admin/semester-totals/${filters.batchId}/${selectedBatch.semester_id}`)
    setTotals(res)
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

  if (loading) return <LoadingScreen />

  return (
    <div className="page">
      <PageHeader 
        title="Semester Totals Calculator" 
        subtitle="Calculate expected total classes per subject for the entire semester"
      />

      <Card>
        <div className="filter-grid">
          <FilterSelect
            label="Department"
            icon="🏛️"
            value={filters.department}
            onChange={v => updateFilter('department', v)}
            options={departments.map(d => ({ value: d, label: d }))}
            placeholder="All Departments"
          />
          <FilterSelect
            label="Branch"
            icon="📚"
            value={filters.branch}
            onChange={v => updateFilter('branch', v)}
            options={branches.map(b => ({ value: b, label: b }))}
            placeholder="All Branches"
            disabled={!filters.department}
          />
          <FilterSelect
            label="Semester"
            icon="📆"
            value={filters.semester}
            onChange={v => updateFilter('semester', Number(v))}
            options={semesters.map(s => ({ value: s, label: `Semester ${s}` }))}
            placeholder="All Semesters"
            disabled={!filters.branch}
          />
          <FilterSelect
            label="Class"
            icon="🏫"
            value={filters.classId}
            onChange={v => updateFilter('classId', v)}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            placeholder="All Classes"
            disabled={!filters.semester}
          />
          <FilterSelect
            label="Batch"
            icon="👥"
            value={filters.batchId}
            onChange={v => updateFilter('batchId', v)}
            options={batchOptions.map(b => ({ value: b.id, label: b.batch_display }))}
            placeholder="Select Batch"
            disabled={!filters.classId}
          />
        </div>

        {selectedBatch && (
          <div className="selection-summary">
            <span className="summary-icon">✓</span>
            <span className="summary-path">
              {selectedBatch.department} → {selectedBatch.branch} → Sem {selectedBatch.semester} → {selectedBatch.class_display} → {selectedBatch.batch_display}
            </span>
          </div>
        )}

        {filters.classId && !filters.batchId && (
          <div className="selection-summary info">
            <span className="summary-icon">ℹ️</span>
            <span className="summary-path">
              {batchesInClass} batch{batchesInClass !== 1 ? 'es' : ''} in {selectedClass?.name}. 
              Select a specific batch or calculate all at once.
            </span>
          </div>
        )}

        <div className="button-group">
          <Button 
            onClick={calculateTotals} 
            disabled={calculating || !filters.batchId}
            loading={calculating}
          >
            🧮 Calculate Single Batch
          </Button>
          <Button 
            onClick={calculateAllInClass} 
            disabled={calculatingBulk || !filters.classId}
            loading={calculatingBulk}
            variant="primary"
          >
            ⚡ Calculate All in Class ({batchesInClass})
          </Button>
          <Button onClick={viewTotals} disabled={!filters.batchId} variant="secondary">
            👀 View Existing
          </Button>
        </div>
      </Card>

      {result && !result.error && (
        <Card title={`Calculation Result`}>
          <div className="stats-row">
            <MiniStat label="Subjects" value={result.subjects_calculated} />
            <MiniStat label="Persisted" value={result.subjects_persisted} />
            <MiniStat label="Duration" value={`${result.duration_ms}ms`} />
          </div>
          
          {result.subjects && (
            <DataTable
              columns={['Subject', 'Type', 'Slots/Week', 'Total Classes']}
              data={result.subjects.map(s => [
                s.subject_code,
                <TypeBadge key={s.subject_code} type={s.class_type} />,
                s.slots_per_week,
                <strong key={`total-${s.subject_code}`}>{s.total_classes_in_semester}</strong>
              ])}
            />
          )}
        </Card>
      )}

      {result?.error && (
        <Card title="Error" variant="error">
          <p>{result.error}</p>
        </Card>
      )}

      {bulkResult && !bulkResult.error && (
        <Card title="Bulk Calculation Complete">
          <div className="stats-row">
            <MiniStat label="Batches Processed" value={bulkResult.batches_processed} color="green" />
            <MiniStat label="Total Subjects" value={bulkResult.total_subjects} />
            <MiniStat label="Total Duration" value={`${bulkResult.duration_ms}ms`} />
          </div>
          
          {bulkResult.results && (
            <DataTable
              columns={['Batch', 'Subjects', 'Duration']}
              data={bulkResult.results.map(r => [
                r.batch_name,
                r.subjects_calculated,
                `${r.duration_ms}ms`
              ])}
            />
          )}

          {bulkResult.errors?.length > 0 && (
            <Card title="Errors" variant="error">
              {bulkResult.errors.map((e, i) => <p key={i}>{e}</p>)}
            </Card>
          )}
        </Card>
      )}

      {bulkResult?.error && (
        <Card title="Error" variant="error">
          <p>{bulkResult.error}</p>
        </Card>
      )}

      {totals?.totals && (
        <Card title="Existing Semester Totals">
          <DataTable
            columns={['Subject', 'Type', 'Slots/Week', 'Total Classes']}
            data={totals.totals.map(s => [
              s.subject_code,
              <TypeBadge key={s.subject_code} type={s.class_type} />,
              s.slots_per_week,
              <strong key={`total-${s.subject_code}`}>{s.total_classes_in_semester}</strong>
            ])}
          />
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// BATCHES TAB
// ============================================================================
function BatchesTab() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ department: '', branch: '', semester: '' })
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batchDetails, setBatchDetails] = useState(null)

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
        b.branch?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const loadDetails = async (batch) => {
    setSelectedBatch(batch)
    setBatchDetails(null)
    const details = await api(`/test/batch/${batch.id}`)
    setBatchDetails(details)
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="page">
      <PageHeader 
        title="Batches" 
        subtitle={`${batches.length} batches registered in the system`}
      />

      <div className="batches-layout">
        {/* Left Panel - Filters & List */}
        <div className="batches-list-panel">
          <Card>
            {/* Search */}
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search batches..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Filters */}
            <div className="compact-filters">
              <select 
                value={filters.department} 
                onChange={e => setFilters({ ...filters, department: e.target.value, branch: '', semester: '' })}
                className="compact-select"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select 
                value={filters.branch} 
                onChange={e => setFilters({ ...filters, branch: e.target.value, semester: '' })}
                className="compact-select"
                disabled={!filters.department}
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select 
                value={filters.semester} 
                onChange={e => setFilters({ ...filters, semester: Number(e.target.value) || '' })}
                className="compact-select"
                disabled={!filters.branch}
              >
                <option value="">All Semesters</option>
                {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>

            {/* Results count */}
            <div className="results-count">
              Showing {filteredBatches.length} of {batches.length} batches
            </div>

            {/* Batch List */}
            <div className="batch-list">
              {filteredBatches.map(b => (
                <div
                  key={b.id}
                  onClick={() => loadDetails(b)}
                  className={`batch-item ${selectedBatch?.id === b.id ? 'active' : ''}`}
                >
                  <div className="batch-item-header">
                    <span className="batch-dept-badge">{b.department}</span>
                    <span className="batch-sem-badge">Sem {b.semester}</span>
                  </div>
                  <div className="batch-item-title">{b.branch}</div>
                  <div className="batch-item-meta">
                    <span>🏫 {b.class_display}</span>
                    <span>👥 {b.batch_display}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Panel - Details */}
        <div className="batches-detail-panel">
          {!selectedBatch ? (
            <Card className="empty-state">
              <div className="empty-icon">🎓</div>
              <div className="empty-title">Select a Batch</div>
              <div className="empty-desc">Click on a batch from the list to view its details</div>
            </Card>
          ) : !batchDetails ? (
            <Card><LoadingSpinner /></Card>
          ) : batchDetails.error ? (
            <Card title="Error" variant="error"><p>{batchDetails.error}</p></Card>
          ) : (
            <>
              <Card>
                <div className="detail-header">
                  <div>
                    <h2 className="detail-title">{selectedBatch.branch}</h2>
                    <p className="detail-subtitle">{selectedBatch.department} • Semester {selectedBatch.semester}</p>
                  </div>
                  <div className="detail-badges">
                    <span className="badge badge-blue">{selectedBatch.class_display}</span>
                    <span className="badge badge-purple">{selectedBatch.batch_display}</span>
                  </div>
                </div>
              </Card>

              <Card title={`Subjects (${batchDetails.subjects?.length || 0})`}>
                <div className="subjects-grid">
                  {batchDetails.subjects?.map(s => (
                    <div key={`${s.code}-${s.type}`} className="subject-chip">
                      <span className="subject-code">{s.code}</span>
                      <TypeBadge type={s.type} small />
                    </div>
                  ))}
                </div>
              </Card>

              {batchDetails.timetable?.weekly_summary && (
                <Card title="Timetable">
                  <DataTable
                    columns={['Subject', 'Type', 'Slots/Week', 'Days']}
                    data={Object.entries(batchDetails.timetable.weekly_summary).map(([code, data]) => [
                      code,
                      <TypeBadge key={code} type={data.type} />,
                      data.slots_per_week,
                      <span key={`days-${code}`} className="days-list">{data.days?.join(', ')}</span>
                    ])}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// PREDICTIONS TAB
// ============================================================================
function PredictionsTab() {
  const [studentId, setStudentId] = useState('11111111-1111-1111-1111-111111111111')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadPredictions = async () => {
    setLoading(true)
    const res = await api(`/test/predictions/${studentId}`)
    setData(res)
    setLoading(false)
  }

  return (
    <div className="page">
      <PageHeader 
        title="Predictions Viewer" 
        subtitle="Test attendance predictions without authentication"
      />
      
      <Card>
        <div className="input-group">
          <label className="input-label">Student ID</label>
          <div className="input-row">
            <input
              type="text"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              placeholder="Enter student UUID"
              className="text-input"
            />
            <Button onClick={loadPredictions} disabled={loading} loading={loading}>
              🔍 Load Predictions
            </Button>
          </div>
        </div>
      </Card>

      {data && !data.error && (
        <>
          {/* Overall Stats */}
          <div className="stats-grid-4">
            <StatCard 
              icon="✅" 
              label="Overall Present" 
              value={data.dashboard?.overall_present || 0} 
              color="green" 
            />
            <StatCard 
              icon="📊" 
              label="Overall Total" 
              value={data.dashboard?.overall_total || 0} 
              color="blue" 
            />
            <StatCard 
              icon="📈" 
              label="Percentage" 
              value={`${data.dashboard?.overall_percentage || 0}%`} 
              color={data.dashboard?.overall_percentage >= 75 ? 'green' : 'red'} 
            />
            <StatCard 
              icon="⚠️" 
              label="Subjects at Risk" 
              value={data.predictions?.subjects_at_risk || 0} 
              color={data.predictions?.subjects_at_risk > 0 ? 'red' : 'green'} 
            />
          </div>

          {/* Current Attendance */}
          <Card title="📊 Current Attendance">
            <DataTable
              columns={['Subject', 'Type', 'Present', 'Total', '%', 'Status']}
              data={data.dashboard?.subjects?.map(s => [
                s.subject_code,
                <TypeBadge key={s.subject_code} type={s.class_type} />,
                s.present,
                s.total,
                <span key={`pct-${s.subject_code}`} className={s.percentage >= 75 ? 'text-green' : 'text-red'}>{s.percentage}%</span>,
                <StatusBadge key={`status-${s.subject_code}`} status={s.status} />
              ]) || []}
            />
          </Card>

          {/* Predictions */}
          <Card title="🔮 Predictions">
            <div className="stats-row">
              <MiniStat label="Total Can Bunk" value={data.predictions?.total_can_bunk} color="green" />
              <MiniStat label="Total Must Attend" value={data.predictions?.total_must_attend} color="orange" />
              <MiniStat label="Classes Remaining" value={data.predictions?.classes_remaining_in_semester} />
            </div>
            
            <DataTable
              columns={['Subject', 'Type', 'Current', 'Can Bunk', 'Must Attend', 'Remaining']}
              data={data.predictions?.subjects?.map(s => [
                s.subject_code,
                <TypeBadge key={s.subject_code} type={s.class_type} />,
                `${s.present}/${s.total} (${s.percentage}%)`,
                <span key={`bunk-${s.subject_code}`} className="text-green font-bold">{s.can_bunk}</span>,
                <span key={`attend-${s.subject_code}`} className="text-orange font-bold">{s.must_attend}</span>,
                s.classes_remaining
              ]) || []}
            />
          </Card>
        </>
      )}

      {data?.error && (
        <Card title="Error" variant="error">
          <p>{data.error}</p>
          {data.traceback && <pre className="error-trace">{data.traceback}</pre>}
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// DEBUG TAB
// ============================================================================
function DebugTab() {
  const [studentId, setStudentId] = useState('11111111-1111-1111-1111-111111111111')
  const [context, setContext] = useState(null)
  const [endpoint, setEndpoint] = useState('/health')
  const [method, setMethod] = useState('GET')
  const [response, setResponse] = useState(null)

  const loadContext = async () => {
    const res = await api(`/test/student-context/${studentId}`)
    setContext(res)
  }

  const executeApi = async () => {
    const res = await api(endpoint, { method })
    setResponse(res)
  }

  return (
    <div className="page">
      <PageHeader 
        title="Debug Tools" 
        subtitle="Test endpoints and inspect data"
      />

      <div className="grid-2">
        <Card title="Student Context">
          <div className="input-group">
            <label className="input-label">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="text-input"
            />
          </div>
          <Button onClick={loadContext}>🔍 Load Context</Button>
          {context && <pre className="json-output">{JSON.stringify(context, null, 2)}</pre>}
        </Card>

        <Card title="API Tester">
          <div className="input-row">
            <select value={method} onChange={e => setMethod(e.target.value)} className="method-select">
              <option>GET</option>
              <option>POST</option>
            </select>
            <input
              type="text"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="/endpoint"
              className="text-input"
            />
          </div>
          <Button onClick={executeApi}>▶️ Execute</Button>
          {response && <pre className="json-output">{JSON.stringify(response, null, 2)}</pre>}
        </Card>
      </div>

      <Card title="Test Endpoints (No Auth Required)">
        <div className="endpoint-list">
          <EndpointItem method="GET" path="/test/all-batches" desc="List all batches" />
          <EndpointItem method="GET" path="/test/batch/{batch_id}" desc="Batch details & timetable" />
          <EndpointItem method="GET" path="/test/student-context/{student_id}" desc="Student context" />
          <EndpointItem method="GET" path="/test/predictions/{student_id}" desc="Predictions" />
          <EndpointItem method="POST" path="/test/calculate-semester-totals" desc="Calculate totals" />
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  )
}

function Card({ title, children, variant, className = '' }) {
  return (
    <div className={`card ${variant || ''} ${className}`}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}

function Button({ children, onClick, disabled, loading, variant = 'primary' }) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`btn btn-${variant} ${loading ? 'loading' : ''}`}
    >
      {loading ? <span className="spinner"></span> : null}
      {children}
    </button>
  )
}

function StatCard({ icon, label, value, color = 'blue' }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div className="mini-stat">
      <div className={`mini-stat-value ${color ? `text-${color}` : ''}`}>{value}</div>
      <div className="mini-stat-label">{label}</div>
    </div>
  )
}

function FilterSelect({ label, icon, value, onChange, options, placeholder, disabled }) {
  return (
    <div className={`filter-select ${disabled ? 'disabled' : ''}`}>
      <label className="filter-label">{icon} {label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="filter-dropdown"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function TypeBadge({ type, small }) {
  const colors = { LECTURE: 'blue', LAB: 'purple', TUTORIAL: 'green' }
  return <span className={`type-badge type-${colors[type] || 'gray'} ${small ? 'small' : ''}`}>{type}</span>
}

function StatusBadge({ status }) {
  const colors = { SAFE: 'green', LOW: 'orange', CRITICAL: 'red' }
  return <span className={`status-badge status-${colors[status] || 'gray'}`}>{status}</span>
}

function DataTable({ columns, data }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionItem({ icon, label, onClick }) {
  return (
    <button className="action-item" onClick={onClick}>
      <span>{icon}</span>
      <span>{label}</span>
      <span className="action-arrow">→</span>
    </button>
  )
}

function EndpointItem({ method, path, desc }) {
  return (
    <div className="endpoint-item">
      <span className={`endpoint-method method-${method.toLowerCase()}`}>{method}</span>
      <code className="endpoint-path">{path}</code>
      <span className="endpoint-desc">{desc}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner-large"></div>
      <p>Loading...</p>
    </div>
  )
}

function LoadingSpinner() {
  return <div className="loading-spinner"></div>
}

// ============================================================================
// STYLES
// ============================================================================
const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0a0a0f;
    color: #e5e5e5;
    line-height: 1.5;
  }

  .app {
    display: flex;
    min-height: 100vh;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    background: #12121a;
    border-right: 1px solid #2a2a3a;
    display: flex;
    flex-direction: column;
    position: fixed;
    height: 100vh;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #2a2a3a;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-icon { font-size: 28px; }
  .logo-title { font-weight: 700; font-size: 18px; }
  .logo-subtitle { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }

  .sidebar-nav {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: #888;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    font-size: 14px;
    text-align: left;
  }

  .nav-item:hover { background: #1a1a24; color: #e5e5e5; }
  .nav-item.active { background: #6366f1; color: white; }
  .nav-icon { font-size: 18px; }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid #2a2a3a;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #888;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #888;
  }

  .status-indicator.online .status-dot { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
  .status-indicator.offline .status-dot { background: #ef4444; }

  /* Main Content */
  .main-content {
    flex: 1;
    margin-left: 240px;
    min-height: 100vh;
    background: #0a0a0f;
  }

  .page { padding: 32px; max-width: 1400px; }

  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: #888; font-size: 14px; }

  /* Cards */
  .card {
    background: #12121a;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .card.error { border-color: #ef4444; background: #ef444410; }
  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #2a2a3a;
  }

  /* Grids */
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stats-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
  .filter-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }

  /* Stats */
  .stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #12121a;
    border: 1px solid #2a2a3a;
    border-radius: 12px;
  }

  .stat-icon { font-size: 32px; }
  .stat-value { font-size: 28px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #888; }

  .stat-blue { border-left: 4px solid #6366f1; }
  .stat-green { border-left: 4px solid #22c55e; }
  .stat-purple { border-left: 4px solid #a855f7; }
  .stat-orange { border-left: 4px solid #f59e0b; }
  .stat-red { border-left: 4px solid #ef4444; }

  .stats-row {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 16px;
    background: #1a1a24;
    border-radius: 8px;
  }

  .mini-stat { text-align: center; }
  .mini-stat-value { font-size: 24px; font-weight: 700; }
  .mini-stat-label { font-size: 11px; color: #888; text-transform: uppercase; }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary { background: #6366f1; color: white; }
  .btn-primary:hover:not(:disabled) { background: #5558e3; }
  .btn-secondary { background: #2a2a3a; color: #e5e5e5; }
  .btn-secondary:hover:not(:disabled) { background: #3a3a4a; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .button-group { display: flex; gap: 8px; margin-top: 16px; }

  /* Inputs */
  .input-group { margin-bottom: 16px; }
  .input-label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; }
  .input-row { display: flex; gap: 8px; }

  .text-input {
    flex: 1;
    padding: 10px 14px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #e5e5e5;
    font-size: 14px;
  }

  .text-input:focus { outline: none; border-color: #6366f1; }

  /* Filter Select */
  .filter-select { display: flex; flex-direction: column; gap: 6px; }
  .filter-select.disabled { opacity: 0.5; }
  .filter-label { font-size: 11px; color: #888; font-weight: 500; }
  
  .filter-dropdown {
    padding: 10px 12px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #e5e5e5;
    font-size: 13px;
    cursor: pointer;
  }

  .filter-dropdown:focus { outline: none; border-color: #6366f1; }
  .filter-dropdown:disabled { cursor: not-allowed; }

  /* Selection Summary */
  .selection-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #22c55e10, #22c55e05);
    border: 1px solid #22c55e40;
    border-radius: 8px;
    font-size: 13px;
  }

  .summary-icon { color: #22c55e; font-size: 16px; }
  .summary-path { color: #e5e5e5; }

  .selection-summary.info {
    background: linear-gradient(135deg, #3b82f610, #3b82f605);
    border-color: #3b82f640;
  }
  .selection-summary.info .summary-icon { color: #3b82f6; }

  /* Tables */
  .table-wrapper { overflow-x: auto; }
  
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .data-table th {
    text-align: left;
    padding: 12px;
    background: #1a1a24;
    color: #888;
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .data-table td {
    padding: 12px;
    border-bottom: 1px solid #2a2a3a20;
  }

  .data-table tr:hover td { background: #ffffff05; }

  /* Badges */
  .type-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .type-badge.small { font-size: 9px; padding: 2px 6px; }
  .type-blue { background: #6366f120; color: #818cf8; }
  .type-purple { background: #a855f720; color: #c084fc; }
  .type-green { background: #22c55e20; color: #4ade80; }
  .type-gray { background: #88888820; color: #888; }

  .status-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }

  .status-green { background: #22c55e20; color: #22c55e; }
  .status-orange { background: #f59e0b20; color: #f59e0b; }
  .status-red { background: #ef444420; color: #ef4444; }

  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .badge-blue { background: #6366f130; color: #818cf8; }
  .badge-purple { background: #a855f730; color: #c084fc; }

  /* Text colors */
  .text-green { color: #22c55e; }
  .text-orange { color: #f59e0b; }
  .text-red { color: #ef4444; }
  .font-bold { font-weight: 600; }

  /* Batches Layout */
  .batches-layout {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 24px;
    align-items: start;
  }

  .batches-list-panel .card { margin-bottom: 0; }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .search-icon { color: #888; }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #e5e5e5;
    font-size: 14px;
    outline: none;
  }

  .compact-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .compact-select {
    flex: 1;
    padding: 8px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 6px;
    color: #e5e5e5;
    font-size: 12px;
  }

  .compact-select:disabled { opacity: 0.5; }

  .results-count {
    font-size: 11px;
    color: #888;
    margin-bottom: 12px;
  }

  .batch-list {
    max-height: 500px;
    overflow-y: auto;
  }

  .batch-item {
    padding: 14px;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .batch-item:hover { border-color: #6366f1; background: #6366f108; }
  .batch-item.active { border-color: #6366f1; background: #6366f115; }

  .batch-item-header {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }

  .batch-dept-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: #6366f130;
    color: #818cf8;
    border-radius: 4px;
    font-weight: 500;
  }

  .batch-sem-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: #22c55e20;
    color: #4ade80;
    border-radius: 4px;
    font-weight: 500;
  }

  .batch-item-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .batch-item-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #888;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
  .empty-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .empty-desc { font-size: 14px; color: #888; }

  /* Detail View */
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .detail-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .detail-subtitle { font-size: 13px; color: #888; }
  .detail-badges { display: flex; gap: 8px; }

  .subjects-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .subject-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 6px;
    font-size: 12px;
  }

  .subject-code { font-weight: 500; }
  .days-list { font-size: 12px; color: #888; }

  /* Action Items */
  .action-list { display: flex; flex-direction: column; gap: 8px; }
  
  .action-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #e5e5e5;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .action-item:hover { border-color: #6366f1; }
  .action-arrow { margin-left: auto; color: #888; }

  /* Endpoint List */
  .endpoint-list { display: flex; flex-direction: column; gap: 8px; }
  
  .endpoint-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #2a2a3a20;
    font-size: 13px;
  }

  .endpoint-method {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }

  .method-get { background: #22c55e20; color: #22c55e; }
  .method-post { background: #6366f120; color: #818cf8; }
  .endpoint-path { color: #e5e5e5; font-family: monospace; }
  .endpoint-desc { color: #888; margin-left: auto; }

  /* JSON Output */
  .json-output {
    margin-top: 16px;
    padding: 16px;
    background: #1a1a24;
    border-radius: 8px;
    font-size: 12px;
    font-family: monospace;
    overflow-x: auto;
    max-height: 300px;
    white-space: pre-wrap;
  }

  .error-trace {
    margin-top: 12px;
    padding: 12px;
    background: #1a1a24;
    border-radius: 6px;
    font-size: 11px;
    font-family: monospace;
    overflow-x: auto;
    color: #888;
  }

  .method-select {
    padding: 10px;
    background: #1a1a24;
    border: 1px solid #2a2a3a;
    border-radius: 8px;
    color: #e5e5e5;
    font-size: 12px;
    width: 80px;
  }

  /* Loading */
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    color: #888;
  }

  .loading-spinner-large {
    width: 40px;
    height: 40px;
    border: 3px solid #2a2a3a;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #2a2a3a;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 20px auto;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #1a1a24; }
  ::-webkit-scrollbar-thumb { background: #3a3a4a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #4a4a5a; }

  @media (max-width: 1200px) {
    .filter-grid { grid-template-columns: repeat(3, 1fr); }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .batches-layout { grid-template-columns: 1fr; }
  }
`
