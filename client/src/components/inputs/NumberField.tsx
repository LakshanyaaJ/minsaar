import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Minus, Plus } from 'lucide-react'

interface NumberFieldProps {
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  unit?: string
}

export function NumberField({ value, onChange, min, max, step = 1, className, unit }: NumberFieldProps) {
  const handleDec = () => {
    if (min === undefined || value - step >= min) onChange(value - step)
  }
  
  const handleInc = () => {
    if (max === undefined || value + step <= max) onChange(value + step)
  }

  return (
    <div className={twMerge("inline-flex items-center p-1 bg-page rounded-full border border-line", className)}>
      <button 
        type="button"
        onClick={handleDec}
        disabled={min !== undefined && value <= min}
        className="p-1.5 rounded-full text-ink-2 hover:bg-card hover:text-ink disabled:opacity-50 transition-colors focus-visible:ring-2 outline-none"
      >
        <Minus size={16} />
      </button>
      <div className="w-12 text-center text-sm font-semibold tabular-nums text-ink">
        {value}{unit}
      </div>
      <button 
        type="button"
        onClick={handleInc}
        disabled={max !== undefined && value >= max}
        className="p-1.5 rounded-full text-ink-2 hover:bg-card hover:text-ink disabled:opacity-50 transition-colors focus-visible:ring-2 outline-none"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}