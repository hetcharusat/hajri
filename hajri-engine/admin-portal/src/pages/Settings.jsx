import { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon,
  Server,
  Globe,
  Clock,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info
} from 'lucide-react'
import { api } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageHeader } from '../components/shared/PageHeader'
import { StatCard } from '../components/shared/StatCard'
import { LoadingSpinner } from '../components/shared/Loading'

export function Settings() {
  const [health, setHealth] = useState(null)
  const [rootInfo, setRootInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInfo()
  }, [])

  const loadInfo = async () => {
    setLoading(true)
    try {
      const [healthRes, rootRes] = await Promise.all([
        api('/health'),
        api('/')
      ])
      setHealth(healthRes)
      setRootInfo(rootRes)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
    setLoading(false)
  }

  const configItems = [
    { 
      icon: Server, 
      label: 'Service Name', 
      value: rootInfo?.service || 'HAJRI Engine',
      description: 'Main application identifier'
    },
    { 
      icon: Globe, 
      label: 'API Version', 
      value: rootInfo?.version || 'N/A',
      description: 'Current API version'
    },
    { 
      icon: Clock, 
      label: 'Timezone', 
      value: 'Asia/Kolkata (IST)',
      description: 'Default timezone for calculations'
    },
    { 
      icon: Database, 
      label: 'Database', 
      value: 'Supabase PostgreSQL',
      description: 'Backend data store'
    },
  ]

  const links = [
    { label: 'API Documentation', href: '/engine/docs', icon: ExternalLink },
    { label: 'ReDoc', href: '/engine/redoc', icon: ExternalLink },
    { label: 'OpenAPI Schema', href: '/engine/openapi.json', icon: ExternalLink },
  ]

  return (
    <div className="page-container">
      <PageHeader 
        title="Settings & Info" 
        subtitle="Engine configuration and status"
        actions={
          <Button variant="outline" size="sm" onClick={loadInfo}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Health Status */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={health?.status === 'healthy' ? CheckCircle2 : XCircle}
              label="Engine Status"
              value={health?.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
              color={health?.status === 'healthy' ? 'success' : 'destructive'}
            />
            <StatCard 
              icon={Server}
              label="Service"
              value={health?.service || 'hajri-engine'}
              color="primary"
            />
            <StatCard 
              icon={Globe}
              label="Version"
              value={rootInfo?.version || '0.1.0'}
              color="accent"
            />
            <StatCard 
              icon={Clock}
              label="Debug Mode"
              value={rootInfo?.debug ? 'Enabled' : 'Disabled'}
              color={rootInfo?.debug ? 'warning' : 'info'}
            />
          </div>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Configuration
              </CardTitle>
              <CardDescription>Current engine settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {configItems.map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                    <div className="font-mono text-sm bg-card px-3 py-1.5 rounded-lg border border-border">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Available Endpoints
              </CardTitle>
              <CardDescription>Main API routes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {rootInfo?.endpoints && Object.entries(rootInfo.endpoints).map(([name, path]) => (
                  <div 
                    key={name}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <span className="text-sm capitalize">{name}</span>
                    <code className="text-xs font-mono text-muted-foreground">{path}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {links.map((link, i) => (
                  <Button 
                    key={i}
                    variant="outline"
                    onClick={() => window.open(link.href, '_blank')}
                  >
                    <link.icon className="w-4 h-4 mr-2" />
                    {link.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm mb-1">About HAJRI Engine</div>
                  <p className="text-sm text-muted-foreground">
                    HAJRI Engine is a headless, deterministic computation engine for college attendance tracking.
                    It processes OCR snapshots, calculates attendance aggregates, and provides predictions
                    for students to maintain their required attendance percentage.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
