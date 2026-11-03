import * as Switch from '@radix-ui/react-switch'

interface ToggleProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ checked, onCheckedChange, disabled }: ToggleProps) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={`w-11 h-6 bg-line rounded-full relative shadow-inner focus-visible:ring-2 outline-none transition-colors data-[state=checked]:bg-accent disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  )
}