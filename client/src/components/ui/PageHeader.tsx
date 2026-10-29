interface PageHeaderProps {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">{title}</h1>
      {description && <p className="text-sm text-ink-2">{description}</p>}
    </div>
  )
}