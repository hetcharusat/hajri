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
        "fixed right-0 top-0 z-50 h-full w-full sm:w-[500px] bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-l-4 border-primary shadow-2xl",
        "transform transition-all duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-primary/30 bg-gradient-to-r from-primary/90 via-primary to-primary/90 shadow-lg backdrop-blur-sm">
            <h2 className="font-bold text-2xl tracking-tight text-white drop-shadow-md">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/20 text-white hover:text-white transition-colors rounded-lg">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <form onSubmit={onSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-800/50 dark:to-slate-900">
              {children}
            </div>

            {/* Footer */}
            <div className="p-6 border-t-2 border-primary/30 space-y-3 bg-gradient-to-t from-slate-100 via-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-800 backdrop-blur-sm shadow-inner">
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-200 bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-blue-600 hover:via-primary hover:to-blue-600 text-white" 
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
                className="w-full h-11 text-base font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-primary/30 hover:border-primary transition-all" 
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
      <Label className="text-sm font-bold tracking-wide text-foreground flex items-center gap-2">
        <span className="inline-block w-1.5 h-5 bg-gradient-to-b from-primary to-blue-600 rounded-full shadow-sm" />
        <span className="text-slate-900 dark:text-slate-100">{label}</span>
        {required && <span className="text-red-500 text-base ml-0.5 font-extrabold">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 font-semibold flex items-center gap-2 mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 shadow-sm">
          <span className="text-base">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}
