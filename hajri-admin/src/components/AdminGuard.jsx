import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

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
        // If user doesn't exist, create them with default permissions
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('users')
            .insert([{ id: user.id, email: user.email, is_admin: false }])
          
          if (!insertError) {
            setIsAdmin(false)
          }
        }
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg className="h-6 w-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) is not authorized to access the admin panel.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Contact the system administrator to request access.
          </p>
          <button
            onClick={() => {
              supabase.auth.signOut()
              useAuthStore.getState().signOut()
            }}
            className="mt-6 inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children
}
