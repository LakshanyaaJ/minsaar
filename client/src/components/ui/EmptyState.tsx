import { Card } from './Card'

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-12 bg-page border border-dashed border-line shadow-none">
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-2 mb-4 max-w-sm">{description}</p>
      {action}
    </Card>
  )
}