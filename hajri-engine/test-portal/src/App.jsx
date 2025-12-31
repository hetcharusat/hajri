import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, apiCall, ocrExtract, OCR_URL, DEV_MODE, TEST_STUDENT_ID } from './lib/supabase'

// Auth Context
const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// App Context (academic context)
const AppContext = createContext(null)
export const useAppContext = () => useContext(AppContext)

// Storage key for persisting user's academic context
const STORAGE_KEY = 'hajri_app_context'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appContext, setAppContextState] = useState(null)
  const [view, setView] = useState('loading')

  // Wrapper to persist context to localStorage
  const setAppContext = (ctx) => {
    setAppContextState(ctx)
    if (ctx) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  useEffect(() => {
    // Load saved context from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setAppContextState(JSON.parse(saved))
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!session) {
        setView('login')
      } else if (!appContext) {
        setView('onboarding')
      } else {
        setView('dashboard')
      }
    }
  }, [loading, session, appContext])

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <AuthContext.Provider value={{ session, setSession }}>
      <AppContext.Provider value={{ appContext, setAppContext }}>
        <div className="min-h-screen">
          {view === 'login' && <LoginPage />}
          {view === 'onboarding' && <OnboardingPage onComplete={() => setView('dashboard')} />}
          {view === 'dashboard' && <DashboardPage onLogout={() => { setAppContext(null); setView('login') }} />}
        </div>
      </AppContext.Provider>
    </AuthContext.Provider>
  )
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎓</div>
        <div className="text-xl loading">Loading...</div>
      </div>
    </div>
  )
}

// Login Page
function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // login or signup

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Check your email for verification link!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🎓</div>
          <h1 className="text-2xl font-bold">HAJRI Test Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Engine Testing Interface</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-blue-400 hover:underline text-sm"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Onboarding Page - Following Department → Branch → Semester → Class → Batch hierarchy
function OnboardingPage({ onComplete }) {
  const { setAppContext } = useAppContext()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Data from DB
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [semesters, setSemesters] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [subjects, setSubjects] = useState([])
  
  // Selections
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [selectedElectives, setSelectedElectives] = useState([])

  // Load departments on mount
  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase.from('departments').select('*').order('name')
      console.log('Departments query result:', { data, error: queryError })
      if (queryError) throw queryError
      setDepartments(data || [])
    } catch (err) {
      console.error('Error loading departments:', err)
      setError(`RLS Error: ${err.message}. Check that departments table has SELECT policy for authenticated users.`)
    } finally {
      setLoading(false)
    }
  }

  // Skip onboarding for testing
  const handleSkipOnboarding = () => {
    setAppContext({
      department: { id: 'test', name: 'Test Department' },
      branch: { id: 'test', name: 'Test Branch' },
      semester: { id: 'test', semester_number: 6 },
      class: { id: 'test', class_number: 1 },
      batch: { id: 'test', batch_letter: 'A' },
      electives: []
    })
    onComplete()
  }

  const loadBranches = async (departmentId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('branches').select('*').eq('department_id', departmentId).order('name')
      if (error) throw error
      setBranches(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSemesters = async (branchId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('semesters').select('*').eq('branch_id', branchId).order('semester_number')
      if (error) throw error
      setSemesters(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadClasses = async (semesterId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('classes').select('*').eq('semester_id', semesterId).order('class_number')
      if (error) throw error
      setClasses(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadBatches = async (classId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('batches').select('*').eq('class_id', classId).order('batch_letter')
      if (error) throw error
      setBatches(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSubjects = async (semesterId) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('subjects').select('*').eq('semester_id', semesterId).order('name')
      if (error) throw error
      setSubjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDepartmentSelect = (department) => {
    setSelectedDepartment(department)
    loadBranches(department.id)
    setStep(2)
  }

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch)
    loadSemesters(branch.id)
    setStep(3)
  }

  const handleSemesterSelect = (semester) => {
    setSelectedSemester(semester)
    loadClasses(semester.id)
    loadSubjects(semester.id)
    setStep(4)
  }

  const handleClassSelect = (classObj) => {
    setSelectedClass(classObj)
    loadBatches(classObj.id)
    setStep(5)
  }

  const handleBatchSelect = (batch) => {
    setSelectedBatch(batch)
    setStep(6)
  }

  const handleComplete = () => {
    const context = {
      department: selectedDepartment,
      branch: selectedBranch,
      semester: selectedSemester,
      class: selectedClass,
      batch: selectedBatch,
      electives: selectedElectives
    }
    setAppContext(context)
    onComplete()
  }

  const electiveSubjects = subjects.filter(s => s.is_elective)
  const regularSubjects = subjects.filter(s => !s.is_elective)

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-2xl font-bold">Setup Your Profile</h1>
          <p className="text-gray-400 mt-1">Complete these steps to continue</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6].map(s => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${step >= s ? 'bg-blue-500' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Skip button for testing */}
        <div className="mb-4 text-center">
          <button
            onClick={handleSkipOnboarding}
            className="text-sm text-yellow-400 hover:underline"
          >
            ⚡ Skip Onboarding (Testing Mode)
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          {/* Step 1: Department */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Department</h2>
              {loading ? (
                <div className="text-center py-8 loading">Loading departments...</div>
              ) : departments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No departments found. Add data first.</div>
              ) : (
                <div className="grid gap-3">
                  {departments.map(dept => (
                    <button
                      key={dept.id}
                      onClick={() => handleDepartmentSelect(dept)}
                      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">{dept.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Branch */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} className="text-blue-400 hover:underline mb-4">← Back</button>
              <h2 className="text-xl font-semibold mb-4">Select Branch</h2>
              <p className="text-gray-400 text-sm mb-4">Department: {selectedDepartment?.name}</p>
              {loading ? (
                <div className="text-center py-8 loading">Loading branches...</div>
              ) : branches.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No branches found for this department.</div>
              ) : (
                <div className="grid gap-3">
                  {branches.map(branch => (
                    <button
                      key={branch.id}
                      onClick={() => handleBranchSelect(branch)}
                      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">{branch.name}</div>
                      {branch.abbreviation && <div className="text-sm text-gray-400">{branch.abbreviation}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Semester */}
          {step === 3 && (
            <div>
              <button onClick={() => setStep(2)} className="text-blue-400 hover:underline mb-4">← Back</button>
              <h2 className="text-xl font-semibold mb-4">Select Semester</h2>
              <p className="text-gray-400 text-sm mb-4">
                {selectedDepartment?.name} → {selectedBranch?.name}
              </p>
              {loading ? (
                <div className="text-center py-8 loading">Loading semesters...</div>
              ) : semesters.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No semesters found for this branch.</div>
              ) : (
                <div className="grid gap-3">
                  {semesters.map(sem => (
                    <button
                      key={sem.id}
                      onClick={() => handleSemesterSelect(sem)}
                      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">Semester {sem.semester_number}</div>
                      {sem.start_date && (
                        <div className="text-sm text-gray-400">
                          {new Date(sem.start_date).toLocaleDateString()} - {new Date(sem.end_date).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Class */}
          {step === 4 && (
            <div>
              <button onClick={() => setStep(3)} className="text-blue-400 hover:underline mb-4">← Back</button>
              <h2 className="text-xl font-semibold mb-4">Select Class</h2>
              <p className="text-gray-400 text-sm mb-4">
                {selectedDepartment?.name} → {selectedBranch?.name} → Semester {selectedSemester?.semester_number}
              </p>
              {loading ? (
                <div className="text-center py-8 loading">Loading classes...</div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No classes found for this semester.</div>
              ) : (
                <div className="grid gap-3">
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => handleClassSelect(cls)}
                      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">Class {cls.class_number}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Batch */}
          {step === 5 && (
            <div>
              <button onClick={() => setStep(4)} className="text-blue-400 hover:underline mb-4">← Back</button>
              <h2 className="text-xl font-semibold mb-4">Select Batch</h2>
              <p className="text-gray-400 text-sm mb-4">
                {selectedDepartment?.name} → {selectedBranch?.name} → Semester {selectedSemester?.semester_number} → Class {selectedClass?.class_number}
              </p>
              {loading ? (
                <div className="text-center py-8 loading">Loading batches...</div>
              ) : batches.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No batches found. Selecting "No Batch".</div>
              ) : (
                <div className="grid gap-3">
                  {batches.map(batch => (
                    <button
                      key={batch.id}
                      onClick={() => handleBatchSelect(batch)}
                      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">Batch {batch.batch_letter}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedBatch(null); setStep(6) }}
                    className="p-4 bg-gray-600 hover:bg-gray-500 rounded-lg text-left transition"
                  >
                    <div className="text-gray-300">Skip (No Batch)</div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Electives */}
          {step === 6 && (
            <div>
              <button onClick={() => setStep(5)} className="text-blue-400 hover:underline mb-4">← Back</button>
              <h2 className="text-xl font-semibold mb-4">Select Electives</h2>
              <p className="text-gray-400 text-sm mb-4">
                {selectedDepartment?.name} → {selectedBranch?.name} → Semester {selectedSemester?.semester_number} → Class {selectedClass?.class_number} → Batch {selectedBatch?.batch_letter || 'None'}
              </p>

              {electiveSubjects.length === 0 ? (
                <div className="text-center py-4 text-gray-400 mb-4">No elective subjects available.</div>
              ) : (
                <div className="space-y-2 mb-6">
                  <p className="text-sm text-gray-400">Choose your electives:</p>
                  {electiveSubjects.map(subject => (
                    <label key={subject.id} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                      <input
                        type="checkbox"
                        checked={selectedElectives.includes(subject.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedElectives([...selectedElectives, subject.id])
                          } else {
                            setSelectedElectives(selectedElectives.filter(id => id !== subject.id))
                          }
                        }}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-sm text-gray-400">{subject.code}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">Your Subjects</h3>
                <div className="text-sm text-gray-300">
                  <div className="mb-1">Regular: {regularSubjects.length}</div>
                  <div>Electives: {selectedElectives.length}</div>
                </div>
              </div>

              <button
                onClick={handleComplete}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold"
              >
                Complete Setup ✓
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Dashboard Page
function DashboardPage({ onLogout }) {
  const { session } = useAuth()
  const { appContext, setAppContext } = useAppContext()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showContextModal, setShowContextModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const handleChangeContext = () => {
    // Clear context and go back to onboarding
    setAppContext(null)
  }

  // Build context breadcrumb string
  const contextBreadcrumb = appContext ? [
    appContext.department?.name,
    appContext.branch?.abbreviation || appContext.branch?.name,
    appContext.semester?.semester_number ? `Sem ${appContext.semester.semester_number}` : null,
    appContext.class?.class_number ? `Class ${appContext.class.class_number}` : null,
    appContext.batch?.batch_letter ? `Batch ${appContext.batch.batch_letter}` : null
  ].filter(Boolean).join(' → ') : 'Not configured'

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'timetable', label: 'Timetable', icon: '📅' },
    { id: 'ocr', label: 'OCR Scan', icon: '📸' },
    { id: 'manual', label: 'Daily Track', icon: '✏️' },
    { id: 'predictions', label: 'Predictions', icon: '🔮' },
    { id: 'engine-test', label: 'Engine Test', icon: '⚡' },
    { id: 'debug', label: 'Debug', icon: '🔧' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-800 transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎓</span>
            {sidebarOpen && <span className="font-bold">HAJRI</span>}
          </div>

          {/* Context Display */}
          {sidebarOpen && (
            <div className="bg-gray-700/50 rounded-lg p-3 mb-6 border border-gray-600">
              <div className="text-xs text-gray-400 mb-1">Your Selection</div>
              <div className="text-sm text-blue-300 font-medium leading-tight">{contextBreadcrumb}</div>
              <button 
                onClick={handleChangeContext}
                className="mt-2 text-xs text-yellow-400 hover:underline"
              >
                ⚙️ Change Selection
              </button>
            </div>
          )}

          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  activeTab === tab.id ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-700">
          {sidebarOpen && (
            <div className="bg-gray-700 rounded-lg p-3 mb-3">
              <div className="text-xs text-gray-400">Logged in as</div>
              <div className="text-sm truncate">{session?.user?.email}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm"
          >
            {sidebarOpen ? 'Logout' : '🚪'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'timetable' && <TimetableTab />}
          {activeTab === 'ocr' && <OCRTab />}
          {activeTab === 'manual' && <ManualTab />}
          {activeTab === 'predictions' && <PredictionsTab />}
          {activeTab === 'engine-test' && <EngineTestTab />}
          {activeTab === 'debug' && <DebugTab />}
        </div>
      </div>
    </div>
  )
}

// Overview Tab
function OverviewTab() {
  const { appContext } = useAppContext()
  const [summary, setSummary] = useState(null)
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load summary and predictions in parallel
      const [summaryData, predictionsData] = await Promise.all([
        apiCall('GET', '/attendance/summary').catch(() => null),
        apiCall('GET', '/predictions').catch(() => null)
      ])
      setSummary(summaryData)
      setPredictions(predictionsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (percentage) => {
    if (percentage >= 75) return 'text-green-400'
    if (percentage >= 65) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusBg = (percentage) => {
    if (percentage >= 75) return 'bg-green-600/20 border-green-600/30'
    if (percentage >= 65) return 'bg-yellow-600/20 border-yellow-600/30'
    return 'bg-red-600/20 border-red-600/30'
  }

  // Calculate totals from predictions
  const totalCanBunk = predictions?.subjects?.reduce((sum, s) => sum + Math.max(0, s.can_bunk || 0), 0) || 0
  const totalMustAttend = predictions?.subjects?.reduce((sum, s) => sum + Math.max(0, s.must_attend || 0), 0) || 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>

      {/* Academic Context */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📚 Academic Context</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Branch</div>
            <div className="font-semibold">{appContext?.branch?.name || appContext?.branch?.abbreviation || '-'}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Semester</div>
            <div className="font-semibold">{appContext?.semester?.semester_number || '-'}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Batch</div>
            <div className="font-semibold">{appContext?.batch?.batch_letter || appContext?.batch?.name || 'None'}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Electives</div>
            <div className="font-semibold">{appContext?.electives?.length || 0}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-300">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`border rounded-xl p-6 ${summary?.overall_percentage ? getStatusBg(summary.overall_percentage) : 'bg-gray-800'}`}>
          <div className={summary?.overall_percentage ? getStatusColor(summary.overall_percentage) : 'text-gray-400'}>Overall Attendance</div>
          <div className="text-3xl font-bold mt-1">
            {loading ? '...' : summary?.overall_percentage ? `${summary.overall_percentage.toFixed(1)}%` : '--%'}
          </div>
          {summary?.snapshot_at && (
            <div className="text-xs text-gray-500 mt-2">Snapshot: {new Date(summary.snapshot_at).toLocaleDateString()}</div>
          )}
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-600/30 rounded-xl p-6">
          <div className="text-yellow-400 text-sm">Can Bunk</div>
          <div className="text-3xl font-bold mt-1">
            {loading ? '...' : `${totalCanBunk} classes`}
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/30 rounded-xl p-6">
          <div className="text-red-400 text-sm">Must Attend</div>
          <div className="text-3xl font-bold mt-1">
            {loading ? '...' : `${totalMustAttend} classes`}
          </div>
        </div>
      </div>

      {/* Subject-wise Attendance Summary */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📊 Subject-wise Attendance</h2>
        {loading ? (
          <div className="text-center py-8 loading">Loading attendance data...</div>
        ) : !summary?.subjects || summary.subjects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📸</div>
            <p>No attendance data yet.</p>
            <p className="text-sm">Go to OCR Scan to import your first snapshot.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.subjects.map((subject, idx) => {
              const prediction = predictions?.subjects?.find(p => p.subject_id === subject.subject_id)
              return (
                <div key={idx} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{subject.subject_name}</div>
                      <div className="text-sm text-gray-400">
                        {subject.subject_code}
                        {subject.class_type !== 'THEORY' && (
                          <span className="ml-2 px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">
                            {subject.class_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getStatusColor(subject.current_percentage)}`}>
                        {subject.current_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-400">
                        {subject.current_present} / {subject.current_total}
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        subject.current_percentage >= 75 ? 'bg-green-500' :
                        subject.current_percentage >= 65 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, subject.current_percentage)}%` }}
                    />
                  </div>
                  {/* Prediction info */}
                  {prediction && (
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-gray-400">Remaining: {prediction.remaining_classes}</span>
                      {prediction.can_bunk > 0 && (
                        <span className="text-yellow-400">Can bunk: {prediction.can_bunk}</span>
                      )}
                      {prediction.must_attend > 0 && (
                        <span className="text-red-400">Must attend: {prediction.must_attend}</span>
                      )}
                    </div>
                  )}
                  {/* Breakdown */}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Snapshot: {subject.snapshot_present}/{subject.snapshot_total}</span>
                    {(subject.manual_present > 0 || subject.manual_absent > 0) && (
                      <span>Manual: +{subject.manual_present} present, +{subject.manual_absent} absent</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Timetable Tab - Uses V3 schema: timetable_events + course_offerings + timetable_versions
function TimetableTab() {
  const { appContext } = useAppContext()
  const [timetable, setTimetable] = useState([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    loadTimetable()
  }, [appContext?.batch?.id])

  const loadTimetable = async () => {
    setLoading(true)
    const batchId = appContext?.batch?.id
    const debug = { batchId, steps: [] }
    
    try {
      if (!batchId || batchId === 'test') {
        debug.steps.push('No valid batch ID, trying to fetch any published timetable')
        // For testing: get any published version
        const { data: versions, error: vErr } = await supabase
          .from('timetable_versions')
          .select('id, batch_id, status, name')
          .eq('status', 'published')
          .limit(1)
        
        if (vErr) throw vErr
        debug.steps.push(`Found ${versions?.length || 0} published versions`)
        
        if (!versions || versions.length === 0) {
          // Try draft versions
          const { data: drafts } = await supabase
            .from('timetable_versions')
            .select('id, batch_id, status, name')
            .eq('status', 'draft')
            .limit(1)
          debug.steps.push(`Found ${drafts?.length || 0} draft versions`)
          if (drafts?.length > 0) {
            await loadEventsForVersion(drafts[0].id, debug)
          } else {
            setTimetable([])
          }
        } else {
          await loadEventsForVersion(versions[0].id, debug)
        }
      } else {
        // Get published version for this batch
        debug.steps.push(`Looking for published version for batch ${batchId}`)
        const { data: versions, error: vErr } = await supabase
          .from('timetable_versions')
          .select('id, status, name')
          .eq('batch_id', batchId)
          .eq('status', 'published')
          .limit(1)
        
        if (vErr) throw vErr
        debug.steps.push(`Found ${versions?.length || 0} published versions`)
        
        if (!versions || versions.length === 0) {
          // Try draft version for this batch
          const { data: drafts } = await supabase
            .from('timetable_versions')
            .select('id, status, name')
            .eq('batch_id', batchId)
            .eq('status', 'draft')
            .limit(1)
          debug.steps.push(`Found ${drafts?.length || 0} draft versions`)
          
          if (drafts?.length > 0) {
            await loadEventsForVersion(drafts[0].id, debug)
          } else {
            setTimetable([])
          }
        } else {
          await loadEventsForVersion(versions[0].id, debug)
        }
      }
    } catch (err) {
      console.error('Timetable error:', err)
      debug.error = err.message
      setTimetable([])
    } finally {
      setDebugInfo(debug)
      setLoading(false)
    }
  }

  const loadEventsForVersion = async (versionId, debug) => {
    debug.steps.push(`Loading events for version ${versionId}`)
    
    // Get timetable_events with offering_id
    const { data: events, error: evErr } = await supabase
      .from('timetable_events')
      .select('id, day_of_week, start_time, end_time, room_id, offering_id')
      .eq('version_id', versionId)
      .order('day_of_week')
      .order('start_time')
    
    if (evErr) throw evErr
    debug.steps.push(`Found ${events?.length || 0} events`)
    
    if (!events || events.length === 0) {
      setTimetable([])
      return
    }
    
    // Get unique offering IDs and room IDs
    const offeringIds = [...new Set(events.map(e => e.offering_id).filter(Boolean))]
    const roomIds = [...new Set(events.map(e => e.room_id).filter(Boolean))]
    
    // Fetch offerings with subject and faculty info
    const { data: offerings, error: offErr } = await supabase
      .from('course_offerings')
      .select('id, subject_id, faculty_id, default_room_id')
      .in('id', offeringIds)
    
    if (offErr) throw offErr
    debug.steps.push(`Found ${offerings?.length || 0} offerings`)
    
    // Get all subject/faculty/room IDs from offerings
    const subjectIds = [...new Set(offerings?.map(o => o.subject_id).filter(Boolean) || [])]
    const facultyIds = [...new Set(offerings?.map(o => o.faculty_id).filter(Boolean) || [])]
    const allRoomIds = [...new Set([
      ...roomIds,
      ...(offerings?.map(o => o.default_room_id).filter(Boolean) || [])
    ])]
    
    // Fetch related data in parallel
    const [subjectsRes, facultyRes, roomsRes] = await Promise.all([
      subjectIds.length ? supabase.from('subjects').select('id, name, code, type').in('id', subjectIds) : { data: [] },
      facultyIds.length ? supabase.from('faculty').select('id, name, abbr').in('id', facultyIds) : { data: [] },
      allRoomIds.length ? supabase.from('rooms').select('id, room_number').in('id', allRoomIds) : { data: [] }
    ])
    
    debug.steps.push(`Subjects: ${subjectsRes.data?.length || 0}, Faculty: ${facultyRes.data?.length || 0}, Rooms: ${roomsRes.data?.length || 0}`)
    
    // Create lookup maps
    const subjectMap = Object.fromEntries((subjectsRes.data || []).map(s => [s.id, s]))
    const facultyMap = Object.fromEntries((facultyRes.data || []).map(f => [f.id, f]))
    const roomMap = Object.fromEntries((roomsRes.data || []).map(r => [r.id, r]))
    const offeringMap = Object.fromEntries((offerings || []).map(o => [o.id, o]))
    
    // Enrich events
    const enriched = events.map(event => {
      const offering = offeringMap[event.offering_id]
      const subject = offering ? subjectMap[offering.subject_id] : null
      const faculty = offering ? facultyMap[offering.faculty_id] : null
      const room = roomMap[event.room_id] || (offering ? roomMap[offering.default_room_id] : null)
      
      return {
        ...event,
        subject,
        faculty,
        room
      }
    })
    
    debug.steps.push(`Enriched ${enriched.length} events`)
    setTimetable(enriched)
  }

  // Schema uses: 0=Monday, 1=Tuesday, etc.
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayMap = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 }

  const getEntriesForDay = (day) => {
    return timetable.filter(t => t.day_of_week === dayMap[day])
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📅 Weekly Timetable</h1>

      {/* Debug info for development */}
      {debugInfo && (
        <div className="mb-4 p-3 bg-gray-700/50 rounded-lg text-xs text-gray-400">
          <details>
            <summary className="cursor-pointer">Debug Info ({timetable.length} events)</summary>
            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 loading">Loading timetable...</div>
      ) : timetable.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-gray-400">No timetable events found.</p>
          <p className="text-sm text-gray-500 mt-2">
            Make sure you have:
            <br />1. Course offerings created for your batch
            <br />2. A timetable version (draft or published) for your batch
            <br />3. Events added to that timetable version
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {days.map(day => {
            const dayEntries = getEntriesForDay(day)
            return (
              <div key={day} className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                  <h3 className="font-semibold">{day}</h3>
                  <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">{dayEntries.length}</span>
                </div>
                <div className="p-4 space-y-2">
                  {dayEntries.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">No classes</div>
                  ) : (
                    dayEntries.map(entry => (
                      <div key={entry.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-medium text-blue-300">
                            {entry.subject?.code || 'N/A'}
                            {entry.subject?.type === 'LAB' && <span className="ml-1 text-xs bg-purple-600 px-1 rounded">LAB</span>}
                          </div>
                          <div className="text-xs text-gray-400">
                            {entry.start_time?.slice(0, 5)} - {entry.end_time?.slice(0, 5)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-300">{entry.subject?.name || 'Unknown Subject'}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {entry.faculty && `👤 ${entry.faculty.abbr || entry.faculty.name}`}
                          {entry.room && ` • 🏫 ${entry.room.room_number}`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// OCR Tab
function OCRTab() {
  const { session } = useAuth()
  const { appContext } = useAppContext()
  const [step, setStep] = useState('upload') // upload, review, confirm, done
  const [ocrResult, setOcrResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0])
  const [ocrStatus, setOcrStatus] = useState('checking') // checking, online, offline

  // Check OCR service status on mount
  useEffect(() => {
    const checkOcrStatus = async () => {
      try {
        const response = await fetch(`${OCR_URL}/health`)
        if (response.ok) {
          setOcrStatus('online')
        } else {
          setOcrStatus('offline')
        }
      } catch {
        setOcrStatus('offline')
      }
    }
    checkOcrStatus()
  }, [])

  // Call real OCR service
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      // Call the real hajri-ocr service
      const result = await ocrExtract(file)
      
      if (!result.success) {
        throw new Error(result.message || 'OCR extraction failed')
      }

      // Transform OCR response to our format
      // hajri-ocr returns: { course_code, course_name, class_type, present, total, percentage, confidence }
      // We map to: { subject_code, subject_name, present, total, percentage, class_type }
      const transformedEntries = (result.entries || []).map(entry => ({
        subject_code: entry.course_code || '',
        subject_name: entry.course_name || entry.shortname || '',
        present: entry.present || 0,
        total: entry.total || 0,
        percentage: entry.percentage || 0,
        class_type: entry.class_type === 'LAB' ? 'LAB' : 'THEORY',
        confidence: entry.confidence || 0,
      }))

      if (transformedEntries.length === 0) {
        throw new Error('No attendance entries found in the image. Please try a clearer screenshot.')
      }

      setOcrResult(transformedEntries)
      setStep('review')
    } catch (err) {
      // Provide helpful error messages
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError(`OCR service is not reachable at ${OCR_URL}. Make sure hajri-ocr is running.`)
      } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('OCR API authentication failed. Check your OCR_API_KEY configuration.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEntryChange = (index, field, value) => {
    const updated = [...ocrResult]
    updated[index][field] = field === 'present' || field === 'total' ? parseInt(value) || 0 : value
    if (field === 'present' || field === 'total') {
      updated[index].percentage = updated[index].total > 0 
        ? ((updated[index].present / updated[index].total) * 100).toFixed(2) 
        : 0
    }
    setOcrResult(updated)
  }

  const handleRemoveEntry = (index) => {
    setOcrResult(ocrResult.filter((_, i) => i !== index))
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)

    try {
      // Transform to engine's expected format (SnapshotConfirmRequest)
      const entries = ocrResult.map(r => ({
        course_code: r.subject_code,
        course_name: r.subject_name,
        class_type: r.class_type === 'LAB' ? 'LAB' : 'LECT',
        present: r.present,
        total: r.total,
        percentage: parseFloat(r.percentage) || 0,
        confidence: r.confidence || 0.9
      }))

      await apiCall('POST', '/snapshots/confirm', {
        captured_at: new Date(snapshotDate).toISOString(),
        source_type: 'university_portal',
        entries,
        confirm_decreases: false
      })

      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📸 OCR Attendance Scan</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-gray-800 rounded-xl p-8">
          <div className="max-w-md mx-auto text-center">
            {/* OCR Service Status */}
            <div className="mb-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                ocrStatus === 'online' ? 'bg-green-900/50 text-green-400 border border-green-700' :
                ocrStatus === 'offline' ? 'bg-red-900/50 text-red-400 border border-red-700' :
                'bg-gray-700 text-gray-400 border border-gray-600'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  ocrStatus === 'online' ? 'bg-green-400' :
                  ocrStatus === 'offline' ? 'bg-red-400' :
                  'bg-gray-400 animate-pulse'
                }`}></span>
                OCR Service: {ocrStatus === 'online' ? 'Online' : ocrStatus === 'offline' ? 'Offline' : 'Checking...'}
              </span>
            </div>

            <div className="text-6xl mb-4">📷</div>
            <h2 className="text-xl font-semibold mb-2">Upload Attendance Screenshot</h2>
            <p className="text-gray-400 mb-4">Take a photo of your college attendance board and upload it here.</p>
            <p className="text-xs text-gray-500 mb-6">Powered by hajri-ocr → PaddleOCR PP-Structure</p>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Snapshot Date</label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600"
              />
            </div>

            <label className={`block ${ocrStatus === 'offline' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className={`border-2 border-dashed rounded-xl p-8 transition ${
                ocrStatus === 'offline' 
                  ? 'border-gray-700 cursor-not-allowed' 
                  : 'border-gray-600 hover:border-blue-500 cursor-pointer'
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={ocrStatus === 'offline'}
                />
                {loading ? (
                  <div>
                    <div className="loading">Processing image with OCR...</div>
                    <p className="text-xs text-gray-500 mt-2">This may take a few seconds</p>
                  </div>
                ) : ocrStatus === 'offline' ? (
                  <div>
                    <div className="text-4xl mb-2">⚠️</div>
                    <div className="text-red-400">OCR service unavailable</div>
                    <p className="text-xs text-gray-500 mt-2">Start hajri-ocr on {OCR_URL}</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📤</div>
                    <div>Click to upload image</div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && ocrResult && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Review OCR Results</h2>
              <p className="text-gray-400 text-sm">Verify and correct any errors before confirming</p>
            </div>
            <div className="text-sm text-gray-400">
              Snapshot Date: <strong>{snapshotDate}</strong>
            </div>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Subject</th>
                  <th className="p-3 text-center">Present</th>
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-center">%</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">Confidence</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {ocrResult.map((entry, idx) => (
                  <tr key={idx} className="border-t border-gray-700">
                    <td className="p-3">
                      <input
                        type="text"
                        value={entry.subject_code}
                        onChange={(e) => handleEntryChange(idx, 'subject_code', e.target.value)}
                        className="w-20 px-2 py-1 bg-gray-700 rounded border border-gray-600"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={entry.subject_name}
                        onChange={(e) => handleEntryChange(idx, 'subject_name', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={entry.present}
                        onChange={(e) => handleEntryChange(idx, 'present', e.target.value)}
                        className="w-16 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-center"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={entry.total}
                        onChange={(e) => handleEntryChange(idx, 'total', e.target.value)}
                        className="w-16 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-center"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-medium ${entry.percentage >= 75 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.percentage}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <select
                        value={entry.class_type}
                        onChange={(e) => handleEntryChange(idx, 'class_type', e.target.value)}
                        className="px-2 py-1 bg-gray-700 rounded border border-gray-600"
                      >
                        <option value="THEORY">Theory</option>
                        <option value="LAB">Lab</option>
                        <option value="TUTORIAL">Tutorial</option>
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      {entry.confidence !== undefined ? (
                        <span className={`text-xs px-2 py-1 rounded ${
                          entry.confidence >= 0.9 ? 'bg-green-900/50 text-green-400' :
                          entry.confidence >= 0.7 ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-red-900/50 text-red-400'
                        }`}>
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveEntry(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { setStep('upload'); setOcrResult(null) }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              ← Re-upload
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Confirming...' : '✓ Confirm Snapshot'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">Snapshot Confirmed!</h2>
          <p className="text-gray-400 mb-6">
            Attendance synced on <strong>{snapshotDate}</strong>
          </p>
          <p className="text-sm text-yellow-400 mb-6">
            ⚠️ Manual entries before this date are now locked.
          </p>
          <button
            onClick={() => { setStep('upload'); setOcrResult(null) }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            Upload Another Snapshot
          </button>
        </div>
      )}
    </div>
  )
}

// Manual Tracking Tab
function ManualTab() {
  const { session } = useAuth()
  const { appContext } = useAppContext()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [periods, setPeriods] = useState([]) // Timetable periods for selected day
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [snapshotDate, setSnapshotDate] = useState(null)

  // Day names for display
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Load timetable periods when date changes
  useEffect(() => {
    loadPeriodsForDate()
    setAttendance({}) // Reset attendance when date changes
  }, [date, appContext?.batch?.id])

  const loadPeriodsForDate = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const batchId = appContext?.batch?.id
      
      // Get day of week (0=Sunday, 1=Monday, etc.)
      const selectedDate = new Date(date)
      const dayOfWeek = selectedDate.getDay()
      
      // Check if it's a weekend (Sunday)
      if (dayOfWeek === 0) {
        setPeriods([])
        setLoading(false)
        return
      }

      // Get published timetable version for this batch
      let versionId = null
      
      if (batchId && batchId !== 'test') {
        const { data: versions } = await supabase
          .from('timetable_versions')
          .select('id')
          .eq('batch_id', batchId)
          .eq('status', 'published')
          .limit(1)
        
        if (versions?.length > 0) {
          versionId = versions[0].id
        } else {
          // Try draft version
          const { data: drafts } = await supabase
            .from('timetable_versions')
            .select('id')
            .eq('batch_id', batchId)
            .eq('status', 'draft')
            .limit(1)
          if (drafts?.length > 0) {
            versionId = drafts[0].id
          }
        }
      } else {
        // For testing: get any published version
        const { data: versions } = await supabase
          .from('timetable_versions')
          .select('id')
          .eq('status', 'published')
          .limit(1)
        
        if (versions?.length > 0) {
          versionId = versions[0].id
        }
      }

      if (!versionId) {
        setPeriods([])
        setLoading(false)
        return
      }

      // Get timetable events for this day
      const { data: events, error: evErr } = await supabase
        .from('timetable_events')
        .select('id, day_of_week, start_time, end_time, room_id, offering_id')
        .eq('version_id', versionId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time')
      
      if (evErr) throw evErr
      
      if (!events || events.length === 0) {
        setPeriods([])
        setLoading(false)
        return
      }

      // Get offering IDs
      const offeringIds = [...new Set(events.map(e => e.offering_id).filter(Boolean))]
      
      // Fetch offerings with subject info
      const { data: offerings } = await supabase
        .from('course_offerings')
        .select('id, subject_id')
        .in('id', offeringIds)
      
      const offeringMap = Object.fromEntries((offerings || []).map(o => [o.id, o]))
      
      // Get subject IDs
      const subjectIds = [...new Set((offerings || []).map(o => o.subject_id).filter(Boolean))]
      
      // Fetch subjects
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, code, type')
        .in('id', subjectIds)
      
      const subjectMap = Object.fromEntries((subjects || []).map(s => [s.id, s]))

      // Build periods with subject info
      const periodsData = events.map((event, index) => {
        const offering = offeringMap[event.offering_id]
        const subject = offering ? subjectMap[offering.subject_id] : null
        return {
          id: event.id,
          periodNumber: index + 1,
          startTime: event.start_time,
          endTime: event.end_time,
          subject: subject,
          classType: subject?.type || 'THEORY'
        }
      }).filter(p => p.subject) // Only show periods with valid subjects

      setPeriods(periodsData)
    } catch (err) {
      setError(err.message)
      setPeriods([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (periodId, status) => {
    setAttendance(prev => ({
      ...prev,
      [periodId]: prev[periodId] === status ? null : status
    }))
  }

  const handleSubmit = async () => {
    // Check if date is after snapshot
    if (snapshotDate && date <= snapshotDate) {
      setError(`Cannot add attendance before snapshot date (${snapshotDate}). Upload a new OCR snapshot instead.`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const entries = Object.entries(attendance).filter(([_, status]) => status)
      
      for (const [periodId, status] of entries) {
        const period = periods.find(p => p.id === periodId)
        if (!period) continue
        
        await apiCall('POST', '/attendance/manual', {
          student_id: session.user.id,
          subject_id: period.subject.id,
          event_date: date,
          period_number: period.periodNumber,
          class_type: period.classType,
          status: status
        })
      }

      // Show success and reload periods to reflect saved state
      alert('Attendance saved successfully!')
      // Don't reset attendance state - keep the buttons colored
      // User can change date to track another day
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const selectedDayName = dayNames[new Date(date).getDay()]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">✏️ Daily Attendance Tracking</h1>

      {snapshotDate && (
        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-700 rounded-xl">
          <div className="flex items-center gap-2">
            <span>📸</span>
            <span>Last snapshot: <strong>{snapshotDate}</strong></span>
          </div>
          <p className="text-sm text-gray-400 mt-1">You can only add attendance for dates after this.</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-3 bg-gray-700 rounded-lg border border-gray-600"
            />
          </div>
          <div className="pt-6">
            <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-lg text-sm">
              {selectedDayName}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 loading">Loading timetable...</div>
        ) : new Date(date).getDay() === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🌴</div>
            <div>Sunday - No classes scheduled</div>
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📅</div>
            <div>No classes scheduled for {selectedDayName}</div>
            <p className="text-sm mt-2">Check if timetable is configured for your batch</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-400 mb-4">
              {periods.length} period{periods.length !== 1 ? 's' : ''} scheduled for {selectedDayName}
            </div>
            <div className="space-y-3 mb-6">
              {periods.map(period => (
                <div key={period.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-center bg-gray-600 rounded-lg px-3 py-2 min-w-[60px]">
                      <div className="text-xs text-gray-400">Period</div>
                      <div className="font-bold">{period.periodNumber}</div>
                    </div>
                    <div>
                      <div className="font-medium">{period.subject.name}</div>
                      <div className="text-sm text-gray-400">
                        {period.subject.code} • {period.startTime?.slice(0, 5)} - {period.endTime?.slice(0, 5)}
                      </div>
                    </div>
                    {period.classType !== 'THEORY' && (
                      <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs">
                        {period.classType}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(period.id, 'PRESENT')}
                      className={`px-4 py-2 rounded-lg transition ${
                        attendance[period.id] === 'PRESENT'
                          ? 'bg-green-600'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      ✓ Present
                    </button>
                    <button
                      onClick={() => handleToggle(period.id, 'ABSENT')}
                      className={`px-4 py-2 rounded-lg transition ${
                        attendance[period.id] === 'ABSENT'
                          ? 'bg-red-600'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      ✕ Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || Object.values(attendance).filter(Boolean).length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Attendance'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Predictions Tab
function PredictionsTab() {
  const { session } = useAuth()
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [targetPercentage, setTargetPercentage] = useState(75)

  useEffect(() => {
    loadPredictions()
  }, [targetPercentage])

  const loadPredictions = async () => {
    setLoading(true)
    setError(null)
    try {
      // The predictions endpoint uses the auth token to identify the user
      // No user ID in path needed
      const data = await apiCall('GET', `/predictions`)
      setPredictions(data)
    } catch (err) {
      console.error('Predictions error:', err)
      setError(err.message)
      // Show mock data for testing when engine returns error
      setPredictions(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🔮 Attendance Predictions</h1>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">Target Percentage</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="50"
            max="100"
            value={targetPercentage}
            onChange={(e) => setTargetPercentage(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-xl font-bold w-16">{targetPercentage}%</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 loading">Calculating predictions...</div>
      ) : !predictions ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-400">No predictions available.</p>
          <p className="text-sm text-gray-500">Upload an OCR snapshot first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {predictions.subjects?.map((pred, idx) => (
            <div key={idx} className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg">{pred.subject_name}</div>
                  <div className="text-sm text-gray-400">{pred.subject_code}</div>
                </div>
                <div className={`text-2xl font-bold ${pred.current_percentage >= targetPercentage ? 'text-green-400' : 'text-red-400'}`}>
                  {pred.current_percentage?.toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-400">Present/Total</div>
                  <div className="text-xl font-semibold">{pred.attended}/{pred.total}</div>
                </div>
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-400">Can Bunk</div>
                  <div className="text-xl font-semibold text-green-400">{pred.can_bunk || 0}</div>
                </div>
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
                  <div className="text-sm text-red-400">Must Attend</div>
                  <div className="text-xl font-semibold text-red-400">{pred.must_attend || 0}</div>
                </div>
              </div>

              {pred.status === 'CRITICAL' && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  ⚠️ Critical: You need to attend {pred.must_attend} more classes to reach {targetPercentage}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Engine Test Tab - Comprehensive engine testing workflow
function EngineTestTab() {
  const { session } = useAuth()
  const { appContext } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('context')
  const [data, setData] = useState({
    context: null,
    semesterTotals: null,
    snapshot: null,
    summary: null,
    predictions: null,
    manualAttendance: []
  })
  const [testLog, setTestLog] = useState([])
  
  // Manual attendance form state
  const [manualForm, setManualForm] = useState({
    subjectId: '',
    startDate: new Date().toISOString().split('T')[0],
    numDays: 10,
    pattern: 'PPPPPPPPPP',
    classType: 'LECTURE'
  })
  const [editingEntry, setEditingEntry] = useState(null)

  const studentId = DEV_MODE ? TEST_STUDENT_ID : session?.user?.id

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setTestLog(prev => [...prev, { message: `[${timestamp}] ${message}`, type }])
  }

  const clearLog = () => setTestLog([])

  // ===========================================
  // STEP 1: Load Full Context
  // ===========================================
  const loadFullContext = async () => {
    setLoading(true)
    clearLog()
    addLog('📡 Loading full student context from engine...', 'info')

    try {
      const response = await apiCall('GET', `/engine/debug/student-context?student_id=${studentId}`)
      
      if (response.error) {
        addLog(`❌ ${response.error}`, 'error')
        return
      }

      setData(prev => ({ 
        ...prev, 
        context: response,
        manualAttendance: response.manual_attendance || []
      }))
      
      addLog(`✅ Student: ${response.app_user?.student_name || 'Unknown'}`, 'success')
      addLog(`   Batch ID: ${response.app_user?.batch_id}`, 'info')
      addLog(`   Semester ID: ${response.app_user?.semester_id}`, 'info')
      addLog(`   Subjects: ${response.subjects_count}`, 'info')
      addLog(`   Timetable Events: ${response.timetable?.events_count || 0}`, 'info')
      addLog(`   Snapshot: ${response.snapshot ? '✅ Found' : '❌ None'}`, response.snapshot ? 'success' : 'warning')
      addLog(`   Manual Entries: ${response.manual_attendance?.length || 0}`, 'info')
      addLog(`   Summary Records: ${response.attendance_summary?.length || 0}`, 'info')
      addLog(`   Prediction Records: ${response.predictions?.length || 0}`, 'info')

    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // STEP 2: Calculate Semester Totals (Admin)
  // ===========================================
  const calculateSemesterTotals = async () => {
    if (!data.context) {
      addLog('❌ Load context first!', 'error')
      return
    }

    setLoading(true)
    addLog('📊 Calculating semester totals (Pre-Process 1)...', 'info')
    addLog('   This counts total lectures per subject for entire semester', 'info')

    try {
      const { batch_id, semester_id } = data.context.app_user
      const response = await apiCall('POST', 
        `/engine/admin/calculate-semester-totals?batch_id=${batch_id}&semester_id=${semester_id}&persist=true`
      )

      if (response.status === 'error') {
        addLog(`❌ ${response.message}`, 'error')
        return
      }

      setData(prev => ({ ...prev, semesterTotals: response }))
      
      addLog(`✅ Calculated ${response.subjects_calculated} subjects in ${response.duration_ms}ms`, 'success')
      
      for (const subj of response.subjects || []) {
        addLog(`   ${subj.subject_code}: ${subj.slots_per_week}/week → ${subj.total_classes_in_semester} total`, 'info')
      }

    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // STEP 3: Create Test Snapshot
  // ===========================================
  const createTestSnapshot = async () => {
    if (!data.context) {
      addLog('❌ Load context first!', 'error')
      return
    }

    setLoading(true)
    addLog('📸 Creating test OCR snapshot...', 'info')

    try {
      // Build entries from subjects
      const entries = data.context.subjects.map(subj => ({
        course_code: subj.code,
        course_name: subj.name,
        class_type: subj.type || 'LECTURE',
        present: subj.type === 'LAB' ? 8 : 25,
        total: subj.type === 'LAB' ? 10 : 30,
        percentage: subj.type === 'LAB' ? 80.0 : 83.33
      }))

      addLog(`   Entries: ${entries.length} subjects`, 'info')
      for (const e of entries) {
        addLog(`   ${e.course_code}: ${e.present}/${e.total} (${e.percentage.toFixed(1)}%)`, 'info')
      }

      const response = await apiCall('POST', '/snapshots/confirm', {
        captured_at: new Date().toISOString(),
        source_type: 'test_portal',
        entries: entries
      })

      addLog(`✅ Snapshot created: ${response.snapshot_id}`, 'success')
      addLog(`   Matched: ${response.entries_processed - (response.unmatched_codes?.length || 0)}`, 'info')
      if (response.unmatched_codes?.length > 0) {
        addLog(`   ⚠️ Unmatched: ${response.unmatched_codes.join(', ')}`, 'warning')
      }

      // Reload context to get snapshot
      await loadFullContext()

    } catch (err) {
      addLog(`❌ Snapshot error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // STEP 4: Trigger Recompute
  // ===========================================
  const triggerRecompute = async () => {
    setLoading(true)
    addLog('⚡ Triggering engine recompute...', 'info')

    try {
      const response = await apiCall('POST', '/engine/recompute', {
        student_id: studentId
      })

      addLog(`✅ Recompute complete!`, 'success')
      addLog(`   Subjects updated: ${response.subjects_updated}`, 'info')
      addLog(`   Duration: ${response.duration_ms}ms`, 'info')
      addLog(`   Status: ${response.status}`, 'info')

      // Reload to get new data
      await loadFullContext()

    } catch (err) {
      addLog(`❌ Recompute error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // STEP 5: View Detailed Results
  // ===========================================
  const loadDetailedResults = async () => {
    setLoading(true)
    addLog('📋 Loading detailed attendance results...', 'info')

    try {
      const summary = await apiCall('GET', '/attendance/summary')
      const predictions = await apiCall('GET', '/predictions')
      
      setData(prev => ({ ...prev, summary, predictions }))

      addLog(`✅ Summary: ${summary.subjects?.length || 0} subjects`, 'success')
      addLog(`   Overall: ${summary.overall_percentage?.toFixed(1)}% (${summary.overall_present}/${summary.overall_total})`, 'info')

      addLog(`✅ Predictions loaded`, 'success')
      const totalCanBunk = predictions.subjects?.reduce((sum, s) => sum + Math.max(0, s.can_bunk || 0), 0) || 0
      addLog(`   Total bunkable: ${totalCanBunk} classes`, 'info')

    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // MANUAL ATTENDANCE FUNCTIONS
  // ===========================================
  
  // Add bulk manual attendance (10 days)
  const addBulkManualAttendance = async () => {
    if (!manualForm.subjectId) {
      addLog('❌ Select a subject first!', 'error')
      return
    }
    
    setLoading(true)
    addLog(`📝 Adding ${manualForm.numDays} days of manual attendance...`, 'info')
    addLog(`   Subject: ${manualForm.subjectId.substring(0, 8)}...`, 'info')
    addLog(`   Pattern: ${manualForm.pattern}`, 'info')
    
    try {
      const params = new URLSearchParams({
        student_id: studentId,
        subject_id: manualForm.subjectId,
        start_date: manualForm.startDate,
        num_days: manualForm.numDays,
        pattern: manualForm.pattern,
        class_type: manualForm.classType
      })
      
      const response = await apiCall('POST', `/engine/test/bulk-manual-attendance?${params}`)
      
      if (response.error) {
        addLog(`❌ ${response.error}`, 'error')
        return
      }
      
      addLog(`✅ Created ${response.entries_created} entries`, 'success')
      for (const entry of response.entries || []) {
        addLog(`   ${entry.date}: ${entry.status} (${entry.action})`, 'info')
      }
      
      // Reload to see new entries
      await loadFullContext()
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }
  
  // Update a single manual attendance entry
  const updateManualEntry = async (entryId, newStatus) => {
    setLoading(true)
    addLog(`✏️ Updating entry ${entryId.substring(0, 8)}... to ${newStatus}`, 'info')
    
    try {
      const response = await apiCall('PUT', `/engine/test/manual-attendance/${entryId}?status=${newStatus}`)
      
      if (response.error) {
        addLog(`❌ ${response.error}`, 'error')
        return
      }
      
      addLog(`✅ Updated to ${newStatus}`, 'success')
      setEditingEntry(null)
      
      // Reload to see changes
      await loadFullContext()
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }
  
  // Delete a single manual attendance entry
  const deleteManualEntry = async (entryId) => {
    setLoading(true)
    addLog(`🗑️ Deleting entry ${entryId.substring(0, 8)}...`, 'info')
    
    try {
      const response = await apiCall('DELETE', `/engine/test/manual-attendance/${entryId}`)
      
      if (response.error) {
        addLog(`❌ ${response.error}`, 'error')
        return
      }
      
      addLog(`✅ Deleted`, 'success')
      
      // Reload to see changes
      await loadFullContext()
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }
  
  // Clear all manual attendance
  const clearAllManualAttendance = async () => {
    setLoading(true)
    addLog(`🗑️ Clearing ALL manual attendance entries...`, 'warning')
    
    try {
      const response = await apiCall('DELETE', `/engine/test/clear-manual-attendance/${studentId}`)
      
      if (response.error) {
        addLog(`❌ ${response.error}`, 'error')
        return
      }
      
      addLog(`✅ Cleared ${response.entries_deleted} entries`, 'success')
      
      // Reload
      await loadFullContext()
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ===========================================
  // FULL TEST FLOW
  // ===========================================
  const runFullTest = async () => {
    clearLog()
    addLog('🚀 Starting full engine test...', 'info')
    addLog('═══════════════════════════════════════', 'info')
    
    // Step 1: Load context
    await loadFullContext()
    
    if (!data.context) {
      addLog('❌ Cannot proceed without context', 'error')
      return
    }

    // Step 2: Calculate semester totals
    addLog('', 'info')
    addLog('═══════════════════════════════════════', 'info')
    await calculateSemesterTotals()

    // Step 3: Create snapshot if needed
    if (!data.context?.snapshot) {
      addLog('', 'info')
      addLog('═══════════════════════════════════════', 'info')
      await createTestSnapshot()
    }

    // Step 4: Recompute
    addLog('', 'info')
    addLog('═══════════════════════════════════════', 'info')
    await triggerRecompute()

    // Step 5: Load results
    addLog('', 'info')
    addLog('═══════════════════════════════════════', 'info')
    await loadDetailedResults()

    addLog('', 'info')
    addLog('═══════════════════════════════════════', 'info')
    addLog('🎉 FULL TEST COMPLETE!', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">⚡ Engine Test Suite</h1>
        <div className="text-sm text-gray-400">
          Student: <code className="bg-gray-800 px-2 py-1 rounded">{studentId?.substring(0, 8)}...</code>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          <button onClick={loadFullContext} disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50">
            1️⃣ Load Context
          </button>
          <button onClick={calculateSemesterTotals} disabled={loading || !data.context}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium disabled:opacity-50">
            2️⃣ Calc Semester Totals
          </button>
          <button onClick={createTestSnapshot} disabled={loading || !data.context}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-medium disabled:opacity-50">
            3️⃣ Create Snapshot
          </button>
          <button onClick={triggerRecompute} disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium disabled:opacity-50">
            4️⃣ Recompute
          </button>
          <button onClick={loadDetailedResults} disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium disabled:opacity-50">
            5️⃣ View Results
          </button>
          <div className="flex-1" />
          <button onClick={runFullTest} disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-bold disabled:opacity-50">
            🚀 Run Full Test
          </button>
          <button onClick={() => { clearLog(); setData({ context: null, semesterTotals: null, snapshot: null, summary: null, predictions: null }) }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Test Log */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">📜 Test Log</h2>
          <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-auto font-mono text-xs">
            {testLog.length === 0 ? (
              <div className="text-gray-500">Click "Load Context" or "Run Full Test" to start...</div>
            ) : (
              testLog.map((log, i) => (
                <div key={i} className={`mb-1 whitespace-pre-wrap ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                }`}>
                  {log.message}
                </div>
              ))
            )}
            {loading && <div className="text-blue-400 animate-pulse">⏳ Processing...</div>}
          </div>
        </div>

        {/* Data Display */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex gap-2 mb-4 flex-wrap">
            {['context', 'subjects', 'snapshot', 'manual', 'summary', 'predictions'].map(section => (
              <button key={section} onClick={() => setActiveSection(section)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  activeSection === section ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {section.charAt(0).toUpperCase() + section.slice(1)}
                {section === 'manual' && data.manualAttendance?.length > 0 && 
                  <span className="ml-1 bg-orange-500 text-xs px-1 rounded">{data.manualAttendance.length}</span>
                }
              </button>
            ))}
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-auto text-sm">
            {activeSection === 'context' && (
              <div className="space-y-3">
                <h3 className="font-bold text-blue-400">Student Context</h3>
                {data.context ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-800 p-2 rounded">
                        <span className="text-gray-400">Name:</span> {data.context.app_user?.student_name || 'N/A'}
                      </div>
                      <div className="bg-gray-800 p-2 rounded">
                        <span className="text-gray-400">Subjects:</span> {data.context.subjects_count}
                      </div>
                      <div className="bg-gray-800 p-2 rounded col-span-2">
                        <span className="text-gray-400">Batch:</span> {data.context.app_user?.batch_id?.substring(0, 8)}...
                      </div>
                      <div className="bg-gray-800 p-2 rounded col-span-2">
                        <span className="text-gray-400">Timetable:</span> {data.context.timetable?.version?.name || 'None'} 
                        ({data.context.timetable?.events_count || 0} events)
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className={data.context.snapshot ? 'text-green-400' : 'text-red-400'}>
                        Snapshot: {data.context.snapshot ? '✅ Yes' : '❌ None'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">Click "Load Context" to fetch data</div>
                )}
              </div>
            )}

            {activeSection === 'subjects' && (
              <div className="space-y-2">
                <h3 className="font-bold text-purple-400">Subjects ({data.context?.subjects?.length || 0})</h3>
                {data.context?.subjects?.map((subj, i) => (
                  <div key={i} className="bg-gray-800 p-2 rounded text-xs flex justify-between">
                    <span><strong>{subj.code}</strong> - {subj.name}</span>
                    <span className={subj.type === 'LAB' ? 'text-yellow-400' : 'text-blue-400'}>{subj.type}</span>
                  </div>
                )) || <div className="text-gray-500">No subjects loaded</div>}
                
                {data.semesterTotals && (
                  <div className="mt-4">
                    <h4 className="font-bold text-green-400 mb-2">Semester Totals (Pre-Process 1)</h4>
                    {data.semesterTotals.subjects?.map((subj, i) => (
                      <div key={i} className="bg-gray-800 p-2 rounded text-xs mb-1">
                        <strong>{subj.subject_code}</strong>: {subj.slots_per_week}/week 
                        → <span className="text-green-400">{subj.total_classes_in_semester} total</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'snapshot' && (
              <div className="space-y-2">
                <h3 className="font-bold text-yellow-400">OCR Snapshot</h3>
                {data.context?.snapshot ? (
                  <>
                    <div className="text-xs text-gray-400 mb-2">
                      Captured: {new Date(data.context.snapshot.captured_at).toLocaleString()}<br/>
                      Confirmed: {new Date(data.context.snapshot.confirmed_at).toLocaleString()}
                    </div>
                    <h4 className="font-semibold text-sm mt-3 mb-2">Entries:</h4>
                    {data.context.snapshot.entries?.map((e, i) => (
                      <div key={i} className="bg-gray-800 p-2 rounded text-xs mb-1 flex justify-between">
                        <span><strong>{e.course_code}</strong> {e.course_name}</span>
                        <span className={e.percentage >= 75 ? 'text-green-400' : 'text-red-400'}>
                          {e.present}/{e.total} ({e.percentage?.toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-gray-500">No snapshot. Click "Create Snapshot" to create one.</div>
                )}
              </div>
            )}

            {activeSection === 'manual' && (
              <div className="space-y-2">
                <h3 className="font-bold text-orange-400">Manual Attendance Entries</h3>
                <div className="text-xs text-gray-400 mb-2">
                  These are attendance records AFTER the snapshot date
                </div>
                
                {data.manualAttendance?.length > 0 ? (
                  <>
                    <div className="text-xs text-gray-400 mb-2">
                      Total: {data.manualAttendance.length} entries | 
                      Present: {data.manualAttendance.filter(e => e.status === 'PRESENT').length} | 
                      Absent: {data.manualAttendance.filter(e => e.status === 'ABSENT').length}
                    </div>
                    {data.manualAttendance.map((entry, i) => (
                      <div key={i} className={`p-2 rounded text-xs mb-1 flex justify-between items-center ${
                        entry.status === 'PRESENT' ? 'bg-green-900/30 border border-green-700' :
                        entry.status === 'ABSENT' ? 'bg-red-900/30 border border-red-700' :
                        'bg-gray-800'
                      }`}>
                        <div>
                          <strong>{entry.subjects?.code || entry.subject_id?.substring(0, 8)}</strong>
                          <span className="text-gray-400 ml-2">{entry.event_date}</span>
                          <span className={`ml-2 ${entry.class_type === 'LAB' ? 'text-yellow-400' : 'text-blue-400'}`}>
                            {entry.class_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={entry.status === 'PRESENT' ? 'text-green-400' : 'text-red-400'}>
                            {entry.status}
                          </span>
                          {editingEntry === entry.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => updateManualEntry(entry.id, 'PRESENT')} 
                                className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">P</button>
                              <button onClick={() => updateManualEntry(entry.id, 'ABSENT')} 
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">A</button>
                              <button onClick={() => setEditingEntry(null)} 
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">✕</button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => setEditingEntry(entry.id)} 
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs">✏️</button>
                              <button onClick={() => deleteManualEntry(entry.id)} 
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">🗑️</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-gray-500">No manual entries. Add some below or use bulk add.</div>
                )}
              </div>
            )}

            {activeSection === 'summary' && (
              <div className="space-y-2">
                <h3 className="font-bold text-green-400">Attendance Summary</h3>
                {data.summary?.subjects?.length > 0 ? (
                  <>
                    <div className="bg-blue-900/30 border border-blue-600 p-3 rounded mb-3">
                      <div className="text-2xl font-bold">{data.summary.overall_percentage?.toFixed(1)}%</div>
                      <div className="text-sm text-gray-400">
                        {data.summary.overall_present} / {data.summary.overall_total} classes
                      </div>
                    </div>
                    {data.summary.subjects?.map((subj, i) => (
                      <div key={i} className="bg-gray-800 p-3 rounded text-xs mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <strong>{subj.subject_code}</strong>
                          <span className={subj.current_percentage >= 75 ? 'text-green-400' : 'text-red-400'}>
                            {subj.current_percentage?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-gray-400">
                          Snapshot: {subj.snapshot_present}/{subj.snapshot_total} | 
                          Manual: +{subj.manual_present}/-{subj.manual_absent} | 
                          Current: {subj.current_present}/{subj.current_total}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-gray-500">No summary data. Run recompute first.</div>
                )}
              </div>
            )}

            {activeSection === 'predictions' && (
              <div className="space-y-2">
                <h3 className="font-bold text-orange-400">Predictions</h3>
                {data.predictions?.subjects?.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                      <div className="bg-green-900/30 p-2 rounded">
                        Safe: {data.predictions.subjects.filter(s => s.status === 'SAFE').length}
                      </div>
                      <div className="bg-yellow-900/30 p-2 rounded">
                        Warning: {data.predictions.subjects.filter(s => s.status === 'WARNING').length}
                      </div>
                      <div className="bg-red-900/30 p-2 rounded">
                        Danger: {data.predictions.subjects.filter(s => s.status === 'DANGER' || s.status === 'CRITICAL').length}
                      </div>
                    </div>
                    {data.predictions.subjects?.map((pred, i) => (
                      <div key={i} className={`p-3 rounded text-xs mb-2 ${
                        pred.status === 'SAFE' ? 'bg-green-900/30 border border-green-700' :
                        pred.status === 'WARNING' ? 'bg-yellow-900/30 border border-yellow-700' :
                        'bg-red-900/30 border border-red-700'
                      }`}>
                        <div className="flex justify-between items-center mb-1">
                          <strong>{pred.subject_code || pred.subjects?.code}</strong>
                          <span>{pred.current_percentage?.toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                          <div>
                            <div className="text-gray-400">Remaining</div>
                            <div className="font-bold">{pred.remaining_classes}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Must Attend</div>
                            <div className="font-bold text-red-400">{pred.must_attend}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Can Bunk</div>
                            <div className="font-bold text-green-400">{Math.max(0, pred.can_bunk)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-gray-500">No predictions. Run recompute first.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Attendance Testing Panel */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">📝 Manual Attendance Testing</h2>
          <button onClick={clearAllManualAttendance} disabled={loading || data.manualAttendance?.length === 0}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm disabled:opacity-50">
            🗑️ Clear All
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Bulk Attendance Form */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-bold text-blue-400 mb-3">Add Bulk Attendance (10 days)</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Subject</label>
                <select 
                  value={manualForm.subjectId} 
                  onChange={e => setManualForm(prev => ({ ...prev, subjectId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a subject...</option>
                  {data.context?.subjects?.map(subj => (
                    <option key={subj.id} value={subj.id}>
                      {subj.code} - {subj.name} ({subj.type})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                  <input type="date" value={manualForm.startDate}
                    onChange={e => setManualForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Days</label>
                  <input type="number" value={manualForm.numDays} min="1" max="30"
                    onChange={e => setManualForm(prev => ({ ...prev, numDays: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Pattern (P=Present, A=Absent)</label>
                <input type="text" value={manualForm.pattern}
                  onChange={e => setManualForm(prev => ({ ...prev, pattern: e.target.value.toUpperCase() }))}
                  placeholder="PPPPPPPPPP"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Examples: PPPPPPPPPP (all present), PPPAAAPPPP (3 absent in middle)
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Class Type</label>
                <select value={manualForm.classType}
                  onChange={e => setManualForm(prev => ({ ...prev, classType: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="LECTURE">LECTURE</option>
                  <option value="LAB">LAB</option>
                  <option value="TUTORIAL">TUTORIAL</option>
                </select>
              </div>
              
              <button onClick={addBulkManualAttendance} disabled={loading || !manualForm.subjectId}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium disabled:opacity-50">
                ➕ Add {manualForm.numDays} Days Attendance
              </button>
            </div>
          </div>
          
          {/* Test Workflow Guide */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-bold text-green-400 mb-3">🧪 Test Workflow</h3>
            <ol className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">1</span>
                <span><strong>Load Context</strong> - Get student's batch, subjects, timetable</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs">2</span>
                <span><strong>Calc Semester Totals</strong> - Pre-compute total lectures/labs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-yellow-600 text-white px-2 py-0.5 rounded text-xs">3</span>
                <span><strong>Create Snapshot</strong> - Simulate OCR capture</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-xs">4</span>
                <span><strong>Add Manual Days</strong> - Add 10 days attendance after snapshot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs">5</span>
                <span><strong>Edit Days 1,2,3</strong> - Change status to test recompute</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">6</span>
                <span><strong>Recompute</strong> - Verify totals update correctly</span>
              </li>
            </ol>
            
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600 rounded text-xs">
              <strong className="text-blue-400">💡 Key Test:</strong>
              <p className="text-gray-400 mt-1">
                After editing days 1,2,3, recompute should update:
              </p>
              <ul className="text-gray-400 mt-1 space-y-1">
                <li>• <code>manual_present</code> / <code>manual_absent</code> counts</li>
                <li>• <code>current_present</code> = snapshot + manual</li>
                <li>• <code>current_percentage</code></li>
                <li>• <code>can_bunk</code> / <code>must_attend</code> predictions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">📚 How The Engine Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-bold text-purple-400 mb-2">Pre-Process 1 (Admin)</h3>
            <p className="text-gray-400 mb-2">Calculates total lectures per subject for the ENTIRE semester:</p>
            <ul className="text-gray-400 space-y-1 text-xs">
              <li>• Reads timetable → slots per week per subject</li>
              <li>• Reads academic calendar → holidays, vacations, exams</li>
              <li>• Reads teaching period → semester start/end dates</li>
              <li>• Result: "CS401 has 45 total lectures this semester"</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-blue-400 mb-2">Process 1 (User Flow)</h3>
            <p className="text-gray-400 mb-2">When user uploads OCR snapshot:</p>
            <ul className="text-gray-400 space-y-1 text-xs">
              <li>1. Match subject codes to user's branch/batch</li>
              <li>2. Extract present/total (till snapshot date)</li>
              <li>3. Add manual entries after snapshot</li>
              <li>4. Use semester totals to compute predictions</li>
              <li>5. Calculate: can_bunk = remaining - must_attend</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Debug Tab
function DebugTab() {
  const { session } = useAuth()
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  // In dev mode, use the test student ID that exists in the database
  const studentId = DEV_MODE ? TEST_STUDENT_ID : session.user.id

  const runAction = async (action) => {
    setLoading(true)
    setOutput('')
    
    try {
      let result
      switch (action) {
        case 'health':
          result = await apiCall('GET', '/engine/health')
          break
        case 'recompute':
          result = await apiCall('POST', '/engine/recompute', { student_id: studentId })
          break
        case 'summary':
          // API uses auth token to identify user, no student ID in path
          result = await apiCall('GET', '/attendance/summary')
          break
        case 'snapshots':
          const { data } = await supabase
            .from('ocr_snapshots')
            .select('*')
            .eq('student_id', studentId)
            .order('snapshot_date', { ascending: false })
            .limit(5)
          result = data
          break
        default:
          result = { error: 'Unknown action' }
      }
      setOutput(JSON.stringify(result, null, 2))
    } catch (err) {
      setOutput(JSON.stringify({ error: err.message }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🔧 Debug Tools</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => runAction('health')}
          className="p-4 bg-teal-600 hover:bg-teal-500 rounded-xl"
        >
          ❤️ Health Check
        </button>
        <button
          onClick={() => runAction('recompute')}
          className="p-4 bg-orange-600 hover:bg-orange-500 rounded-xl"
        >
          🔄 Force Recompute
        </button>
        <button
          onClick={() => runAction('summary')}
          className="p-4 bg-purple-600 hover:bg-purple-500 rounded-xl"
        >
          📊 Get Summary
        </button>
        <button
          onClick={() => runAction('snapshots')}
          className="p-4 bg-blue-600 hover:bg-blue-500 rounded-xl"
        >
          📸 View Snapshots
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Output</h2>
        <pre className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 text-sm">
          {loading ? (
            <span className="loading">Running...</span>
          ) : output || (
            <span className="text-gray-500">Click a button above to see output...</span>
          )}
        </pre>
      </div>

      <div className="mt-6 bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Session Info</h2>
        <div className="space-y-2 text-sm">
          <div><strong>User ID:</strong> {session?.user?.id}</div>
          <div><strong>Email:</strong> {session?.user?.email}</div>
          <div><strong>Auth Provider:</strong> {session?.user?.app_metadata?.provider || 'email'}</div>
        </div>
      </div>
    </div>
  )
}
