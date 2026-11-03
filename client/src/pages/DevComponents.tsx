import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PillSwitcher } from '../components/ui/PillSwitcher'
import { StatCard } from '../components/ui/StatCard'
import { Toggle } from '../components/ui/Toggle'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SeverityDot } from '../components/ui/SeverityDot'
// Note: Imports pointing to the original locations. If you move them to /feedback, update these!
import { Skeleton } from '../components/ui/feedback/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'

export default function DevComponents() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6">Minsaar Design System</h1>
        
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-tight">Cards & Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard 
                label="Energy used today" 
                value="142.6 kWh" 
                delta={{ value: "12% less", trend: "good" }} 
                source="measured" 
              />
              <StatCard 
                label="Estimated Savings" 
                value="₹ 4,250" 
                delta={{ value: "5% more", trend: "bad" }} 
                source="estimated" 
              />
              <Card className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-ink-2">Standard Card</h3>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-tight">Controls</h2>
            <Card className="flex flex-wrap items-center gap-6">
              <Button variant="primary">Apply schedule</Button>
              <Button variant="outline">Modify</Button>
              <Button variant="ghost">Dismiss</Button>
              
              <div className="w-px h-8 bg-line" />
              
              <PillSwitcher options={['Today', 'Week', 'Month', 'Range']} />
              
              <div className="w-px h-8 bg-line" />
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-2">AC Unit</span>
                <Toggle />
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-tight">Inputs & Indicators</h2>
            <Card className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Tariff (₹/kWh)</label>
                <Input defaultValue="8.50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Building</label>
                <Select>
                  <option>Admin Block</option>
                  <option>Computer Lab 2</option>
                  <option>Seminar Hall</option>
                </Select>
              </div>
              <div className="flex flex-col justify-center gap-2">
                <SeverityDot level="Critical" />
                <SeverityDot level="High" />
                <SeverityDot level="Medium" />
                <SeverityDot level="Low" />
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-tight">States</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState 
                title="No anomalies detected"
                description="All rooms are running within their scheduled windows and temperature bands."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}