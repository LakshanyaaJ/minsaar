import { twMerge } from 'tailwind-merge'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={twMerge("animate-pulse bg-line rounded-inner", className)} />
  )
}