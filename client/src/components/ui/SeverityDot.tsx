type Severity = 'Critical' | 'High' | 'Medium' | 'Low'

export function SeverityDot({ level, showLabel = true }: { level: Severity; showLabel?: boolean }) {
  const colors = {
    Critical: 'bg-rose',
    High: 'bg-accent',
    Medium: 'bg-amber',
    Low: 'bg-mint'
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[level]}`} />
      {showLabel && <span className="text-sm font-medium text-ink-2">{level}</span>}
    </div>
  )
}