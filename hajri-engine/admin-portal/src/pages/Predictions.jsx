import { useState } from 'react'
import { 
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  BarChart3,
  Calendar
} from 'lucide-react'
import { api, cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge, TypeBadge, StatusBadge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { StatCard, MiniStat, StatsRow } from '../components/shared/StatCard'
import { PageHeader } from '../components/shared/PageHeader'
import { EmptyState } from '../components/shared/Loading'

export function Predictions() {
  const [studentId, setStudentId] = useState('11111111-1111-1111-1111-111111111111')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadPredictions = async () => {
    if (!studentId.trim()) return
    
    setLoading(true)
    setError(null)
    setData(null)
    
    try {
      const res = await api(`/test/predictions/${studentId}`)
      if (res.error) {
        setError(res)
      } else {
        setData(res)
      }
    } catch (err) {
      setError({ error: err.message })
    }
    setLoading(false)
  }

  const getPercentageColor = (pct) => {
    if (pct >= 85) return 'text-success'
    if (pct >= 75) return 'text-info'
    if (pct >= 65) return 'text-warning'
    return 'text-destructive'
  }

  return (
    <div className="page-container">
      <PageHeader 
        title="Predictions Viewer" 
        subtitle="Test attendance predictions and bunk calculations"
      />

      {/* Search Card */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Student ID</label>
              <Input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Enter student UUID..."
                onKeyDown={e => e.key === 'Enter' && loadPredictions()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadPredictions} loading={loading}>
                <Search className="w-4 h-4 mr-2" />
                Load Predictions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Data State */}
      {!data && !error && !loading && (
        <Card>
          <EmptyState 
            icon="📊"
            title="Enter a Student ID"
            description="Enter a student UUID above to view their attendance dashboard and predictions"
          />
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Loading Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">{error.error}</p>
            {error.traceback && (
              <pre className="text-xs bg-secondary p-3 rounded-lg overflow-x-auto max-h-48 text-muted-foreground">
                {error.traceback}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-6 animate-fade-in">
          {/* Overall Stats */}
          <div className="grid grid-stats gap-4">
            <StatCard 
              icon={CheckCircle2} 
              label="Overall Present" 
              value={data.dashboard?.overall_present || 0} 
              color="success"
            />
            <StatCard 
              icon={BarChart3} 
              label="Overall Total" 
              value={data.dashboard?.overall_total || 0} 
              color="primary"
            />
            <StatCard 
              icon={Target} 
              label="Overall Percentage" 
              value={`${data.dashboard?.overall_percentage || 0}%`} 
              color={data.dashboard?.overall_percentage >= 75 ? 'success' : 'destructive'}
            />
            <StatCard 
              icon={AlertTriangle} 
              label="Subjects at Risk" 
              value={data.predictions?.subjects_at_risk || 0} 
              color={data.predictions?.subjects_at_risk > 0 ? 'destructive' : 'success'}
            />
          </div>

          {/* Current Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Current Attendance
              </CardTitle>
              <CardDescription>Subject-wise attendance status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dashboard?.subjects?.map(s => (
                    <TableRow key={`${s.subject_code}-${s.class_type}`}>
                      <TableCell className="font-medium">{s.subject_code}</TableCell>
                      <TableCell><TypeBadge type={s.class_type} /></TableCell>
                      <TableCell>{s.present}</TableCell>
                      <TableCell>{s.total}</TableCell>
                      <TableCell>
                        <span className={cn("font-bold", getPercentageColor(s.percentage))}>
                          {s.percentage}%
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Predictions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Bunk Predictions
              </CardTitle>
              <CardDescription>How many classes you can skip and still maintain 75%</CardDescription>
            </CardHeader>
            <CardContent>
              <StatsRow className="mb-4">
                <MiniStat 
                  label="Total Can Bunk" 
                  value={data.predictions?.total_can_bunk || 0} 
                  color="success" 
                />
                <MiniStat 
                  label="Must Attend" 
                  value={data.predictions?.total_must_attend || 0} 
                  color="warning" 
                />
                <MiniStat 
                  label="Classes Remaining" 
                  value={data.predictions?.classes_remaining_in_semester || 0} 
                />
              </StatsRow>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>
                      <span className="text-success">Can Bunk</span>
                    </TableHead>
                    <TableHead>
                      <span className="text-warning">Must Attend</span>
                    </TableHead>
                    <TableHead>Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.predictions?.subjects?.map(s => (
                    <TableRow key={`${s.subject_code}-${s.class_type}`}>
                      <TableCell className="font-medium">{s.subject_code}</TableCell>
                      <TableCell><TypeBadge type={s.class_type} /></TableCell>
                      <TableCell>
                        <span className={cn("text-sm", getPercentageColor(s.percentage))}>
                          {s.present}/{s.total} ({s.percentage}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-success text-lg">
                          {s.can_bunk}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-bold text-lg",
                          s.must_attend > 0 ? "text-warning" : "text-muted-foreground"
                        )}>
                          {s.must_attend}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.classes_remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
