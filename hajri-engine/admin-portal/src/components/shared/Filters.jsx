import { cn } from '../../lib/utils'
import { Select } from '../ui/select'

export function FilterSelect({ 
  label, 
  icon: Icon, 
  value, 
  onChange, 
  options, 
  placeholder, 
  disabled,
  className 
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-50", className)}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && (typeof Icon === 'string' ? <span>{Icon}</span> : <Icon className="w-3.5 h-3.5" />)}
        {label}
      </label>
      <Select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  )
}

export function FilterGrid({ children, columns = 5, className }) {
  return (
    <div 
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder = "Search...", className }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 bg-input border border-border rounded-lg",
      className
    )}>
      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  )
}
