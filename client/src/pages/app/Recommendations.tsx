import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { useForm } from 'react-hook-form'
import { 
  Check, X, Settings2, Thermometer, Calendar, 
  Lightbulb, ArrowRight, AlertCircle 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { PillSwitcher } from '../../components/ui/PillSwitcher'
import { SeverityDot } from '../../components/ui/SeverityDot'
import { SourceTag } from '../../components/ui/SourceTag'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { NumberField } from '../../components/inputs/NumberField'
import { Skeleton } from '../../components/ui/feedback/Skeleton'

import { useRecommendations, useRooms, usePatchRecommendation } from '../../hooks/queries'
import type { Recommendation } from '../../types/domain'

// --- Types & Constants ---
const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

// --- Sub-component: Recommendation Card ---
interface RecCardProps {
  rec: Recommendation
  roomName: string
  isFocused: boolean
  onAccept: (id: string) => void
  onReject: (id: string, reason?: string) => void
  onModify: (id: string, updates: any) => void
}

function RecommendationCard({ rec, roomName, isFocused, onAccept, onReject, onModify }: RecCardProps) {
  const [rejectReason, setRejectReason] = useState('')
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [isModifyOpen, setIsModifyOpen] = useState(false)
  
  // Local state for the temporary "compact accepted" row before mutation fires
  const [tempAccepted, setTempAccepted] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const { register, handleSubmit } = useForm({
    defaultValues: {
      onTime: '09:00',
      offTime: '17:00',
      setpoint: 24,
      note: ''
    }
  })

  const handleAcceptClick = () => {
    setTempAccepted(true)
    timeoutRef.current = setTimeout(() => {
      onAccept(rec.id)
    }, 8000)
  }

  const handleUndo = () => {
    setTempAccepted(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const submitReject = () => {
    onReject(rec.id, rejectReason)
    setIsRejectOpen(false)
  }

  const submitModify = (data: any) => {
    const updates = rec.type === 'schedule' 
      ? { explanation: `Modified: Set to ${data.onTime} - ${data.offTime}` }
      : rec.type === 'temperature'
      ? { explanation: `Modified: Setpoint changed to ${data.setpoint}°C` }
      : { explanation: `Modified: ${data.note}` }
    
    onModify(rec.id, updates)
    setIsModifyOpen(false)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  if (tempAccepted) {
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-mint-soft/30 border border-mint-soft rounded-card p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-white">
            <Check size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Accepted recommendation for {roomName}</div>
            <div className="text-xs text-ink-2">Changes will be applied shortly.</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleUndo}>Undo</Button>
      </motion.div>
    )
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-card rounded-card shadow-card border transition-colors duration-200 ${
        isFocused ? 'border-accent ring-1 ring-accent' : 'border-transparent'
      }`}
    >
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-ink-3 uppercase tracking-tight">{roomName}</span>
              <span className="text-ink-3">•</span>
              <SeverityDot level={rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1) as any} />
            </div>
            <h3 className="text-base font-semibold text-ink leading-tight">{rec.issue}</h3>
          </div>
          
          <div className="flex items-center gap-4 bg-page px-3 py-2 rounded-inner whitespace-nowrap">
            <div className="text-right">
              <div className="text-xs text-ink-2 font-medium mb-0.5">Est. savings</div>
              <div className="text-sm font-semibold text-ink flex gap-2">
                <span className="text-mint">{rec.estKwh} kWh</span>
                <span>₹ {rec.estCostInr}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-page/50 rounded-inner p-4 mb-5 border border-line">
          <h4 className="text-xs font-semibold text-ink-2 uppercase tracking-tight mb-2">Supporting data</h4>
          <ul className="text-sm text-ink space-y-1">
            {rec.evidence.map((ev, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent mt-1">•</span> {ev}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-semibold text-ink-2 uppercase tracking-tight mb-1">Recommended action</h4>
          <p className="text-sm text-ink leading-relaxed">{rec.action}</p>
          <p className="text-sm text-ink-3 mt-1">{rec.explanation}</p>
        </div>

        {rec.confidence > 0 && (
          <div className="mb-6 max-w-xs">
            <div className="flex justify-between text-xs font-medium text-ink-2 mb-1.5">
              <span>AI Confidence</span>
              <span>{rec.confidence}%</span>
            </div>
            <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${rec.confidence}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
          <Button variant="primary" onClick={handleAcceptClick} className="gap-2">
            <Check size={16} /> Accept
          </Button>
          
          <Dialog.Root open={isModifyOpen} onOpenChange={setIsModifyOpen}>
            <Dialog.Trigger asChild>
              <Button variant="outline" className="gap-2"><Settings2 size={16} /> Modify</Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 transition-opacity" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card rounded-card shadow-2xl z-50 p-6 outline-none">
                <Dialog.Title className="text-lg font-semibold text-ink mb-2">Modify Recommendation</Dialog.Title>
                <Dialog.Description className="text-sm text-ink-2 mb-6">
                  Adjust the parameters before applying the changes to {roomName}.
                </Dialog.Description>
                
                <form onSubmit={handleSubmit(submitModify)} className="space-y-4">
                  {rec.type === 'schedule' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink mb-1.5">ON Time</label>
                        <Input type="time" {...register('onTime')} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink mb-1.5">OFF Time</label>
                        <Input type="time" {...register('offTime')} />
                      </div>
                    </div>
                  )}
                  {rec.type === 'temperature' && (
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Target Setpoint (°C)</label>
                      <Input type="number" {...register('setpoint')} min={16} max={30} />
                    </div>
                  )}
                  {rec.type === 'energy' && (
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Adjustment Note</label>
                      <Input type="text" placeholder="State reason for modification..." {...register('note')} />
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-line">
                    <Button type="button" variant="ghost" onClick={() => setIsModifyOpen(false)}>Cancel</Button>
                    <Button type="submit" variant="primary">Save & Apply</Button>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Popover.Root open={isRejectOpen} onOpenChange={setIsRejectOpen}>
            <Popover.Trigger asChild>
              <Button variant="ghost" className="text-ink-2 hover:text-rose hover:bg-rose/10 transition-colors gap-2 ml-auto">
                <X size={16} /> Reject
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={8} className="w-72 bg-card rounded-inner shadow-xl border border-line p-4 z-50">
                <h4 className="text-sm font-semibold text-ink mb-2">Reject recommendation</h4>
                <p className="text-xs text-ink-2 mb-3">Please provide an optional reason to help improve future AI suggestions.</p>
                <Input 
                  placeholder="e.g. Room is occupied longer today" 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mb-3 text-sm h-8"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={submitReject}>Confirm reject</Button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </motion.div>
  )
}


// --- Main Page Component ---
export default function Recommendations() {
  const navigate = useNavigate()
  const { data: recommendations, isLoading } = useRecommendations()
  const { data: rooms } = useRooms()
  const patchRecommendation = usePatchRecommendation()

  // Filters
  const [status, setStatus] = useState('pending')
  const [priority, setPriority] = useState('All')
  const [type, setType] = useState('All')
  const [roomId, setRoomId] = useState('All')
  
  // Keyboard nav state
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const filteredRecs = useMemo(() => {
    if (!recommendations) return []
    return recommendations
      .filter(r => r.status === status)
      .filter(r => priority === 'All' || r.priority === priority)
      .filter(r => type === 'All' || r.type === type.toLowerCase())
      .filter(r => roomId === 'All' || r.roomId === roomId)
      .sort((a, b) => {
        const pA = PRIORITY_WEIGHT[a.priority] || 0
        const pB = PRIORITY_WEIGHT[b.priority] || 0
        if (pA !== pB) return pB - pA
        return b.estCostInr - a.estCostInr
      })
  }, [recommendations, status, priority, type, roomId])

  const pendingStats = useMemo(() => {
    if (!recommendations) return { count: 0, kwh: 0, cost: 0 }
    const pending = recommendations.filter(r => r.status === 'pending')
    return {
      count: pending.length,
      kwh: pending.reduce((acc, r) => acc + r.estKwh, 0),
      cost: pending.reduce((acc, r) => acc + r.estCostInr, 0)
    }
  }, [recommendations])

  // Keyboard Navigation Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return

      if (e.key === 'j') {
        setFocusedIndex(prev => Math.min(prev + 1, filteredRecs.length - 1))
      } else if (e.key === 'k') {
        setFocusedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'a' && focusedIndex >= 0 && focusedIndex < filteredRecs.length) {
        // Find the card element to click its accept button, or trigger patch directly
        // We'll trigger patch directly for simplicity in the mock, though it bypasses the 8s undo
        patchRecommendation.mutate({ id: filteredRecs[focusedIndex].id, updates: { status: 'accepted' } })
      } else if (e.key === 'r' && focusedIndex >= 0 && focusedIndex < filteredRecs.length) {
        patchRecommendation.mutate({ id: filteredRecs[focusedIndex].id, updates: { status: 'rejected', explanation: 'Rejected via keyboard shortcut' } })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredRecs, focusedIndex, patchRecommendation])

  // Handlers
  const handleAccept = (id: string) => patchRecommendation.mutate({ id, updates: { status: 'accepted' } })
  const handleReject = (id: string, reason?: string) => patchRecommendation.mutate({ id, updates: { status: 'rejected', explanation: reason ? `Reason: ${reason}` : '' } })
  const handleModify = (id: string, updates: any) => patchRecommendation.mutate({ id, updates: { ...updates, status: 'modified' } })

  if (isLoading || !rooms) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recommendations" description="AI-driven optimizations and anomaly alerts." />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 flex flex-col h-full">
      <PageHeader title="Recommendations" description="AI-driven optimizations and anomaly alerts." />

      {/* Filter Bar */}
      <Card className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <PillSwitcher 
            options={['Pending', 'Accepted', 'Rejected', 'Modified']} 
            defaultSelected="Pending" 
            onChange={(val) => setStatus(val.toLowerCase())} 
          />
          <div className="hidden sm:block w-px h-8 bg-line" />
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2">Priority:</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="bg-page border border-line rounded-inner px-2 py-1 text-sm outline-none focus-visible:border-accent">
              <option value="All">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2">Type:</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="bg-page border border-line rounded-inner px-2 py-1 text-sm outline-none focus-visible:border-accent">
              <option value="All">All types</option>
              <option value="Schedule">Schedule</option>
              <option value="Temperature">Temperature</option>
              <option value="Energy">Energy</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2">Room:</span>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="bg-page border border-line rounded-inner px-2 py-1 text-sm outline-none focus-visible:border-accent max-w-[150px]">
              <option value="All">All rooms</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Summary Line */}
      {status === 'pending' && pendingStats.count > 0 && (
        <div className="flex items-center justify-between bg-accent-soft/30 px-4 py-3 rounded-inner border border-accent-soft">
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <Lightbulb size={16} className="text-accent" />
            <span className="font-semibold text-ink">{pendingStats.count} pending items</span>
            <span>- about <span className="font-semibold text-ink">{pendingStats.kwh.toLocaleString()} kWh</span> and <span className="font-semibold text-ink">₹{pendingStats.cost.toLocaleString()}</span> could be saved per month.</span>
          </div>
          <SourceTag type="estimated" />
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 flex-1 items-start">
        
        {/* Main List */}
        <div className="col-span-12 xl:col-span-8 space-y-4 pb-12">
          <AnimatePresence mode="popLayout">
            {filteredRecs.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {status === 'pending' ? (
                  <EmptyState 
                    title="Nothing needs attention right now"
                    description="All identified issues and optimizations have been resolved."
                    action={<Button variant="outline" size="sm" onClick={() => navigate('/app/insights')}>View energy insights</Button>}
                  />
                ) : (
                  <EmptyState 
                    title={`No ${status} recommendations`}
                    description="Change your filters to see more results."
                  />
                )}
              </motion.div>
            ) : (
              filteredRecs.map((rec, index) => (
                <RecommendationCard 
                  key={rec.id}
                  rec={rec}
                  roomName={rooms.find(r => r.id === rec.roomId)?.name || 'Unknown Room'}
                  isFocused={focusedIndex === index}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onModify={handleModify}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Right Column */}
        <div className="hidden xl:block col-span-4 sticky top-24">
          <Card className="bg-page border border-line">
            <h2 className="text-base font-semibold text-ink mb-4">Why these priorities?</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <SeverityDot level="Critical" showLabel={false} />
                <div>
                  <div className="text-sm font-semibold text-ink mb-0.5">Critical</div>
                  <div className="text-xs text-ink-2">Significant abnormal usage requiring immediate attention.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <SeverityDot level="High" showLabel={false} />
                <div>
                  <div className="text-sm font-semibold text-ink mb-0.5">High</div>
                  <div className="text-xs text-ink-2">Operation outside scheduled hours or severe threshold breaches.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <SeverityDot level="Medium" showLabel={false} />
                <div>
                  <div className="text-sm font-semibold text-ink mb-0.5">Medium</div>
                  <div className="text-xs text-ink-2">Inefficient temperature settings and moderate waste.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <SeverityDot level="Low" showLabel={false} />
                <div>
                  <div className="text-sm font-semibold text-ink mb-0.5">Low</div>
                  <div className="text-xs text-ink-2">Minor tuning opportunities for marginal efficiency gains.</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-line">
              <div className="text-xs font-semibold text-ink-3 uppercase tracking-tight mb-2">Keyboard Shortcuts</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-ink-2">
                <div className="flex items-center justify-between bg-card px-2 py-1 rounded border border-line"><span>Up/Down</span> <kbd className="font-semibold text-ink font-mono">j k</kbd></div>
                <div className="flex items-center justify-between bg-card px-2 py-1 rounded border border-line"><span>Accept</span> <kbd className="font-semibold text-ink font-mono">a</kbd></div>
                <div className="flex items-center justify-between bg-card px-2 py-1 rounded border border-line"><span>Reject</span> <kbd className="font-semibold text-ink font-mono">r</kbd></div>
              </div>
            </div>
          </Card>
        </div>
        
      </div>
    </motion.div>
  )
}