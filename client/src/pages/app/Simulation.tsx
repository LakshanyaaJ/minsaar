import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UploadCloud, FileText, X, Check, AlertCircle, Play, 
  Download, ArrowRight, StopCircle, Info, Calendar
} from 'lucide-react'
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { SourceTag } from '../../components/ui/SourceTag'
import { SeverityDot } from '../../components/ui/SeverityDot'
import { PillSwitcher } from '../../components/ui/PillSwitcher'
import { NumberField } from '../../components/inputs/NumberField'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/feedback/Skeleton'

import { useSimulationStore } from '../../store/simulation'
import { useCreateSimulation, useSimulation, useSimulationHistory, useSettings } from '../../hooks/queries'
import { validateReadingsCsv, validateScheduleCsv, generateSampleReadingsCsv, generateSampleScheduleCsv } from '../../lib/csv'
import type { CsvValidationResult } from '../../lib/csv'
import type { SimulationJob, SimulationStep } from '../../types/simulation'

// --- Motion Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
}

// --- Helper Components ---

function FileDropzone({ label, onDrop, onDownloadSample, accept = ".csv" }: { label: string, onDrop: (f: File) => void, onDownloadSample: () => void, accept?: string }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true)
    else if (e.type === 'dragleave') setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onDrop(e.dataTransfer.files[0])
    }
  }

  return (
    <div 
      className={`border-2 border-dashed rounded-inner p-6 flex flex-col items-center justify-center text-center transition-colors ${isDragging ? 'border-accent bg-accent-soft/20' : 'border-line bg-page/50 hover:bg-page'}`}
      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept={accept} onChange={(e) => e.target.files && onDrop(e.target.files[0])} />
      <UploadCloud size={24} className="text-ink-3 mb-3" />
      <p className="text-sm font-medium text-ink mb-1">{label}</p>
      <p className="text-xs text-ink-2 mb-4">Drag and drop or click to browse</p>
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Browse files</Button>
      <button onClick={onDownloadSample} className="text-xs font-medium text-accent hover:underline mt-4">Download sample</button>
    </div>
  )
}

function ValidationSummary({ file, validation, onRemove }: { file: File, validation: CsvValidationResult<any>, onRemove: () => void }) {
  return (
    <div className="bg-page/30 rounded-inner p-4 border border-line h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-card rounded flex items-center justify-center border border-line shadow-sm">
            <FileText size={20} className="text-ink-2" />
          </div>
          <div>
            <div className="text-sm font-medium text-ink truncate max-w-[180px]">{file.name}</div>
            <div className="text-xs text-ink-3">{(file.size / 1024).toFixed(1)} KB • {validation.data.length} rows</div>
          </div>
        </div>
        <button onClick={onRemove} className="text-ink-3 hover:text-rose transition-colors p-1"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {validation.valid ? (
          <div className="flex items-start gap-2 text-sm text-ink bg-mint-soft/30 p-2 rounded">
            <Check size={16} className="text-mint shrink-0 mt-0.5" /> 
            <div>
              <span className="font-semibold block mb-0.5">Valid format</span>
              <span className="text-xs text-ink-2">Detected {validation.metadata.unitCount || 0} AC units.</span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-rose bg-rose/5 p-2 rounded">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
            <div>
              <span className="font-semibold block mb-0.5">Validation failed</span>
              <ul className="text-xs space-y-1 list-disc pl-3">
                {validation.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                {validation.errors.length > 3 && <li>and {validation.errors.length - 3} more errors</li>}
              </ul>
            </div>
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-amber bg-amber/5 p-2 rounded">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <ul className="space-y-1 list-disc pl-3">
              {validation.warnings.slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}


// --- Main Component ---
export default function Simulation() {
  const { data: settings } = useSettings()
  const createSimulation = useCreateSimulation()
  const { data: history } = useSimulationHistory()
  
  const draft = useSimulationStore()
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const { data: activeJob } = useSimulation(activeJobId)

  const [readingsValidation, setReadingsValidation] = useState<CsvValidationResult<any> | null>(null)
  const [scheduleValidation, setScheduleValidation] = useState<CsvValidationResult<any> | null>(null)
  
  const [readingsContent, setReadingsContent] = useState<string>('')
  const [scheduleContent, setScheduleContent] = useState<string>('')

  // Sync settings tariff
  useEffect(() => {
    if (settings?.tariffInrPerKwh !== undefined) {
      // Only update if current tariff is exactly the 8.0 default AND the setting is different
      if (draft.tariff === 8.0 && settings.tariffInrPerKwh !== 8.0) {
        draft.setDraft({ tariff: settings.tariffInrPerKwh })
      }
    }
  }, [settings?.tariffInrPerKwh, draft.tariff, draft.setDraft])

  // Handlers
  const handleReadingsDrop = async (file: File) => {
    const text = await file.text()
    setReadingsContent(text)
    setReadingsValidation(validateReadingsCsv(text))
    draft.setDraft({ readingsFile: file })
  }

  const handleScheduleDrop = async (file: File) => {
    const text = await file.text()
    setScheduleContent(text)
    setScheduleValidation(validateScheduleCsv(text, new Set(readingsValidation?.metadata?.units || [])))
    draft.setDraft({ scheduleFile: file })
  }

  const downloadSampleReadings = () => {
    const blob = new Blob([generateSampleReadingsCsv()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_readings.csv'
    a.click()
  }

  const downloadSampleSchedule = () => {
    const blob = new Blob([generateSampleScheduleCsv()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_schedule.csv'
    a.click()
  }

  const handleSimulate = () => {
    if (!readingsValidation?.valid || !scheduleValidation?.valid) return
    createSimulation.mutate({
      readingsContent,
      scheduleContent,
      config: { intervalHours: draft.intervalHours, tariffInrPerKwh: draft.tariff }
    }, {
      onSuccess: (res) => setActiveJobId(res.id)
    })
  }

  const handleExportCsv = () => {
    if (!activeJob?.steps) return
    const headers = ['Step', 'Start', 'End', 'Actual (kWh)', 'Predicted (kWh)', 'Wasted (kWh)', 'Anomalies']
    const rows = activeJob.steps.map(s => [
      s.stepIndex, s.windowStart, s.windowEnd, s.actualKwh, s.predictedKwh, s.wastedKwhEst, s.anomalies.length
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `simulation_results_${activeJob.id}.csv`
    a.click()
  }

  // Derived state
  const isReady = readingsValidation?.valid && scheduleValidation?.valid
  const isRunning = activeJob && activeJob.status === 'running'
  const isDone = activeJob && activeJob.status === 'done'

  const intervalLabel = draft.intervalHours === 2 ? '2 hours' 
    : draft.intervalHours === 6 ? '6 hours' 
    : draft.intervalHours === 24 ? '24 hours' 
    : draft.intervalHours === 72 ? '72 hours' 
    : 'Custom'

  return (
    <div className="space-y-6 flex flex-col h-full overflow-x-hidden">
      <PageHeader 
        title="Simulation" 
        description="Replay your own data through Minsaar's models and see what they would have caught." 
      />
      {activeJob?.summary?.engine === 'mock' && (
        <div className="inline-flex items-center px-2 py-1 rounded bg-amber/10 border border-amber/20 text-amber text-xs font-semibold mb-2 -mt-4 w-fit">
          Mock engine
        </div>
      )}

      {/* INPUTS ROW */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Readings Input */}
        <motion.div variants={itemVariants} className="h-64">
          <Card className="h-full flex flex-col">
            <h2 className="text-base font-semibold text-ink mb-4">1. Energy readings</h2>
            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {draft.readingsFile && readingsValidation ? (
                  <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <ValidationSummary file={draft.readingsFile} validation={readingsValidation} onRemove={() => { draft.setDraft({ readingsFile: null }); setReadingsValidation(null) }} />
                  </motion.div>
                ) : (
                  <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <FileDropzone label="Upload telemetry data" onDrop={handleReadingsDrop} onDownloadSample={downloadSampleReadings} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* Schedule Input */}
        <motion.div variants={itemVariants} className="h-64">
          <Card className="h-full flex flex-col">
            <h2 className="text-base font-semibold text-ink mb-4">2. Weekly schedule</h2>
            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {draft.scheduleFile && scheduleValidation ? (
                  <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <ValidationSummary file={draft.scheduleFile} validation={scheduleValidation} onRemove={() => { draft.setDraft({ scheduleFile: null }); setScheduleValidation(null) }} />
                  </motion.div>
                ) : (
                  <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <FileDropzone label="Upload baseline schedules" onDrop={handleScheduleDrop} onDownloadSample={downloadSampleSchedule} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* Settings Input */}
        <motion.div variants={itemVariants} className="h-64">
          <Card className="h-full flex flex-col overflow-y-auto">
            <h2 className="text-base font-semibold text-ink mb-4">3. Run settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-3 mb-2 block">Run the model every</label>
                <PillSwitcher 
                  options={['2 hours', '6 hours', '24 hours', '72 hours', 'Custom']} 
                  defaultSelected={intervalLabel}
                  onChange={(val) => {
                    if (val !== 'Custom') draft.setDraft({ intervalHours: parseInt(val) })
                  }} 
                />
                {intervalLabel === 'Custom' && (
                  <div className="mt-3">
                    <NumberField value={draft.intervalHours} onChange={(v) => draft.setDraft({ intervalHours: v })} min={1} max={168} unit=" h" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Tariff (₹/kWh)</label>
                <NumberField value={draft.tariff} onChange={(v) => draft.setDraft({ tariff: v })} min={1} step={0.5} />
              </div>
              <p className="text-xs text-ink-2 leading-relaxed bg-page/50 p-2 rounded">
                A shorter interval catches wasteful runtime sooner but runs more often.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Readiness */}
        <motion.div variants={itemVariants} className="h-64">
          <Card className="h-full flex flex-col justify-between border-2 border-transparent hover:border-accent/10 transition-colors">
            <div>
              <h2 className="text-base font-semibold text-ink mb-4">4. Readiness</h2>
              <div className="space-y-2 text-sm text-ink-2">
                <div className="flex items-center gap-2">
                  {readingsValidation?.valid ? <Check size={16} className="text-mint" /> : <div className="w-4 h-4 rounded-full border border-line" />}
                  Readings valid
                </div>
                <div className="flex items-center gap-2">
                  {scheduleValidation?.valid ? <Check size={16} className="text-mint" /> : <div className="w-4 h-4 rounded-full border border-line" />}
                  Schedule valid
                </div>
                <div className="flex items-center gap-2">
                  {(isReady && readingsValidation?.metadata?.unitCount === scheduleValidation?.metadata?.unitCount) ? <Check size={16} className="text-mint" /> : <div className="w-4 h-4 rounded-full border border-line" />}
                  Units match
                </div>
              </div>
            </div>
            
            <Button 
              variant="primary" 
              className="w-full h-12 text-base shadow-lg disabled:opacity-40" 
              disabled={!isReady || createSimulation.isPending || isRunning}
              onClick={handleSimulate}
            >
              {isDone ? 'Simulate again' : isRunning ? 'Simulating...' : 'Simulate'}
            </Button>
          </Card>
        </motion.div>
      </motion.div>

      {/* RUN PROGRESS */}
      <AnimatePresence>
        {isRunning && activeJob && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-ink text-white border-none shadow-2xl flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 w-full">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm font-semibold">Running models...</div>
                  <div className="text-xs text-ink-3">Step {activeJob.stepsCompleted} of {activeJob.stepsTotal}</div>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeJob.progress * 100}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>
              </div>
              <div className="shrink-0 w-full md:w-64 bg-white/5 rounded-inner p-3 text-xs text-ink-3 space-y-1 h-16 overflow-y-auto">
                {activeJob.steps.slice(-2).map((s, i) => (
                  <div key={i} className="truncate">
                    Processed {s.windowStart} - {s.anomalies.length > 0 ? <span className="text-amber">Found {s.anomalies.length} anomaly</span> : 'Clear'}
                  </div>
                ))}
              </div>
              <Button variant="outline" className="shrink-0 border-white/20 text-white hover:bg-white/10" onClick={() => setActiveJobId(null)}>
                <StopCircle size={16} className="mr-2" /> Cancel
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS GRID */}
      {activeJob?.steps.length ? (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-12">
          <div className="flex items-center justify-between mt-8 border-b border-line pb-4">
            <h2 className="text-lg font-semibold text-ink">{isDone ? 'Simulation Results' : 'Partial Results'}</h2>
            {isDone && (
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2"><Download size={14} /> Export CSV</Button>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Actual energy" value={activeJob.summary?.totalActualKwh || 0} unit="kWh" source="uploaded" />
            <StatCard label="Forecast MAE" value={activeJob.summary?.mae || 0} unit="kWh" source="predicted" />
            <StatCard label="Anomalies found" value={activeJob.summary?.totalAnomalies || 0} source="predicted" />
            <StatCard label="Wasted energy" value={activeJob.summary?.wastedKwhEst || 0} unit="kWh" source="estimated" />
            <StatCard label="Estimated savings" value={`₹ ${activeJob.summary?.savingsInrEst?.toLocaleString('en-IN') || 0}`} source="estimated" />
            <StatCard label="Compliance" value={`${activeJob.summary?.scheduleCompliancePct || 0}%`} source="measured" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-12 gap-6">
            <Card className="col-span-12 lg:col-span-8 flex flex-col min-h-[350px]">
              <h3 className="text-base font-semibold text-ink mb-6">How close was the forecast?</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeJob.steps} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="stepIndex" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                    <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} />
                    <Line type="monotone" name="Predicted" dataKey="predictedKwh" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" name="Actual" dataKey="actualKwh" stroke="var(--accent)" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-ink-2 mt-4 pt-4 border-t border-line">
                <span className="font-semibold text-ink">Explanation:</span> The forecast baseline represents expected behaviour. Spikes in actual consumption above this line trigger anomaly detection.
              </p>
            </Card>

            <Card className="col-span-12 lg:col-span-4 flex flex-col min-h-[350px]">
              <h3 className="text-base font-semibold text-ink mb-6">Which kinds of problems?</h3>
              <div className="flex-1 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ name: 'Runtime', value: activeJob.summary?.totalAnomalies || 1, color: 'var(--rose)' }]}
                      dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none" isAnimationActive={false}
                    >
                      {[{ color: 'var(--rose)' }].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-semibold text-ink tabular-nums">{activeJob.summary?.totalAnomalies || 0}</span>
                  <span className="text-xs text-ink-3">Total</span>
                </div>
              </div>
            </Card>
          </div>

          {/* History Compare Table */}
          {history && history.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold text-ink mb-4">Compare past runs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-ink-3 font-semibold uppercase tracking-tight border-b border-line">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Interval</th>
                      <th className="px-4 py-3">Steps</th>
                      <th className="px-4 py-3 text-right">MAE</th>
                      <th className="px-4 py-3 text-right">Anomalies</th>
                      <th className="px-4 py-3 text-right">Est. Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {history.map(job => (
                      <tr key={job.id} className="hover:bg-page/50 transition-colors">
                        <td className="px-4 py-3 text-ink font-medium">{new Date(job.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-ink-2">{job.config.intervalHours} hrs</td>
                        <td className="px-4 py-3 text-ink-2">{job.stepsTotal}</td>
                        <td className="px-4 py-3 text-ink-2 text-right tabular-nums">{job.summary?.mae || '-'}</td>
                        <td className="px-4 py-3 text-ink-2 text-right tabular-nums">{job.summary?.totalAnomalies || '-'}</td>
                        <td className="px-4 py-3 text-ink-2 text-right tabular-nums">₹ {job.summary?.savingsInrEst?.toLocaleString('en-IN') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </motion.div>
      ) : null}

    </div>
  )
}