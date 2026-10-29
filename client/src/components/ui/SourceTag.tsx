import { twMerge } from 'tailwind-merge'

type SourceType = 'measured' | 'simulated' | 'predicted' | 'estimated'

export function SourceTag({ type, className }: { type: SourceType; className?: string }) {
  const styles = {
    measured: "bg-page text-ink-2 border border-solid border-line",
    simulated: "bg-transparent text-ink-3 border border-dashed border-ink-3",
    predicted: "bg-amber/10 text-amber border border-dotted border-amber/50",
    estimated: "bg-accent-soft text-accent border border-dashed border-accent/30"
  }

  // Sentence case display text
  const displayText = type.charAt(0).toUpperCase() + type.slice(1)

  return (
    <span className={twMerge("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium tracking-tight", styles[type], className)}>
      {displayText}
    </span>
  )
}