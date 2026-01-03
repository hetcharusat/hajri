import { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import Login from '../pages/Login'

export default function AdminGuard({ children }) {
  const { user, loading: authLoading } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user || !supabase) {
      setChecking(false)
      setIsAdmin(false)
      return
    }

    checkAdmin()
  }, [user])

  const checkAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        // If user doesn't exist, they're not an admin
        setIsAdmin(false)
      } else {
        setIsAdmin(data?.is_admin === true)
      }
    } catch (e) {
      setIsAdmin(false)
    } finally {
      setChecking(false)
    }
  }

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account ({user.email}) is not authorized to access the Engine Admin Panel.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Contact the system administrator to request admin access.
          </p>
          <button
            onClick={() => {
              supabase.auth.signOut()
              useAuthStore.getState().signOut()
            }}
            className="mt-6 inline-flex items-center rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}
