interface ProgressRowProps {
  label: string
  value: number
  max: number
  unit: string
  percentage: number
}

export function ProgressRow({ label, value, max, unit, percentage }: ProgressRowProps) {
  const width = Math.min(100, Math.max(0, (value / max) * 100))
  
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-ink">{label}</span>
          <span className="text-ink-3">{percentage}%</span>
        </div>
        <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <div className="w-20 text-right">
        <span className="text-lg font-semibold text-ink">{value}</span>
        <span className="text-xs text-ink-2 ml-1">{unit}</span>
      </div>
    </div>
  )
}