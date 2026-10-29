import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={twMerge(
          "flex h-10 w-full rounded-inner border border-line bg-transparent px-3 py-2 text-sm placeholder:text-ink-3 focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'