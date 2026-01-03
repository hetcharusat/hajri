import { cn } from "../../lib/utils"

const badgeVariants = {
  default: "bg-primary/20 text-primary border-primary/30",
  secondary: "bg-secondary text-secondary-foreground border-secondary",
  destructive: "bg-destructive/20 text-destructive border-destructive/30",
  success: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  info: "bg-info/20 text-info border-info/30",
  outline: "border-border text-foreground",
  lecture: "bg-primary/20 text-primary border-primary/30",
  lab: "bg-accent/20 text-accent border-accent/30",
  tutorial: "bg-success/20 text-success border-success/30",
}

export function Badge({ 
  className, 
  variant = "default",
  size = "default",
  children,
  ...props 
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium transition-colors",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// Type-specific badges
export function TypeBadge({ type, size = "default" }) {
  const variant = type === 'LECTURE' ? 'lecture' : type === 'LAB' ? 'lab' : type === 'TUTORIAL' ? 'tutorial' : 'secondary'
  return <Badge variant={variant} size={size}>{type}</Badge>
}

export function StatusBadge({ status }) {
  const variant = status === 'SAFE' ? 'success' : status === 'LOW' ? 'warning' : status === 'CRITICAL' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

export function MethodBadge({ method }) {
  const variant = method === 'GET' ? 'success' : method === 'POST' ? 'info' : method === 'PUT' ? 'warning' : method === 'DELETE' ? 'destructive' : 'secondary'
  return <Badge variant={variant} size="sm">{method}</Badge>
}
