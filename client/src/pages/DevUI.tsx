import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { ProgressRow } from '../components/ui/ProgressRow'
import { SeverityDot } from '../components/ui/SeverityDot'
import { PillSwitcher } from '../components/ui/PillSwitcher'
import { NumberField } from '../components/inputs/NumberField'
import { DayChips } from '../components/inputs/DayChips'
import { ErrorState } from '../components/ui/feedback/ErrorState'
import { Skeleton } from '../components/ui/feedback/Skeleton'
import { useState } from 'react'
import { Toggle } from '../components/ui/Toggle'

export default function DevUI() {
  const [num, setNum] = useState(24)
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [activeTab, setActiveTab] = useState('Today')

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-semibold mb-8">Component Primitives</h1>
        
        <div className="space-y-10">
          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4">Buttons & Controls</h2>
            <Card className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary action</Button>
              <Button variant="soft">Soft action</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost link</Button>
              <Button variant="primary" loading>Saving</Button>
              <div className="w-px h-8 bg-line mx-2" />
              <Toggle />
              <NumberField value={num} onChange={setNum} min={18} max={30} unit="°C" />
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4">Navigation & Selections</h2>
            <Card className="space-y-6">
              <PillSwitcher 
                options={['Today', 'Week', 'Month', 'Range']} 
                defaultSelected={activeTab}
                onChange={setActiveTab}
              />
              <div>
                <p className="text-sm font-medium text-ink mb-2">Active days</p>
                <DayChips selectedDays={days} onChange={setDays} />
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4">Cards & Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard 
                label="Energy used today" 
                value="142.6"
                unit="kWh"
                delta={{ value: "12% less", trend: "good" }} 
                source="measured" 
              />
              <StatCard 
                label="Estimated savings" 
                value="₹ 4,250" 
                delta={{ value: "5% more", trend: "bad" }} 
                source="estimated" 
              />
              <Card title="Room consumption" className="col-span-1 md:col-span-2">
                <div className="space-y-2">
                  <ProgressRow label="Computer Lab 1" value={36.4} max={100} unit="kWh" percentage={25} />
                  <ProgressRow label="Seminar Hall" value={32.6} max={100} unit="kWh" percentage={23} />
                  <ProgressRow label="Admin Office" value={18.9} max={100} unit="kWh" percentage={13} />
                </div>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4">Feedback & Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="flex flex-col justify-center gap-3">
                <SeverityDot level="Critical" />
                <SeverityDot level="High" />
                <SeverityDot level="Medium" />
                <SeverityDot level="Low" />
              </Card>
              <Card className="col-span-2">
                <ErrorState message="Failed to load predictions. The AI model is unreachable." onRetry={() => {}} />
              </Card>
              <Card className="col-span-3 flex gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="flex-1 space-y-3 py-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}