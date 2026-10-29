import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, CartesianGrid, ReferenceArea
} from 'recharts'
import { ThermometerSun, Info } from 'lucide-react'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { NumberField } from '../../components/inputs/NumberField'
import { StatCard } from '../../components/ui/StatCard'
import { PillSwitcher } from '../../components/ui/PillSwitcher'
import { SourceTag } from '../../components/ui/SourceTag'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { EmptyState } from '../../components/ui/EmptyState'

import { useBuildings, useRooms, useSettings, useRecommendations, usePatchRecommendation } from '../../hooks/queries'
import { useFiltersStore } from '../../store/filters'
import { apiClient } from '../../api/client'
import { useQuery } from '@tanstack/react-query'

// --- SVG Circular Gauge ---
interface GaugeProps {
  current: number
  minBound: number
  maxBound: number
  absoluteMin?: number
  absoluteMax?: number
}

function Gauge({ current, minBound, maxBound, absoluteMin = 16, absoluteMax = 32 }: GaugeProps) {
  const radius = 80
  const strokeWidth = 12
  const center = radius + strokeWidth
  const size = center * 2
  
  const startAngle = -120 // Start bottom-left
  const endAngle = 120    // End bottom-right
  const totalAngle = endAngle - startAngle // equals 240 degrees

  const valToAngle = (val: number) => {
    const clamped = Math.max(absoluteMin, Math.min(absoluteMax, val))
    const pct = (clamped - absoluteMin) / (absoluteMax - absoluteMin)
    return startAngle + (pct * totalAngle)
  }

  const polarToCartesian = (angleDeg: number) => {
    const r = (angleDeg - 90) * Math.PI / 180.0
    return {
      x: center + (radius * Math.cos(r)),
      y: center + (radius * Math.sin(r))
    }
  }

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start)
    const e = polarToCartesian(end)
    const largeArc = end - start <= 180 ? "0" : "1"
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  // Determine status & color
  let statusColor = 'var(--mint)'
  let statusText = 'Within preferred range'
  if (current < minBound) {
    statusColor = 'var(--sky)'
    statusText = 'Below preferred range'
  } else if (current > maxBound) {
    statusColor = 'var(--accent)'
    statusText = 'Above preferred range'
  }

  const bandStartAngle = valToAngle(minBound)
  const bandEndAngle = valToAngle(maxBound)
  const currentAngle = valToAngle(current)
  const currentPoint = polarToCartesian(currentAngle)

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size - 40 }}>
        <svg width={size} height={size} className="drop-shadow-sm">
          {/* Background track */}
          <path d={describeArc(startAngle, endAngle)} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} strokeLinecap="round" />
          
          {/* Preferred Band */}
          <path d={describeArc(bandStartAngle, bandEndAngle)} fill="none" stroke="var(--mint-soft)" strokeWidth={strokeWidth} strokeLinecap="round" />
          
          {/* Current Value Indicator Dot */}
          <circle cx={currentPoint.x} cy={currentPoint.y} r={strokeWidth - 2} fill={statusColor} className="shadow-sm transition-all duration-700 ease-out" />
        </svg>
        
        <div className="absolute inset-0 top-6 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-4xl font-semibold text-ink tracking-tight tabular-nums mt-4">
            {current.toFixed(1)}<span className="text-2xl text-ink-3">°C</span>
          </div>
          <div className="text-xs font-semibold text-ink-2 uppercase tracking-tight mt-1">Indoor</div>
        </div>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-4 border" style={{ borderColor: `${statusColor}40`, backgroundColor: `${statusColor}15`, color: statusColor === 'var(--accent)' ? '#D95321' : statusColor === 'var(--sky)' ? '#0C83A8' : '#27864F' }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <span className="text-xs font-semibold">{statusText}</span>
      </div>
    </div>
  )
}


export default function Temperature() {
  const { selectedBuildingId, selectedRoomId, setRoom } = useFiltersStore()
  
  const { data: buildings } = useBuildings()
  const { data: rooms } = useRooms()
  const { data: allAcUnits } = useQuery({ queryKey: ['acUnits'], queryFn: apiClient.getAcUnits })
  const { data: recommendations } = useRecommendations()
  const patchRecommendation = usePatchRecommendation()

  const [historyRange, setHistoryRange] = useState('24 hours')
  const [localSetpoint, setLocalSetpoint] = useState(24)
  const [localMin, setLocalMin] = useState(22)
  const [localMax, setLocalMax] = useState(25)

  // Sync state when room changes
  const activeRoom = useMemo(() => rooms?.find(r => r.id === selectedRoomId), [rooms, selectedRoomId])
  const activeUnits = useMemo(() => allAcUnits?.filter(u => u.roomId === selectedRoomId) || [], [allAcUnits, selectedRoomId])
  const activeUnit = activeUnits[0] // Simplify to first unit for demo

  React.useEffect(() => {
    if (activeRoom) {
      setLocalMin(activeRoom.minTempC)
      setLocalMax(activeRoom.maxTempC)
      setLocalSetpoint(activeRoom.name === 'Seminar Hall' ? 18 : 24) // Hardcode mock anomaly state
    }
  }, [activeRoom])

  // Mock readings for history
  const historyData = useMemo(() => {
    if (!activeRoom) return []
    return Array.from({ length: historyRange === '24 hours' ? 24 : 7 }).map((_, i) => {
      const time = historyRange === '24 hours' ? `${i.toString().padStart(2, '0')}:00` : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]
      return {
        time,
        indoor: activeRoom.name === 'Seminar Hall' ? 22 + Math.random() : 24 + (Math.random() * 2 - 1),
        setpoint: activeRoom.name === 'Seminar Hall' ? 18 : 24,
      }
    })
  }, [historyRange, activeRoom])

  const rec = recommendations?.find(r => r.roomId === selectedRoomId && r.type === 'temperature' && r.status === 'pending')

  const handleApplyRec = () => {
    if (rec) patchRecommendation.mutate({ id: rec.id, updates: { status: 'accepted' } })
    setLocalSetpoint(24) // mock apply
  }

  if (!buildings || !rooms) return <div className="p-8">Loading...</div>

  // Group rooms by building
  const groupedRooms = buildings.map(b => ({
    building: b,
    rooms: rooms.filter(r => r.buildingId === b.id)
  })).filter(g => g.rooms.length > 0)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="Temperature" description="Live indoor conditions and setpoints." />

      {/* Top Bar / Picker */}
      <Card className="flex items-center gap-4 py-4">
        <label className="text-sm font-semibold text-ink whitespace-nowrap">Select room:</label>
        <Select value={selectedRoomId || ''} onChange={(e) => setRoom(e.target.value)} className="max-w-xs">
          <option value="" disabled>Choose a room...</option>
          {groupedRooms.map(group => (
            <optgroup key={group.building.id} label={group.building.name}>
              {group.rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Card>

      {!activeRoom ? (
        <EmptyState title="No room selected" description="Select a room from the dropdown above to view temperature details." />
      ) : (
        <>
          <div className="grid grid-cols-12 gap-6">
            
            {/* Centre Gauge Card */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-5 flex flex-col items-center justify-center min-h-[300px]">
              <Gauge 
                current={activeRoom.name === 'Seminar Hall' ? 22.1 : 24.5} 
                minBound={localMin} 
                maxBound={localMax} 
              />
            </Card>

            {/* Setpoint Editor Card */}
            <Card className="col-span-12 md:col-span-6 lg:col-span-3 flex flex-col justify-between min-h-[300px] border border-line">
              <div>
                <h2 className="text-base font-semibold text-ink mb-1">AC setpoint</h2>
                <p className="text-xs text-ink-2 mb-6">Target temperature for the unit.</p>
                <div className="flex justify-center mb-8">
                  <NumberField value={localSetpoint} onChange={setLocalSetpoint} min={16} max={30} unit="°C" className="scale-125 origin-top" />
                </div>
              </div>
              <div className="space-y-3">
                {activeUnit?.controlMode === 'recommend_only' && (
                  <div className="text-[10px] text-ink-2 bg-page p-2 rounded leading-tight">
                    Recommendation-only mode: changes are saved as plans and not sent to the AC.
                  </div>
                )}
                <Button variant="primary" className="w-full" onClick={() => alert('Saved mock setpoint')}>Save setpoint</Button>
              </div>
            </Card>

            {/* Stat Tiles */}
            <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-4">
              <StatCard label="Indoor" value="22.1" unit="°C" source="measured" />
              <StatCard label="AC setpoint" value={localSetpoint} unit="°C" source="measured" />
              <StatCard label="Occupancy" value="Empty" source="measured" sparkline={<div className="text-xs text-ink-3 mt-1">Last motion 2h ago</div>} />
              <StatCard label="Outdoor" value="28.4" unit="°C" source="measured" />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* History Chart */}
            <Card className="col-span-12 lg:col-span-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-semibold text-ink">Temperature history</h2>
                <PillSwitcher options={['24 hours', '7 days']} defaultSelected={historyRange} onChange={setHistoryRange} />
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                    <YAxis domain={[16, 32]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                    <RechartsTooltip content={<ChartTooltip valueSuffix=" °C" />} />
                    
                    {/* Preferred Band */}
                    <ReferenceArea y1={localMin} y2={localMax} fill="var(--mint-soft)" fillOpacity={0.4} strokeOpacity={0} />
                    
                    <Line type="stepAfter" dataKey="setpoint" name="Setpoint" stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="indoor" name="Indoor" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--accent)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Threshold Editor & Recommendation */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              
              <Card>
                <h2 className="text-base font-semibold text-ink mb-1">Room thresholds</h2>
                <p className="text-xs text-ink-2 mb-4">Bounds come from campus policy but can be overridden per room.</p>
                
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-3 uppercase">Min °C</label>
                    <NumberField value={localMin} onChange={(v) => { if (v < localMax) setLocalMin(v) }} min={16} max={30} />
                  </div>
                  <div className="text-ink-3 mt-4">-</div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-3 uppercase">Max °C</label>
                    <NumberField value={localMax} onChange={(v) => { if (v > localMin) setLocalMax(v) }} min={16} max={30} />
                  </div>
                </div>
                <Button variant="outline" className="w-full" size="sm">Save thresholds</Button>
              </Card>

              {rec && (
                <Card className="border border-amber/30 bg-amber/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber" />
                  <div className="flex items-center gap-2 mb-3">
                    <ThermometerSun size={16} className="text-amber" />
                    <h3 className="text-sm font-semibold text-ink">Suggested change</h3>
                  </div>
                  <p className="text-sm text-ink-2 mb-4 leading-relaxed">
                    {activeRoom.name} is at 22.1°C, below its {localMin} to {localMax}°C range, while the AC is set to 18°C. Raising the setpoint to 24°C should keep the room comfortable and reduce running time.
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-card p-2 rounded-inner border border-line mb-2">
                      <span className="text-xs font-medium text-ink-2">Estimated savings</span>
                      <div className="text-xs font-semibold text-ink">
                        <span className="text-mint mr-2">{rec.estKwh} kWh</span> ₹ {rec.estCostInr}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => patchRecommendation.mutate({ id: rec.id, updates: { status: 'rejected' } })}>Dismiss</Button>
                      <Button variant="primary" size="sm" className="flex-1" onClick={handleApplyRec}>Apply</Button>
                    </div>
                    <div className="text-[10px] text-center text-ink-3 mt-1 flex items-center justify-center gap-1">
                      <Info size={10} /> Changes are sent through authorised controls only.
                    </div>
                  </div>
                </Card>
              )}

            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}