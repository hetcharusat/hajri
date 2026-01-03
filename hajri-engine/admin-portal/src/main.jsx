import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AdminGuard from './components/AdminGuard'
import { useAuthStore } from './lib/store'
import { supabase } from './lib/supabase'
import './styles.css'

function Root() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setLoading])

  return (
    <AdminGuard>
      <App />
    </AdminGuard>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
