import { twMerge } from 'tailwind-merge'

interface DayChipsProps {
  selectedDays: number[] // 0-6
  onChange: (days: number[]) => void
}

const DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

export function DayChips({ selectedDays, onChange }: DayChipsProps) {
  const toggle = (val: number) => {
    if (selectedDays.includes(val)) {
      onChange(selectedDays.filter(d => d !== val))
    } else {
      onChange([...selectedDays, val].sort())
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map(day => {
        const isSelected = selectedDays.includes(day.value)
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={twMerge(
              "px-3 py-1.5 text-xs font-semibold rounded-full transition-colors focus-visible:ring-2 outline-none",
              isSelected 
                ? "bg-ink text-white" 
                : "bg-page text-ink-2 border border-line hover:border-ink-3"
            )}
          >
            {day.label}
          </button>
        )
      })}
    </div>
  )
}