import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function SlidePanel({ open, onClose, title, children, onSubmit, submitLabel = 'Save', loading }) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={cn(
        "fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-card border-l-2 border-border shadow-2xl",
        "transform transition-all duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b-2 border-border bg-gradient-to-r from-primary/5 to-background shadow-sm">
            <h2 className="font-bold text-lg tracking-tight">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <form onSubmit={onSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-background to-muted/10">
              {children}
            </div>

            {/* Footer */}
            <div className="p-5 border-t-2 border-border space-y-2 bg-muted/20">
              <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all" disabled={loading}>
                {loading ? (
                  <>
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-3 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
              <Button type="button" variant="outline" className="w-full h-11 text-base font-medium hover:bg-muted/50" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export function FormField({ label, required, children, error }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">
        {label} {required && <span className="text-destructive text-base">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive font-medium flex items-center gap-1 mt-1.5">{error}</p>}
    </div>
  )
}
