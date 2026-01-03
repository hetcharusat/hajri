import { useState, useEffect } from 'react'
import { 
  ScrollText,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Trash2
} from 'lucide-react'
import { api, formatDateTime, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { PageHeader } from '../components/shared/PageHeader'
import { LoadingScreen, EmptyState } from '../components/shared/Loading'

export function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [filter, setFilter] = useState({ status: '', trigger: '' })

  // Note: This is a mock since there's no public logs endpoint without auth
  // In production, you'd fetch from /engine/logs or similar
  
  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const loadLogs = async () => {
    setLoading(true)
    // Mock data since we don't have a public logs endpoint
    // In real implementation: const res = await api('/admin/logs?limit=50')
    
    setLogs([
      {
        id: '1',
        timestamp: new Date().toISOString(),
        type: 'RECOMPUTE',
        trigger: 'SNAPSHOT_RECEIVED',
        status: 'SUCCESS',
        student_id: '11111111-1111-1111-1111-111111111111',
        subjects_updated: 5,
        duration_ms: 234
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'SEMESTER_TOTALS',
        trigger: 'ADMIN_REQUEST',
        status: 'SUCCESS',
        batch_id: 'batch-123',
        subjects_calculated: 8,
        duration_ms: 156
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: 'RECOMPUTE',
        trigger: 'FORCE_RECOMPUTE',
        status: 'SUCCESS',
        student_id: '22222222-2222-2222-2222-222222222222',
        subjects_updated: 3,
        duration_ms: 189
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        type: 'SNAPSHOT',
        trigger: 'OCR_UPLOAD',
        status: 'SUCCESS',
        snapshot_id: 'snap-456',
        records_processed: 45,
        duration_ms: 1234
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        type: 'RECOMPUTE',
        trigger: 'SNAPSHOT_RECEIVED',
        status: 'ERROR',
        student_id: '33333333-3333-3333-3333-333333333333',
        error: 'Student not found in batch',
        duration_ms: 45
      },
    ])
    setLoading(false)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'ERROR': return <XCircle className="w-4 h-4 text-destructive" />
      case 'PENDING': return <Clock className="w-4 h-4 text-warning" />
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      SUCCESS: 'success',
      ERROR: 'destructive',
      PENDING: 'warning'
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const filteredLogs = logs.filter(log => {
    if (filter.status && log.status !== filter.status) return false
    if (filter.trigger && log.trigger !== filter.trigger) return false
    return true
  })

  const triggers = [...new Set(logs.map(l => l.trigger))]
  const statuses = [...new Set(logs.map(l => l.status))]

  return (
    <div className="page-container">
      <PageHeader 
        title="Logs & Activity" 
        subtitle="Monitor engine computations and activity"
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant={autoRefresh ? "default" : "outline"} 
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", autoRefresh && "animate-spin")} />
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              Filters:
            </div>
            <Select 
              value={filter.status}
              onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              className="w-40"
            >
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select 
              value={filter.trigger}
              onChange={e => setFilter(f => ({ ...f, trigger: e.target.value }))}
              className="w-48"
            >
              <option value="">All Triggers</option>
              {triggers.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
            {(filter.status || filter.trigger) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilter({ status: '', trigger: '' })}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingScreen message="Loading logs..." />
          ) : filteredLogs.length === 0 ? (
            <EmptyState 
              icon="📜"
              title="No Logs Found"
              description={filter.status || filter.trigger ? "Try adjusting your filters" : "No activity recorded yet"}
            />
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div 
                  key={log.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all hover:border-primary/30",
                    log.status === 'ERROR' ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{log.type}</span>
                          {getStatusBadge(log.status)}
                          <Badge variant="secondary" size="sm">
                            {log.trigger?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-x-3">
                          {log.student_id && <span>Student: {log.student_id.slice(0, 8)}...</span>}
                          {log.batch_id && <span>Batch: {log.batch_id}</span>}
                          {log.subjects_updated && <span>Subjects: {log.subjects_updated}</span>}
                          {log.subjects_calculated && <span>Calculated: {log.subjects_calculated}</span>}
                          {log.records_processed && <span>Records: {log.records_processed}</span>}
                          <span>Duration: {log.duration_ms}ms</span>
                        </div>
                        {log.error && (
                          <div className="mt-2 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                            {log.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
