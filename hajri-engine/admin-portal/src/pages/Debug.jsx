import { useState } from 'react'
import { 
  Bug,
  Play,
  Code,
  User,
  Terminal,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react'
import { api } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge, MethodBadge } from '../components/ui/badge'
import { PageHeader } from '../components/shared/PageHeader'

export function Debug() {
  const [studentId, setStudentId] = useState('11111111-1111-1111-1111-111111111111')
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  
  const [endpoint, setEndpoint] = useState('/health')
  const [method, setMethod] = useState('GET')
  const [response, setResponse] = useState(null)
  const [responseLoading, setResponseLoading] = useState(false)
  
  const [copied, setCopied] = useState(false)

  const loadContext = async () => {
    setContextLoading(true)
    const res = await api(`/test/student-context/${studentId}`)
    setContext(res)
    setContextLoading(false)
  }

  const executeApi = async () => {
    setResponseLoading(true)
    const res = await api(endpoint, { method })
    setResponse(res)
    setResponseLoading(false)
  }

  const copyJson = (data) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const testEndpoints = [
    { method: 'GET', path: '/health', desc: 'Health check' },
    { method: 'GET', path: '/test/all-batches', desc: 'List all batches' },
    { method: 'GET', path: '/test/batch/{batch_id}', desc: 'Batch details & timetable' },
    { method: 'GET', path: '/test/student-context/{student_id}', desc: 'Student context' },
    { method: 'GET', path: '/test/predictions/{student_id}', desc: 'Predictions' },
    { method: 'POST', path: '/test/calculate-semester-totals', desc: 'Calculate totals' },
    { method: 'POST', path: '/test/calculate-semester-totals-bulk', desc: 'Bulk calculate' },
    { method: 'POST', path: '/test-recompute/{student_id}', desc: 'Force recompute' },
  ]

  const quickEndpoints = [
    { label: 'Health', path: '/health' },
    { label: 'All Batches', path: '/test/all-batches' },
    { label: 'Root', path: '/' },
  ]

  return (
    <div className="page-container">
      <PageHeader 
        title="Debug Tools" 
        subtitle="Test endpoints and inspect engine data"
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open('/engine/docs', '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            API Docs
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Student Context */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Student Context
            </CardTitle>
            <CardDescription>Inspect student's batch, subjects, and timetable</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Student ID
              </label>
              <div className="flex gap-2">
                <Input
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="Enter student UUID..."
                />
                <Button onClick={loadContext} loading={contextLoading}>
                  <Bug className="w-4 h-4 mr-2" />
                  Load
                </Button>
              </div>
            </div>

            {context && (
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => copyJson(context)}
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
                <pre className="text-xs bg-secondary p-4 rounded-lg overflow-auto max-h-80 font-mono">
                  {JSON.stringify(context, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Tester */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              API Tester
            </CardTitle>
            <CardDescription>Execute arbitrary API requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select 
                value={method} 
                onChange={e => setMethod(e.target.value)}
                className="w-24"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </Select>
              <Input
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder="/endpoint"
                className="font-mono"
              />
              <Button onClick={executeApi} loading={responseLoading}>
                <Play className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Endpoints */}
            <div className="flex flex-wrap gap-2">
              {quickEndpoints.map(ep => (
                <Button 
                  key={ep.path}
                  variant="outline" 
                  size="xs"
                  onClick={() => { setEndpoint(ep.path); setMethod('GET'); }}
                >
                  {ep.label}
                </Button>
              ))}
            </div>

            {response && (
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => copyJson(response)}
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
                <pre className="text-xs bg-secondary p-4 rounded-lg overflow-auto max-h-80 font-mono">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available Test Endpoints */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Test Endpoints
          </CardTitle>
          <CardDescription>Available endpoints that don't require authentication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {testEndpoints.map((ep, i) => (
              <button
                key={i}
                onClick={() => { setEndpoint(ep.path); setMethod(ep.method); }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all text-left"
              >
                <MethodBadge method={ep.method} />
                <code className="text-sm font-mono flex-1 truncate">{ep.path}</code>
                <span className="text-xs text-muted-foreground hidden sm:block">{ep.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
