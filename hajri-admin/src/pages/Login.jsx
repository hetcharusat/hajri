import { useState, useEffect } from 'react'
import { supabase, supabaseConfigError } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Chrome } from 'lucide-react'

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">HAJRI Admin</CardTitle>
          <CardDescription>
            Sign in with your Google account to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-destructive">Login failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Check Supabase Auth → URL Configuration and Google provider settings
                </p>
              </div>
            </div>
          )}

          {supabaseConfigError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-destructive">Configuration Error</p>
                <p className="text-sm text-muted-foreground">{supabaseConfigError}</p>
              </div>
            </div>
          )}

          <Button 
            onClick={signInWithGoogle} 
            disabled={loading || !supabase}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Signing in...
              </>
            ) : (
              <>
                <Chrome className="mr-2 h-5 w-5" />
                Sign in with Google
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Admin access required. Unauthorized access attempts are logged.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
