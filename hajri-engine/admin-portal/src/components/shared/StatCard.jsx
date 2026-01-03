import { cn } from '../../lib/utils'

export function StatCard({ icon: Icon, label, value, description, color = 'primary', trend, className }) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-l-primary',
    success: 'bg-success/10 text-success border-l-success',
    warning: 'bg-warning/10 text-warning border-l-warning',
    destructive: 'bg-destructive/10 text-destructive border-l-destructive',
    info: 'bg-info/10 text-info border-l-info',
    accent: 'bg-accent/10 text-accent border-l-accent',
  }

  const iconBgClasses = {
    primary: 'bg-primary/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    destructive: 'bg-destructive/20',
    info: 'bg-info/20',
    accent: 'bg-accent/20',
  }

  return (
    <div className={cn(
      "stat-card border-l-4",
      colorClasses[color],
      className
    )}>
      <div className={cn("stat-card-icon", iconBgClasses[color])}>
        {typeof Icon === 'string' ? Icon : <Icon className="w-6 h-6" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-foreground truncate">{value}</div>
        <div className="text-sm text-muted-foreground truncate">{label}</div>
        {description && <div className="text-xs text-muted-foreground/70 mt-1">{description}</div>}
      </div>
      {trend && (
        <div className={cn(
          "text-xs font-medium px-2 py-1 rounded",
          trend > 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  )
}

export function MiniStat({ label, value, color, className }) {
  const colorClass = color ? `text-${color}` : 'text-foreground'
  
  return (
    <div className={cn("text-center px-4", className)}>
      <div className={cn("text-2xl font-bold", colorClass)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

export function StatsRow({ children, className }) {
  return (
    <div className={cn(
      "flex items-center justify-around gap-4 p-4 bg-secondary/50 rounded-lg",
      className
    )}>
      {children}
    </div>
  )
}
