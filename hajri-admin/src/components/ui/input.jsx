import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, error, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error 
          ? "border-destructive focus-visible:ring-destructive" 
          : "border-border focus-visible:border-primary",
        className
      )}
      ref={ref}
      aria-invalid={error ? "true" : "false"}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
