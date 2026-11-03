import { Card } from './Card'
import { SourceTag } from './SourceTag'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { DataSource } from '../../types/domain'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: { value: string; trend: 'good' | 'bad' | 'neutral' }
  source: DataSource
  sparkline?: React.ReactNode
}

export function StatCard({ label, value, unit, delta, source, sparkline }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2 relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <h3 className="text-sm font-semibold text-ink-2">{label}</h3>
        {delta && delta.trend !== 'neutral' && (
          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            delta.trend === 'good' ? 'bg-mint-soft text-[#2F9E5D]' : 'bg-rose/10 text-rose'
          }`}>
            {delta.trend === 'good' ? <ArrowDownRight size={14} className="mr-0.5" /> : <ArrowUpRight size={14} className="mr-0.5" />}
            {delta.value}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1 z-10 mt-1">
        <div className="text-3xl font-semibold text-ink tracking-tight">
          {value}
        </div>
        {unit && <span className="text-sm font-medium text-ink-2">{unit}</span>}
      </div>
      <div className="mt-auto pt-2 z-10 flex justify-between items-end">
        <SourceTag type={source} />
        {sparkline && <div className="w-16 h-8">{sparkline}</div>}
      </div>
    </Card>
  )
}