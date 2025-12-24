import { Building2, GraduationCap, Calendar, Grid3x3, Target, BookOpen, User, Edit, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const NODE_ICONS = {
  department: Building2,
  branch: GraduationCap,
  semester: Calendar,
  class: Grid3x3,
  batch: Target,
  subject: BookOpen,
  student: User,
}

const NODE_COLORS = {
  department: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  branch: 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  semester: 'bg-gradient-to-br from-green-500/20 to-green-600/10 text-green-600 dark:text-green-400 border-green-500/30',
  class: 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  batch: 'bg-gradient-to-br from-pink-500/20 to-pink-600/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
  subject: 'bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  student: 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
}

export function EntityCard({ node, stats, onEdit, onDelete, onDuplicate }) {
  const Icon = NODE_ICONS[node.type] || Grid3x3

  return (
    <Card className="p-6 shadow-lg border-2 transition-all hover:shadow-xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            'p-4 rounded-xl border-2 shadow-md transition-all hover:scale-105',
            NODE_COLORS[node.type] || 'bg-muted/30 text-muted-foreground border-border'
          )}>
            <Icon className="h-8 w-8" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {node.type}
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{node.name}</h2>
            {node.meta && (
              <p className="text-sm text-muted-foreground mt-2 font-medium">{node.meta}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} className="hover:bg-primary/10">
            <Edit className="h-4 w-4" />
          </Button>
          {onDuplicate && (
            <Button variant="ghost" size="icon" onClick={onDuplicate} className="hover:bg-primary/10">
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-3 gap-6 pt-6 border-t-2">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center group cursor-default hover:bg-secondary/50 rounded-lg p-3 transition-all">
              <div className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
