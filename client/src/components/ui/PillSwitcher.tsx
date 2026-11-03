import { useState } from 'react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

interface PillSwitcherProps {
  options: string[]
  defaultSelected?: string
  onChange?: (val: string) => void
}

export function PillSwitcher({ options, defaultSelected, onChange }: PillSwitcherProps) {
  const [selected, setSelected] = useState(defaultSelected || options[0])

  const handleSelect = (option: string) => {
    setSelected(option)
    onChange?.(option)
  }

  return (
    <div className="inline-flex bg-page p-1 rounded-full border border-line">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          className={twMerge(
            "relative px-4 py-1.5 text-sm font-semibold rounded-full transition-colors z-10",
            selected === option ? "text-ink" : "text-ink-2 hover:text-ink"
          )}
        >
          {selected === option && (
            <motion.div
              layoutId={`pill-bg-${options.join('-')}`}
              className="absolute inset-0 bg-card rounded-full shadow-sm -z-10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          {option}
        </button>
      ))}
    </div>
  )
}