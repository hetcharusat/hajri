import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Shield, Mail, Calendar, CheckCircle2, XCircle, AlertCircle, Users } from 'lucide-react'

export default function Settings() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggleLoading, setToggleLoading] = useState({})

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      // First, check if current user is admin
      const { data: currentUserData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()
      
      if (!currentUserData?.is_admin) {
        setError('You must be an admin to view this page')
        setUsers([])
        setLoading(false)
        return
      }

      // If admin, fetch all users via RPC function
      const { data, error } = await supabase.rpc('get_all_users')

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleAdminStatus = async (userId, currentStatus) => {
    // Security: Prevent toggling own admin status
    if (currentUser?.id === userId) {
      setError('You cannot modify your own admin status for security reasons')
      return
    }

    try {
      setToggleLoading({ ...toggleLoading, [userId]: true })
      setError('')

      const { error } = await supabase
        .from('users')
        .update({ is_admin: !currentStatus })
        .eq('id', userId)

      if (error) {
        if (error.message.includes('policy')) {
          throw new Error('Security policy violation: Cannot modify own admin status')
        }
        throw error
      }

      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_admin: !currentStatus } : user
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setToggleLoading({ ...toggleLoading, [userId]: false })
    }
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage admin users and system configuration
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Admin Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                Active Admins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {users.filter(u => u.is_admin).length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Users with admin access</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-blue-500" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{users.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Signed in at least once</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <XCircle className="mr-2 h-5 w-5 text-orange-500" />
                Regular Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {users.filter(u => !u.is_admin).length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Without admin access</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              All Users
            </CardTitle>
            <CardDescription>
              Toggle admin status for any user. Users are auto-added on first Google sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <p className="mt-4 text-sm text-muted-foreground">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No users found. Users appear here after signing in with Google.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{user.email}</span>
                            {currentUser?.id === user.id && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                                You
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleAdminStatus(user.id, user.is_admin)}
                            disabled={toggleLoading[user.id] || currentUser?.id === user.id}
                            title={currentUser?.id === user.id ? 'Cannot modify your own admin status' : 'Click to toggle admin status'}
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: user.is_admin ? 'rgba(34, 197, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                              color: user.is_admin ? 'rgb(34, 197, 94)' : 'rgb(249, 115, 22)'
                            }}
                          >
                            {toggleLoading[user.id] ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : user.is_admin ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {user.is_admin ? 'Active' : 'Inactive'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {currentUser?.id === user.id ? (
                            <span className="text-xs text-muted-foreground">Your account</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Click status to toggle</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
