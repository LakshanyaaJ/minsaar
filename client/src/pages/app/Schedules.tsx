import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertCircle, Calendar, Info, Check, Copy, X } from 'lucide-react'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { DayChips } from '../../components/inputs/DayChips'
import { NumberField } from '../../components/inputs/NumberField'
import { Skeleton } from '../../components/ui/feedback/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'

import { apiClient } from '../../api/client'
import { useBuildings, useRooms, useSchedules, useRecommendations, usePatchRecommendation, useUpsertSchedule } from '../../hooks/queries'
import { useFiltersStore } from '../../store/filters'
import type { AcUnit } from '../../types/domain'

// --- Time Helpers ---
const timeToMins = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
const minsToTime = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// --- Schema ---
const formSchema = z.object({
  days: z.array(z.number()).min(1, "Select at least one day."),
  onTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM format."),
  offTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Use HH:MM format."),
  setpoint: z.number().min(16).max(30)
}).refine(data => timeToMins(data.onTime) < timeToMins(data.offTime), {
  message: "OFF time must be after ON time.",
  path: ["offTime"]
})

type FormValues = z.infer<typeof formSchema>

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// --- Draggable Bar Component ---
interface TimeBarProps {
  dayIdx: number
  active: boolean
  startMins: number
  endMins: number
  onUpdate: (start: number, end: number) => void
  onToggle: (active: boolean) => void
}

function TimeBar({ dayIdx, active, startMins, endMins, onUpdate, onToggle }: TimeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef<'none' | 'move' | 'left' | 'right'>('none')
  const dragStartX = useRef(0)
  const initialStart = useRef(startMins)
  const initialEnd = useRef(endMins)

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'left' | 'right') => {
    if (!active) return
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = type
    dragStartX.current = e.clientX
    initialStart.current = startMins
    initialEnd.current = endMins
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging.current === 'none' || !trackRef.current) return
    const trackWidth = trackRef.current.getBoundingClientRect().width
    const minsPerPixel = 1440 / trackWidth
    const deltaMins = (e.clientX - dragStartX.current) * minsPerPixel
    
    let newStart = initialStart.current
    let newEnd = initialEnd.current

    if (isDragging.current === 'move') {
      newStart += deltaMins
      newEnd += deltaMins
      if (newStart < 0) { newEnd -= newStart; newStart = 0; }
      if (newEnd > 1440) { newStart -= (newEnd - 1440); newEnd = 1440; }
    } else if (isDragging.current === 'left') {
      newStart = Math.min(newEnd - 15, Math.max(0, newStart + deltaMins))
    } else if (isDragging.current === 'right') {
      newEnd = Math.max(newStart + 15, Math.min(1440, newEnd + deltaMins))
    }

    // Snap to 15 mins
    newStart = Math.round(newStart / 15) * 15
    newEnd = Math.round(newEnd / 15) * 15
    onUpdate(newStart, newEnd)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = 'none';
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!active) return
    let newStart = startMins
    let newEnd = endMins
    const step = 15

    if (e.key === 'ArrowLeft') {
      if (e.shiftKey) newStart = Math.max(0, newStart - step)
      else if (newStart - step >= 0) { newStart -= step; newEnd -= step; }
    } else if (e.key === 'ArrowRight') {
      if (e.shiftKey) newEnd = Math.min(1440, newEnd + step)
      else if (newEnd + step <= 1440) { newStart += step; newEnd += step; }
    } else return

    e.preventDefault()
    onUpdate(newStart, newEnd)
  }

  const leftPct = (startMins / 1440) * 100
  const widthPct = ((endMins - startMins) / 1440) * 100

  return (
    <div className="flex items-center gap-4 py-3 border-b border-line last:border-0 group">
      <div className="w-16 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-2">{DAYS[dayIdx]}</span>
        <Toggle checked={active} onCheckedChange={onToggle} />
      </div>
      <div className="flex-1 h-8 relative bg-page rounded-full" ref={trackRef}>
        {active && (
          <div 
            className="absolute top-0 bottom-0 bg-accent-soft border border-accent/20 rounded-full flex items-center outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-grab active:cursor-grabbing"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            tabIndex={0}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown}
          >
            <div 
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-accent/20 rounded-l-full"
              onPointerDown={(e) => handlePointerDown(e, 'left')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            <div className="flex-1 flex justify-center items-center overflow-hidden px-2 pointer-events-none">
              <span className="text-[10px] font-semibold text-accent tabular-nums tracking-tight whitespace-nowrap">
                {minsToTime(startMins)} - {minsToTime(endMins)}
              </span>
            </div>
            <div 
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-accent/20 rounded-r-full"
              onPointerDown={(e) => handlePointerDown(e, 'right')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main Component ---
export default function Schedules() {
  const { selectedBuildingId, selectedRoomId, setBuilding, setRoom } = useFiltersStore()
  
  const { data: buildings } = useBuildings()
  const { data: rooms } = useRooms()
  const { data: allAcUnits } = useQuery({ queryKey: ['acUnits'], queryFn: apiClient.getAcUnits })
  const { data: schedules } = useSchedules()
  const { data: recommendations } = useRecommendations()
  
  const patchRecommendation = usePatchRecommendation()
  const upsertSchedule = useUpsertSchedule()

  const [selectedUnit, setSelectedUnit] = useState<AcUnit | null>(null)
  const [workingSchedule, setWorkingSchedule] = useState<Record<number, { active: boolean, start: number, end: number, setpoint: number }>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  // Filter lists
  const filteredRooms = useMemo(() => rooms?.filter(r => r.buildingId === selectedBuildingId) || [], [rooms, selectedBuildingId])
  const filteredUnits = useMemo(() => allAcUnits?.filter(u => u.roomId === selectedRoomId) || [], [allAcUnits, selectedRoomId])
  const activeRoom = useMemo(() => rooms?.find(r => r.id === selectedRoomId), [rooms, selectedRoomId])

  const currentRecommendation = recommendations?.find(r => r.roomId === selectedRoomId && r.type === 'schedule' && r.status === 'pending')

  // Form setup
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { days: [1,2,3,4,5], onTime: '08:45', offTime: '16:30', setpoint: 24 }
  })
  const selectedDays = watch('days')

  // Load schedules into working state when unit changes
  useEffect(() => {
    if (selectedUnit && schedules) {
      const unitSchedules = schedules.filter(s => s.acUnitId === selectedUnit.id)
      const newWork: any = {}
      for (let i = 0; i < 7; i++) {
        const sch = unitSchedules.find(s => s.weekday === i)
        if (sch) {
          newWork[i] = { active: sch.active, start: timeToMins(sch.onTime), end: timeToMins(sch.offTime), setpoint: sch.setpointC }
        } else {
          newWork[i] = { active: false, start: 525, end: 990, setpoint: 24 } // 8:45 to 16:30 defaults
        }
      }
      setWorkingSchedule(newWork)
    }
  }, [selectedUnit, schedules])

  // Apply form values to working grid
  const applyFormToGrid = (data: FormValues) => {
    const newWork = { ...workingSchedule }
    data.days.forEach(day => {
      newWork[day] = {
        active: true,
        start: timeToMins(data.onTime),
        end: timeToMins(data.offTime),
        setpoint: data.setpoint
      }
    })
    setWorkingSchedule(newWork)
  }

  const copyMondayToWeekdays = () => {
    const mon = workingSchedule[1]
    if (!mon) return
    const newWork = { ...workingSchedule }
    ;[2,3,4,5].forEach(day => {
      newWork[day] = { ...mon }
    })
    setWorkingSchedule(newWork)
  }

  const acceptRecommendation = () => {
    if (!currentRecommendation || !selectedUnit) return
    // Mock application: just shrink Friday by 30 mins to simulate the suggestion
    const newWork = { ...workingSchedule }
    if (newWork[5] && newWork[5].active) {
      newWork[5].end = Math.max(newWork[5].start, newWork[5].end - 30)
    }
    setWorkingSchedule(newWork)
    patchRecommendation.mutate({ id: currentRecommendation.id, updates: { status: 'accepted' } })
  }

  const handleSaveConfirmed = async () => {
    if (!selectedUnit) return
    for (let i = 0; i < 7; i++) {
      const w = workingSchedule[i]
      await upsertSchedule.mutateAsync({
        id: `sch_${selectedUnit.id}_${i}`,
        acUnitId: selectedUnit.id,
        weekday: i,
        onTime: minsToTime(w.start),
        offTime: minsToTime(w.end),
        setpointC: w.setpoint,
        active: w.active
      })
    }
    setShowConfirm(false)
  }

  if (!buildings || !rooms || !allAcUnits) {
    return <div><PageHeader title="Schedules" description="Manage weekly timetables and exceptions." /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Schedules" description="Manage weekly timetables and exceptions." />
      
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Left Panel: Selectors */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <Card className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-1.5 block">Building</label>
              <Select value={selectedBuildingId || ''} onChange={(e) => { setBuilding(e.target.value); setSelectedUnit(null); }}>
                <option value="" disabled>Select building...</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-1.5 block">Room</label>
              <Select value={selectedRoomId || ''} onChange={(e) => { setRoom(e.target.value); setSelectedUnit(null); }} disabled={!selectedBuildingId}>
                <option value="" disabled>Select room...</option>
                {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
          </Card>

          {selectedRoomId && (
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-line bg-page/50">
                <h3 className="text-sm font-semibold text-ink">AC Units</h3>
              </div>
              <div className="divide-y divide-line">
                {filteredUnits.length === 0 && <div className="p-4 text-sm text-ink-3">No units found.</div>}
                {filteredUnits.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => setSelectedUnit(unit)}
                    className={`w-full text-left p-4 hover:bg-page transition-colors flex items-center justify-between outline-none focus-visible:bg-page ${selectedUnit?.id === unit.id ? 'bg-accent-soft/30' : ''}`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{unit.id.split('_').pop()?.toUpperCase() || unit.id}</div>
                      <div className="text-xs text-ink-2">{unit.ratedKw} kW</div>
                    </div>
                    {unit.controlMode === 'recommend_only' 
                      ? <span className="text-[10px] uppercase font-semibold text-ink-3 bg-page px-2 py-1 rounded">Recommendation-only</span>
                      : <Toggle checked={true} disabled />
                    }
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Main Area: Grid & Forms */}
        {selectedUnit ? (
          <div className="col-span-12 lg:col-span-9 space-y-6">
            
            {/* Banner */}
            {selectedUnit.controlMode === 'recommend_only' && (
              <div className="flex items-start gap-3 p-4 bg-sky/10 text-sky border border-sky/20 rounded-inner">
                <Info size={20} className="shrink-0 mt-0.5" />
                <div className="text-sm font-medium">
                  Recommendation-only mode: schedules are saved as plans and not sent to the AC.
                </div>
              </div>
            )}

            {/* AI Suggestion */}
            {currentRecommendation && (
              <Card className="border border-amber/30 bg-amber/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2 mb-1">
                      <Calendar size={16} className="text-amber" /> 
                      {currentRecommendation.issue}
                    </h3>
                    <p className="text-sm text-ink-2 mb-2">{currentRecommendation.evidence[0]}</p>
                    <div className="flex gap-4 text-xs font-semibold">
                      <span className="text-mint">Est. savings: {currentRecommendation.estKwh} kWh</span>
                      <span className="text-ink-2">₹ {currentRecommendation.estCostInr}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => patchRecommendation.mutate({ id: currentRecommendation.id, updates: { status: 'rejected' } })}>Dismiss</Button>
                    <Button variant="outline" size="sm" onClick={acceptRecommendation}>Apply suggestion</Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Weekly Grid */}
              <Card className="xl:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-semibold text-ink">Weekly Timeline</h2>
                  <div className="text-xs text-ink-3 font-medium">Drag to move • Shift+Arrow to resize</div>
                </div>
                
                <div className="relative pt-6">
                  {/* Timeline markers */}
                  <div className="absolute top-0 left-16 right-0 flex justify-between text-[10px] font-semibold text-ink-3 px-2">
                    <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                  </div>
                  
                  {Object.keys(workingSchedule).length > 0 && [1,2,3,4,5,6,0].map(dayIdx => (
                    <TimeBar
                      key={dayIdx}
                      dayIdx={dayIdx}
                      active={workingSchedule[dayIdx].active}
                      startMins={workingSchedule[dayIdx].start}
                      endMins={workingSchedule[dayIdx].end}
                      onUpdate={(s, e) => setWorkingSchedule(prev => ({ ...prev, [dayIdx]: { ...prev[dayIdx], start: s, end: e } }))}
                      onToggle={(active) => setWorkingSchedule(prev => ({ ...prev, [dayIdx]: { ...prev[dayIdx], active } }))}
                    />
                  ))}
                </div>
              </Card>

              {/* Side Form */}
              <div className="space-y-6">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-ink">Bulk Edit</h2>
                  </div>
                  
                  <form onSubmit={handleSubmit(applyFormToGrid)} className="space-y-5">
                    <div>
                      <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-2 block">Apply to days</label>
                      <Controller
                        name="days"
                        control={control}
                        render={({ field }) => (
                          <DayChips selectedDays={field.value} onChange={field.onChange} />
                        )}
                      />
                      {errors.days && <p className="text-xs text-rose mt-1">{errors.days.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-1.5 block">ON time</label>
                        <Input type="time" {...register('onTime')} />
                        {errors.onTime && <p className="text-xs text-rose mt-1">{errors.onTime.message}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-1.5 block">OFF time</label>
                        <Input type="time" {...register('offTime')} />
                        {errors.offTime && <p className="text-xs text-rose mt-1">{errors.offTime.message}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-1.5 block">Setpoint</label>
                      <Controller
                        name="setpoint"
                        control={control}
                        render={({ field }) => (
                          <NumberField value={field.value} onChange={field.onChange} min={16} max={30} unit="°C" className="w-full justify-center" />
                        )}
                      />
                      {activeRoom && (watch('setpoint') < activeRoom.minTempC || watch('setpoint') > activeRoom.maxTempC) && (
                        <p className="text-xs text-amber mt-2 font-medium flex gap-1 items-start">
                          <AlertCircle size={14} className="shrink-0" />
                          Outside room's standard band ({activeRoom.minTempC}-{activeRoom.maxTempC}°C).
                        </p>
                      )}
                    </div>

                    <Button type="submit" variant="soft" className="w-full">Update grid</Button>
                  </form>
                  
                  <div className="mt-4 pt-4 border-t border-line">
                    <button onClick={copyMondayToWeekdays} className="text-sm font-semibold text-ink-2 hover:text-ink flex items-center justify-center gap-2 w-full transition-colors">
                      <Copy size={14} /> Copy Monday to weekdays
                    </button>
                  </div>
                </Card>

                {/* Exceptions */}
                <Card>
                  <h2 className="text-base font-semibold text-ink mb-4">Exceptions</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-ink block">Oct 2, 2026</span>
                        <span className="text-xs text-ink-2">Holiday (Gandhi Jayanti)</span>
                      </div>
                      <button className="text-ink-3 hover:text-rose transition-colors"><X size={16} /></button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4">Add exception</Button>
                </Card>
              </div>
            </div>
            
            {/* Save Actions */}
            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-line">
              <Button variant="ghost" onClick={() => setSelectedUnit(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setShowConfirm(true)}>Review & Save</Button>
            </div>
          </div>
        ) : (
          <div className="col-span-12 lg:col-span-9">
            <EmptyState 
              title="No unit selected"
              description="Select an AC unit from the left panel to edit its schedule."
            />
          </div>
        )}
      </div>

      {/* Confirm Save Dialog */}
      <Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 transition-opacity" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card rounded-card shadow-2xl z-50 p-6 outline-none">
            <Dialog.Title className="text-lg font-semibold text-ink mb-2">Save Schedule</Dialog.Title>
            <Dialog.Description className="text-sm text-ink-2 mb-6">
              Review changes before applying them to the AC unit.
            </Dialog.Description>
            
            <div className="bg-page rounded-inner p-4 mb-6 space-y-2 text-sm font-medium">
              <div className="flex items-center gap-2 text-ink">
                <Check size={16} className="text-mint" /> Changes verified against thresholds.
              </div>
              <div className="text-ink-2 ml-6">Schedules will be updated for {selectedDays.length} days.</div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveConfirmed}>Confirm changes</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  )
}