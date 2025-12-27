import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, apiCall, ocrExtract, OCR_URL } from './lib/supabase'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      // For now, we'll show context info
      // Real implementation would call /attendance/summary
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

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

      {/* Attendance Summary Placeholder */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📊 Attendance Summary</h2>
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">📸</div>
          <p>No attendance data yet.</p>
          <p className="text-sm">Go to OCR Scan to import your first snapshot.</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-6">
          <div className="text-green-400 text-sm">Overall Attendance</div>
          <div className="text-3xl font-bold mt-1">--%</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-600/30 rounded-xl p-6">
          <div className="text-yellow-400 text-sm">Can Bunk</div>
          <div className="text-3xl font-bold mt-1">-- classes</div>
        </div>
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/30 rounded-xl p-6">
          <div className="text-red-400 text-sm">Must Attend</div>
          <div className="text-3xl font-bold mt-1">-- classes</div>
        </div>
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
  const [subjects, setSubjects] = useState([])
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [snapshotDate, setSnapshotDate] = useState(null)

  useEffect(() => {
    loadSubjects()
    // In real app, would also load latest snapshot date
  }, [])

  const loadSubjects = async () => {
    try {
      if (!appContext?.semester?.id) return
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('semester_id', appContext.semester.id)
        .order('name')
      
      if (error) throw error
      setSubjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (subjectId, status) => {
    setAttendance(prev => ({
      ...prev,
      [subjectId]: prev[subjectId] === status ? null : status
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
      
      for (const [subjectId, status] of entries) {
        await apiCall('POST', '/attendance/manual', {
          student_id: session.user.id,
          subject_id: subjectId,
          event_date: date,
          period_number: 1, // Would need timetable lookup
          class_type: 'THEORY',
          status: status
        })
      }

      alert('Attendance saved!')
      setAttendance({})
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

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
          <strong>Policy Violation:</strong> {error}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Date</label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-3 bg-gray-700 rounded-lg border border-gray-600"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 loading">Loading subjects...</div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No subjects found.</div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {subjects.map(subject => (
                <div key={subject.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div>
                    <div className="font-medium">{subject.name}</div>
                    <div className="text-sm text-gray-400">{subject.code}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(subject.id, 'PRESENT')}
                      className={`px-4 py-2 rounded-lg transition ${
                        attendance[subject.id] === 'PRESENT'
                          ? 'bg-green-600'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      ✓ Present
                    </button>
                    <button
                      onClick={() => handleToggle(subject.id, 'ABSENT')}
                      className={`px-4 py-2 rounded-lg transition ${
                        attendance[subject.id] === 'ABSENT'
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

// Debug Tab
function DebugTab() {
  const { session } = useAuth()
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

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
          result = await apiCall('POST', '/engine/recompute', { student_id: session.user.id })
          break
        case 'summary':
          result = await apiCall('GET', `/attendance/summary/${session.user.id}`)
          break
        case 'snapshots':
          const { data } = await supabase
            .from('ocr_snapshots')
            .select('*')
            .eq('student_id', session.user.id)
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
