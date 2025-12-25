import Select from 'react-select'
import { cn } from '@/lib/utils'

/**
 * Themed React Select for dark mode with proper scrolling
 * Uses react-select with custom styles matching the app theme
 */

const customStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'hsl(222.2 47.4% 11.2%)', // --card
    borderColor: state.isFocused ? 'hsl(217.2 91.2% 59.8%)' : 'hsl(220.9 39.3% 11%)', // --primary / --border
    borderWidth: '2px',
    borderRadius: '0.5rem',
    minHeight: '44px', // h-11
    boxShadow: state.isFocused ? '0 0 0 2px hsl(217.2 91.2% 59.8% / 0.2)' : 'none',
    '&:hover': {
      borderColor: 'hsl(217.2 91.2% 59.8% / 0.5)', // primary/50
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'hsl(222.2 47.4% 11.2%)', // --card
    borderRadius: '0.5rem',
    border: '1px solid hsl(220.9 39.3% 11%)', // --border
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
    zIndex: 50,
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
    maxHeight: '280px', // Good scrollable height
    '::-webkit-scrollbar': {
      width: '8px',
    },
    '::-webkit-scrollbar-track': {
      background: 'hsl(222.2 47.4% 11.2%)',
    },
    '::-webkit-scrollbar-thumb': {
      background: 'hsl(220.9 39.3% 20%)',
      borderRadius: '4px',
    },
    '::-webkit-scrollbar-thumb:hover': {
      background: 'hsl(220.9 39.3% 30%)',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'hsl(217.2 91.2% 59.8%)' // --primary
      : state.isFocused
      ? 'hsl(220.9 39.3% 18%)' // slightly lighter
      : 'transparent',
    color: state.isSelected ? 'white' : 'hsl(220 13% 91%)', // --foreground
    padding: '10px 12px',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'hsl(217.2 91.2% 50%)',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'hsl(220 13% 91%)', // --foreground
  }),
  input: (base) => ({
    ...base,
    color: 'hsl(220 13% 91%)', // --foreground
  }),
  placeholder: (base) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)', // --muted-foreground
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)', // --muted-foreground
    padding: '8px',
    '&:hover': {
      color: 'hsl(220 13% 91%)', // --foreground
    },
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s ease',
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)',
    padding: '8px',
    '&:hover': {
      color: 'hsl(0 84.2% 60.2%)', // --destructive
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)', // --muted-foreground
  }),
  loadingMessage: (base) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'hsl(220.9 39.3% 18%)',
    borderRadius: '0.375rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'hsl(220 13% 91%)',
    padding: '2px 6px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'hsl(217.9 10.6% 64.9%)',
    '&:hover': {
      backgroundColor: 'hsl(0 84.2% 60.2% / 0.2)',
      color: 'hsl(0 84.2% 60.2%)',
    },
  }),
}

export function ThemedSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  isSearchable = true,
  isClearable = true,
  isDisabled = false,
  isLoading = false,
  className,
  label,
  icon: Icon,
  ...props
}) {
  // Find the selected option object from value
  const selectedOption = options?.find((opt) => opt.value === value) || null

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-foreground" />}
          {label}
        </label>
      )}
      <Select
        options={options}
        value={selectedOption}
        onChange={(option) => onChange(option?.value || '')}
        placeholder={placeholder}
        isSearchable={isSearchable}
        isClearable={isClearable}
        isDisabled={isDisabled}
        isLoading={isLoading}
        styles={customStyles}
        menuPlacement="auto"
        menuPosition="fixed"
        {...props}
      />
    </div>
  )
}

// Format option with meta text (for faculty with abbreviation)
export function formatOptionLabel({ label, meta }) {
  if (!meta) return label
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <span className="text-xs opacity-60">({meta})</span>
    </div>
  )
}

export default ThemedSelect
