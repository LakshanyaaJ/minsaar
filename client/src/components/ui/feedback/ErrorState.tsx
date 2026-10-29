import { Card } from '../Card'
import { Button } from '../Button'
import { AlertCircle } from 'lucide-react'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 bg-rose/5 border border-dashed border-rose/20 shadow-none">
      <AlertCircle className="w-8 h-8 text-rose mb-3 opacity-80" />
      <p className="text-sm font-medium text-ink mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  )
}