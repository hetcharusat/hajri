import { useState, useEffect } from 'react'
import { supabase, supabaseConfigError } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { AlertCircle, Chrome, Settings } from 'lucide-react'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser, setSession } = useAuthStore()

  useEffect(() => {
    if (!supabase) return
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession])

  const signInWithGoogle = async () => {
    if (!supabase) {
      setError(supabaseConfigError || 'Supabase is not configured')
      return
    }
    setLoading(true)
    setError('')
    
    // Get the current origin (works for both localhost and deployed)
    const redirectUrl = `${window.location.origin}/`
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
        <div className="p-6 space-y-1 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-500" />
            <h1 className="text-2xl font-bold text-slate-100">Engine Admin</h1>
          </div>
          <p className="text-sm text-slate-400">
            Sign in with your Google account to access the engine controls
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-red-500">Login failed</p>
                <p className="text-sm text-slate-400">{error}</p>
              </div>
            </div>
          )}

          {supabaseConfigError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-red-500">Configuration Error</p>
                <p className="text-sm text-slate-400">{supabaseConfigError}</p>
              </div>
            </div>
          )}

          <button 
            onClick={signInWithGoogle} 
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing in...
              </>
            ) : (
              <>
                <Chrome className="h-5 w-5" />
                Sign in with Google
              </>
            )}
          </button>

          <p className="text-xs text-center text-slate-500 mt-4">
            Only authorized administrators can access this panel.
            <br />
            You must be marked as admin in the database.
          </p>
        </div>
      </div>
    </div>
  )
}
