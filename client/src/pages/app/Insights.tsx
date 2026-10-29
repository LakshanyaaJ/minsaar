import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ComposedChart, Line
} from 'recharts'
import { Download, Info, Calculator } from 'lucide-react'
import { useQueryClient, useMutation } from '@tanstack/react-query'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { PillSwitcher } from '../../components/ui/PillSwitcher'
import { SourceTag } from '../../components/ui/SourceTag'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { NumberField } from '../../components/inputs/NumberField'
import { Skeleton } from '../../components/ui/feedback/Skeleton'

import { useSettings, useRooms } from '../../hooks/queries'
import { apiClient } from '../../api/client'
import { cost, costSavings, savings } from '../../lib/energy'

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
}

export default function Insights() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading: settingsLoading } = useSettings()
  const { data: rooms, isLoading: roomsLoading } = useRooms()

  const [range, setRange] = useState('Weekly')
  const [localTariff, setLocalTariff] = useState(8.0)

  const updateTariff = useMutation({
    mutationFn: apiClient.setTariff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] })
  })

  // Sync local tariff with server settings initially
  useEffect(() => {
    if (settings?.tariffInrPerKwh) {
      setLocalTariff(settings.tariffInrPerKwh)
    }
  }, [settings?.tariffInrPerKwh])

  const handleTariffChange = (val: number) => {
    setLocalTariff(val)
    updateTariff.mutate(val)
  }

  // --- Mock Data Generation based on Range ---
  const multiplier = range === 'Daily' ? 1 : range === 'Weekly' ? 7 : 30

  // 1. Totals
  const totalKwh = 142.6 * multiplier
  const predictedKwh = 125.0 * multiplier
  const wastedKwh = savings(totalKwh, predictedKwh)
  
  const currentCost = cost(totalKwh, localTariff)
  const optCost = cost(predictedKwh, localTariff)
  const potentialSavings = costSavings(wastedKwh, localTariff)

  // 2. Trend Chart Data
  const trendData = useMemo(() => {
    const points = range === 'Daily' ? 24 : range === 'Weekly' ? 7 : 10
    return Array.from({ length: points }).map((_, i) => {
      const label = range === 'Daily' ? `${i}:00` : range === 'Weekly' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i] : `Day ${i*3 + 1}`
      const basePred = (125.0 * multiplier) / points
      const pred = basePred + (Math.random() * basePred * 0.2)
      const actual = pred + (Math.random() * basePred * 0.3) // Actual is always slightly higher to show waste
      return {
        label,
        Actual: Number(actual.toFixed(1)),
        Predicted: Number(pred.toFixed(1)),
        Wasted: Number(Math.max(0, actual - pred).toFixed(1))
      }
    })
  }, [range, multiplier])

  // 3. Room Comparison Data
  const roomData = useMemo(() => {
    if (!rooms) return []
    return rooms.slice(0, 6).map((r, i) => {
      const roomTotal = (35 - i * 3) * multiplier
      const roomWasted = (5 - i * 0.5) * multiplier
      return {
        name: r.name,
        Total: Number(roomTotal.toFixed(1)),
        Wasted: Number(roomWasted.toFixed(1)),
        Optimized: Number((roomTotal - roomWasted).toFixed(1))
      }
    }).sort((a, b) => b.Total - a.Total)
  }, [rooms, multiplier])

  // --- CSV Export ---
  const handleExport = () => {
    const headers = ['Room', 'Total Consumption (kWh)', 'Wasted Energy (kWh)', 'Optimized (kWh)']
    const rows = roomData.map(r => [r.name, r.Total, r.Wasted, r.Optimized])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `minsaar-room-insights-${range.toLowerCase()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (settingsLoading || roomsLoading) {
    return <div><PageHeader title="Insights" description="Energy trends and cost forecasting." /><Skeleton className="h-96" /></div>
  }

  const isSim = settings?.mode === 'simulation'

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <PageHeader title="Insights" description="Energy trends and cost forecasting." />
        
        <div className="flex flex-wrap items-center gap-6 bg-card px-4 py-3 rounded-card shadow-card border border-line">
          <PillSwitcher options={['Daily', 'Weekly', 'Monthly']} defaultSelected={range} onChange={setRange} />
          <div className="w-px h-8 bg-line" />
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-ink-2">Tariff (₹/kWh)</label>
            <NumberField value={localTariff} onChange={handleTariffChange} min={1} max={50} step={0.5} className="bg-page" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Total consumption" 
            value={totalKwh.toLocaleString('en-IN', { maximumFractionDigits: 1 })} 
            unit="kWh" 
            source={isSim ? 'simulated' : 'measured'} 
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Predicted consumption" 
            value={predictedKwh.toLocaleString('en-IN', { maximumFractionDigits: 1 })} 
            unit="kWh" 
            source="predicted" 
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Estimated wasted energy" 
            value={wastedKwh.toLocaleString('en-IN', { maximumFractionDigits: 1 })} 
            unit="kWh" 
            source="estimated" 
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard 
            label="Potential cost savings" 
            value={`₹ ${potentialSavings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
            source="estimated" 
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        
        {/* Trend Chart */}
        <motion.div variants={itemVariants} className="col-span-12 xl:col-span-8 flex flex-col">
          <h2 className="text-base font-semibold text-ink mb-6">Where does the extra energy go?</h2>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                <Area type="monotone" dataKey="Wasted" stackId="1" stroke="none" fill="var(--amber)" fillOpacity={0.2} name="Wasted (Est.)" />
                <Area type="monotone" dataKey="Predicted" stackId="1" stroke="none" fill="transparent" />
                
                <Line type="monotone" dataKey="Predicted" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Actual" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--accent)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-sm text-ink-2 leading-relaxed">
              <span className="font-semibold text-ink">Insight: </span> 
              The gap between the orange line (actual) and the dotted line (predicted) represents wasted energy. Over this {range.toLowerCase()} period, most waste occurred during late afternoon hours when schedules were not strictly enforced.
            </p>
          </div>
        </motion.div>

        {/* Breakdown & Formulas */}
        <motion.div variants={itemVariants} className="col-span-12 xl:col-span-4 space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-ink mb-6">Cost breakdown</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm font-semibold text-ink-2 mb-1">Current cost</div>
                  <div className="text-2xl font-semibold text-ink tabular-nums tracking-tight">
                    ₹ {currentCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <SourceTag type={isSim ? 'simulated' : 'measured'} />
              </div>

              <div className="flex gap-4 items-stretch h-24 py-2">
                <div className="w-1/2 flex flex-col justify-end bg-line rounded-inner overflow-hidden relative">
                  <div className="absolute bottom-0 w-full bg-ink/5" style={{ height: '100%' }} />
                </div>
                <div className="w-1/2 flex flex-col justify-end bg-line rounded-inner overflow-hidden relative">
                  <div className="absolute bottom-0 w-full bg-accent" style={{ height: `${(optCost / currentCost) * 100}%` }} />
                  <div className="absolute w-full bg-amber/80 flex items-center justify-center border-b border-white/20" style={{ bottom: `${(optCost / currentCost) * 100}%`, height: `${(potentialSavings / currentCost) * 100}%` }}>
                    <span className="text-xs font-bold text-ink drop-shadow-sm">- ₹ {potentialSavings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end pt-2">
                <div>
                  <div className="text-sm font-semibold text-ink-2 mb-1">Optimized cost</div>
                  <div className="text-2xl font-semibold text-ink tabular-nums tracking-tight text-accent">
                    ₹ {optCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <SourceTag type="estimated" />
              </div>
            </div>
          </Card>

          <Card className="bg-page border border-line">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-ink-2" /> How these numbers are calculated
            </h3>
            <ul className="text-xs text-ink-2 space-y-2 mb-4 font-medium">
              <li className="flex justify-between"><span>Energy (kWh)</span> <span className="text-ink">kW × hours</span></li>
              <li className="flex justify-between"><span>Cost (₹)</span> <span className="text-ink">kWh × tariff</span></li>
              <li className="flex justify-between"><span>Savings (₹)</span> <span className="text-ink">baseline − optimized</span></li>
            </ul>
            <div className="text-[10px] text-ink-3 flex items-start gap-1.5 leading-tight">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>Savings remain estimates until measured after changes are applied.</span>
            </div>
          </Card>
        </motion.div>

        {/* Room Comparison */}
        <motion.div variants={itemVariants} className="col-span-12 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-ink">Consumption by room</h2>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download size={14} /> Export CSV
            </Button>
          </div>
          
          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-2)', fontWeight: 500 }} width={120} />
                <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} cursor={{ fill: 'var(--page)' }} />
                
                <Bar dataKey="Optimized" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} animationDuration={1000} />
                <Bar dataKey="Wasted" stackId="a" fill="var(--amber)" radius={[0, 4, 4, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-sm text-ink-2 leading-relaxed">
              <span className="font-semibold text-ink">Insight: </span> 
              Computer Laboratory 2 used more electricity than its normal pattern because the AC kept running about 1h 45m past its scheduled closing time on most weekdays.
            </p>
          </div>
        </motion.div>
        
      </div>
    </motion.div>
  )
}