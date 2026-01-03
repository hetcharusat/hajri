import { useState, useEffect } from 'react'
import { 
  GraduationCap, 
  Activity, 
  Cpu, 
  Globe, 
  ArrowRight,
  Calculator,
  LineChart,
  BookOpen,
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react'
import { api } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge, MethodBadge } from '../components/ui/badge'
import { StatCard } from '../components/shared/StatCard'
import { PageHeader } from '../components/shared/PageHeader'
import { LoadingScreen } from '../components/shared/Loading'
import { useAppStore } from '../lib/store'

export function Dashboard() {
  const { setCurrentTab, stats, setStats } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [batchData] = await Promise.all([
        api('/test/all-batches'),
      ])
      
      setStats({ 
        batches: batchData.batches?.length || 0,
        loading: false 
      })
      
      // Mock recent activity - in real app, fetch from logs endpoint
      setRecentActivity([
        { type: 'calculation', message: 'Semester totals calculated for CSE Batch A', time: '2 min ago' },
        { type: 'snapshot', message: 'OCR snapshot processed', time: '15 min ago' },
        { type: 'prediction', message: 'Predictions updated for 45 students', time: '1 hour ago' },
      ])
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    }
    setLoading(false)
  }

  if (loading) return <LoadingScreen message="Loading dashboard..." />

  const quickActions = [
    { 
      icon: Calculator, 
      label: 'Calculate Semester Totals', 
      desc: 'Pre-compute expected classes',
      tab: 'semester-totals',
      color: 'primary'
    },
    { 
      icon: GraduationCap, 
      label: 'Browse Batches', 
      desc: 'View all batches & timetables',
      tab: 'batches',
      color: 'accent'
    },
    { 
      icon: LineChart, 
      label: 'View Predictions', 
      desc: 'Test attendance predictions',
      tab: 'predictions',
      color: 'success'
    },
    { 
      icon: BookOpen, 
      label: 'API Documentation', 
      desc: 'Interactive API docs',
      href: '/engine/docs',
      color: 'info'
    },
  ]

  const endpoints = [
    { method: 'GET', path: '/health', desc: 'Health check' },
    { method: 'POST', path: '/snapshots', desc: 'Submit OCR snapshot' },
    { method: 'GET', path: '/predictions/{student_id}', desc: 'Get predictions' },
    { method: 'POST', path: '/admin/calculate-semester-totals', desc: 'Calculate totals' },
    { method: 'GET', path: '/attendance/dashboard', desc: 'Student dashboard' },
    { method: 'POST', path: '/engine/recompute', desc: 'Force recompute' },
  ]

  return (
    <div className="page-container">
      <PageHeader 
        title="Dashboard" 
        subtitle="Monitor and manage HAJRI Engine"
        actions={
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-stats gap-4 mb-6">
        <StatCard 
          icon={GraduationCap} 
          label="Total Batches" 
          value={stats.batches} 
          color="primary"
          description="Registered in system"
        />
        <StatCard 
          icon={Activity} 
          label="Engine Status" 
          value="Healthy" 
          color="success"
          description="All systems operational"
        />
        <StatCard 
          icon={Cpu} 
          label="API Version" 
          value="v0.1.0" 
          color="accent"
          description="Current release"
        />
        <StatCard 
          icon={Globe} 
          label="Endpoints" 
          value="12+" 
          color="info"
          description="Available routes"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.tab ? setCurrentTab(action.tab) : window.open(action.href, '_blank')}
                className="w-full flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all group text-left"
              >
                <div className={`w-10 h-10 rounded-lg bg-${action.color}/10 flex items-center justify-center`}>
                  <action.icon className={`w-5 h-5 text-${action.color}`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.desc}</div>
                </div>
                {action.href ? (
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Available engine routes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <MethodBadge method={ep.method} />
                  <code className="text-sm font-mono text-foreground flex-1">{ep.path}</code>
                  <span className="text-xs text-muted-foreground hidden sm:block">{ep.desc}</span>
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => window.open('/engine/docs', '_blank')}
            >
              View Full API Docs
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest engine operations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm">{activity.message}</div>
                      <div className="text-xs text-muted-foreground">{activity.time}</div>
                    </div>
                    <Badge variant="secondary">{activity.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
