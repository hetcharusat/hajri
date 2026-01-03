import { cn } from '../../lib/utils'

export function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
      <div className="w-10 h-10 border-3 border-border border-t-primary rounded-full animate-spin mb-4" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function LoadingSpinner({ size = "md", className }) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-10 h-10 border-3",
  }

  return (
    <div 
      className={cn(
        "border-border border-t-primary rounded-full animate-spin",
        sizeClasses[size],
        className
      )} 
    />
  )
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className 
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      {icon && (
        <div className="text-5xl mb-4 opacity-50">
          {typeof icon === 'string' ? icon : icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}

export function Skeleton({ className }) {
  return (
    <div className={cn(
      "animate-pulse bg-muted rounded",
      className
    )} />
  )
}
