import React from 'react'
import Select from 'react-select'
import { cn } from '@/lib/utils'

const customStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '44px',
    borderWidth: '2px',
    borderColor: state.isFocused 
      ? 'hsl(var(--primary))' 
      : state.hasValue 
        ? 'hsl(var(--border))' 
        : 'hsl(var(--border))',
    backgroundColor: 'hsl(var(--background))',
    boxShadow: state.isFocused 
      ? '0 0 0 2px hsl(var(--primary) / 0.2)' 
      : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '&:hover': {
      borderColor: 'hsl(var(--primary) / 0.5)',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
    borderRadius: '0.5rem',
    transition: 'all 0.2s',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--card))',
    border: '2px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    zIndex: 9999,
  }),
  menuList: (base) => ({
    ...base,
    padding: '0.5rem',
    maxHeight: '300px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'hsl(var(--primary))'
      : state.isFocused
        ? 'hsl(var(--secondary))'
        : 'transparent',
    color: state.isSelected
      ? 'hsl(var(--primary-foreground))'
      : 'hsl(var(--foreground))',
    padding: '0.75rem 1rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    '&:active': {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground) / 0.7)',
    fontSize: '0.875rem',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
    fontSize: '0.875rem',
    fontWeight: '500',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--secondary))',
    borderRadius: '0.375rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
    fontSize: '0.875rem',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
    '&:hover': {
      backgroundColor: 'hsl(var(--destructive))',
      color: 'hsl(var(--destructive-foreground))',
    },
  }),
  input: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--border))',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    transition: 'transform 0.2s',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    '&:hover': {
      color: 'hsl(var(--foreground))',
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    '&:hover': {
      color: 'hsl(var(--destructive))',
    },
  }),
}

export function EnhancedSelect({
  className,
  error,
  ...props
}) {
  return (
    <div className={cn('w-full', className)}>
      <Select
        styles={customStyles}
        classNamePrefix="react-select"
        isSearchable
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-destructive font-medium">{error}</p>
      )}
    </div>
  )
}

