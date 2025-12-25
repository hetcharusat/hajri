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
        className="fixed inset-0 z-40 bg-gradient-to-br from-black/60 via-primary/20 to-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={cn(
        "fixed right-0 top-0 z-50 h-full w-full sm:w-[500px] bg-card border-l-4 border-primary shadow-2xl",
        "transform transition-all duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-primary/30 bg-primary shadow-lg">
            <h2 className="font-bold text-2xl tracking-tight text-primary-foreground">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-primary-foreground/20 text-primary-foreground hover:text-primary-foreground transition-colors rounded-lg">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <form onSubmit={onSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-card">
              {children}
            </div>

            {/* Footer */}
            <div className="p-6 border-t-2 border-border space-y-3 bg-muted/20">
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-3 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-11 text-base font-semibold border-2 transition-all" 
                onClick={onClose}
              >
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
      <Label className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
        <span className="text-foreground">{label}</span>
        {required && <span className="text-destructive text-base ml-0.5 font-extrabold">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-destructive font-semibold flex items-center gap-2 mt-2 p-3 rounded-lg bg-destructive/10 border-2 border-destructive shadow-sm">
          <span className="text-base">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}
