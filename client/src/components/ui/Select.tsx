import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ChevronDown } from 'lucide-react'

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={twMerge(
          "flex h-10 w-full appearance-none rounded-inner border border-line bg-transparent px-3 py-2 pr-8 text-sm focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-ink-3 pointer-events-none" />
    </div>
  )
}