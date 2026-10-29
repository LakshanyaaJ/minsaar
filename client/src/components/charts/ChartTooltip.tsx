import { twMerge } from 'tailwind-merge'

interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  valuePrefix?: string
  valueSuffix?: string
}

export function ChartTooltip({ active, payload, label, valuePrefix = '', valueSuffix = '' }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-ink text-white rounded-inner px-3 py-2 text-sm shadow-xl border border-ink/20 pointer-events-none">
      <div className="text-ink-3 text-xs mb-1 font-medium">{label}</div>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 font-semibold tabular-nums">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color || entry.payload.fill }} 
            />
            <span>{entry.name}:</span>
            <span>{valuePrefix}{entry.value}{valueSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  )
}