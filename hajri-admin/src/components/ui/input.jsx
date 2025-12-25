import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, error, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border-2 bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-all",
        "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground/70 placeholder:font-normal",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary focus-visible:shadow-md",
        "hover:border-primary/50 hover:shadow-md",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:shadow-sm",
        error 
          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive" 
          : "border-border",
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
