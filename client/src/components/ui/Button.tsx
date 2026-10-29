import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'soft' | 'outline' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-200 focus-visible:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variants = {
    primary: "bg-accent text-white hover:bg-[#E05D25]",
    soft: "bg-accent-soft text-accent hover:bg-[#FCD8C5]",
    outline: "border border-line bg-transparent text-ink hover:bg-page",
    ghost: "bg-transparent text-ink-2 hover:bg-page hover:text-ink"
  }

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  }

  return (
    <button 
      className={twMerge(baseStyles, variants[variant], sizes[size], className)} 
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}