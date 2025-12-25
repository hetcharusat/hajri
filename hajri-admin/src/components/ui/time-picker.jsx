import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Enhanced Time Picker with visual selection
 * Features: Manual input, hour/minute spinners, AM/PM toggle, quick select
 */
export function TimePicker({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Select time',
  use24Hour = false,
  minuteStep = 5,
  error,
  ...props
}) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')
  
  // Parse current value
  const { hours: currentHours, minutes: currentMinutes } = React.useMemo(() => {
    if (!value) return { hours: 9, minutes: 0 }
    // Handle string format "HH:MM:SS" or "HH:MM"
    if (typeof value === 'string') {
      const parts = value.split(':')
      return {
        hours: parseInt(parts[0], 10) || 9,
        minutes: parseInt(parts[1], 10) || 0
      }
    }
    // Handle Date object
    if (value instanceof Date) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes()
      }
    }
    return { hours: 9, minutes: 0 }
  }, [value])

  // Update input display when value changes
  React.useEffect(() => {
    if (value) {
      setInputValue(formatTimeForDisplay(currentHours, currentMinutes, use24Hour))
    }
  }, [value, currentHours, currentMinutes, use24Hour])

  function formatTimeForDisplay(hours, minutes, is24Hour = false) {
    const mins = String(minutes).padStart(2, '0')
    
    if (is24Hour) {
      return `${String(hours).padStart(2, '0')}:${mins}`
    }
    
    const period = hours >= 12 ? 'PM' : 'AM'
    let displayHours = hours
    if (hours === 0) displayHours = 12
    else if (hours > 12) displayHours = hours - 12
    
    return `${displayHours}:${mins} ${period}`
  }

  function formatTimeForDatabase(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  }

  function handleTimeChange(newHours, newMinutes) {
    const dbTime = formatTimeForDatabase(newHours, newMinutes)
    onChange?.(dbTime)
  }

  function incrementHours(delta) {
    let newHours = currentHours + delta
    if (newHours > 23) newHours = 0
    if (newHours < 0) newHours = 23
    handleTimeChange(newHours, currentMinutes)
  }

  function incrementMinutes(delta) {
    let newMinutes = currentMinutes + delta
    let newHours = currentHours
    
    if (newMinutes >= 60) {
      newMinutes = 0
      newHours = (newHours + 1) % 24
    } else if (newMinutes < 0) {
      newMinutes = 60 + newMinutes
      newHours = newHours === 0 ? 23 : newHours - 1
    }
    
    handleTimeChange(newHours, newMinutes)
  }

  function togglePeriod() {
    const newHours = currentHours >= 12 ? currentHours - 12 : currentHours + 12
    handleTimeChange(newHours, currentMinutes)
  }

  function handleInputChange(e) {
    setInputValue(e.target.value)
  }

  function handleInputBlur() {
    const parsed = parseTimeInput(inputValue)
    if (parsed) {
      handleTimeChange(parsed.hours, parsed.minutes)
    } else if (value) {
      setInputValue(formatTimeForDisplay(currentHours, currentMinutes, use24Hour))
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      handleInputBlur()
      setOpen(false)
    }
  }

  function parseTimeInput(input) {
    if (!input) return null
    const cleaned = input.trim().toUpperCase()
    
    // Try HH:MM AM/PM format
    const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10)
      const minutes = parseInt(ampmMatch[2], 10)
      const period = ampmMatch[3]?.toUpperCase()
      
      if (period === 'PM' && hours < 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes }
      }
    }
    
    return null
  }

  const displayHours = use24Hour 
    ? currentHours 
    : (currentHours === 0 ? 12 : currentHours > 12 ? currentHours - 12 : currentHours)
  
  const period = currentHours >= 12 ? 'PM' : 'AM'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'pl-10 pr-4 font-mono cursor-pointer h-11',
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-auto p-4" align="start">
        {/* Time Spinners */}
        <div className="flex items-center justify-center gap-3">
          {/* Hours */}
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-primary/10 rounded-lg"
              onClick={() => incrementHours(1)}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
            <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold font-mono bg-muted rounded-xl border-2 border-border shadow-inner">
              {String(displayHours).padStart(2, '0')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-primary/10 rounded-lg"
              onClick={() => incrementHours(-1)}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-muted-foreground mt-1 font-medium">HOUR</span>
          </div>

          <span className="text-4xl font-bold text-muted-foreground mb-8">:</span>

          {/* Minutes */}
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-primary/10 rounded-lg"
              onClick={() => incrementMinutes(minuteStep)}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
            <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold font-mono bg-muted rounded-xl border-2 border-border shadow-inner">
              {String(currentMinutes).padStart(2, '0')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-primary/10 rounded-lg"
              onClick={() => incrementMinutes(-minuteStep)}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-muted-foreground mt-1 font-medium">MIN</span>
          </div>

          {/* AM/PM Toggle */}
          {!use24Hour && (
            <div className="flex flex-col items-center ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-primary/10 rounded-lg"
                onClick={togglePeriod}
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
              <div 
                className="w-16 h-16 flex items-center justify-center text-xl font-bold bg-primary/10 text-primary rounded-xl border-2 border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors shadow-inner"
                onClick={togglePeriod}
              >
                {period}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-primary/10 rounded-lg"
                onClick={togglePeriod}
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
              <span className="text-[10px] text-muted-foreground mt-1 font-medium">PERIOD</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

