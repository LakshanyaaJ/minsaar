import { useEffect, useState } from 'react'
import { motion, useAnimation, useInView } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts'
import { Calendar, Lightbulb, Thermometer } from 'lucide-react'
import { useRef } from 'react'

import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import { ProgressRow } from '../../components/ui/ProgressRow'
import { PillSwitcher } from '../../components/ui/PillSwitcher'
import { SourceTag } from '../../components/ui/SourceTag'
import { SeverityDot } from '../../components/ui/SeverityDot'
import { ChartTooltip } from '../../components/charts/ChartTooltip'
import { Skeleton } from '../../components/ui/feedback/Skeleton'
import { ErrorState } from '../../components/ui/feedback/ErrorState'

import { useOverview, useRooms, useSettings } from '../../hooks/queries'
import { useFiltersStore } from '../../store/filters'
import { EmptyState } from '../../components/ui/EmptyState'

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring', stiffness: 260, damping: 20 } 
  }
}

// --- Number Counter Helper ---
function CountUp({ value, decimals = 0 }: { value: number, decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  
  useEffect(() => {
    if (inView) {
      let startTimestamp: number
      const duration = 800
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp
        const progress = Math.min((timestamp - startTimestamp) / duration, 1)
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4)
        const current = (value * ease).toFixed(decimals)
        if (ref.current) ref.current.textContent = current
        if (progress < 1) window.requestAnimationFrame(step)
      }
      window.requestAnimationFrame(step)
    }
  }, [value, inView, decimals])

  return <span ref={ref}>{value.toFixed(decimals)}</span>
}

// --- Component ---
export default function Overview() {
  const navigate = useNavigate()
  const { dateRange, selectedBuildingId, setDateRange } = useFiltersStore()
  
  const { data: overview, isLoading, isError, refetch } = useOverview(dateRange)
  const { data: rooms } = useRooms()
  const { data: settings } = useSettings()

  const [localRange, setLocalRange] = useState('Today')

  // --- Mock Data for Charts (Responsive to local range for interactivity demo) ---
  const trendData = Array.from({ length: 12 }).map((_, i) => {
    const isFuture = i > 8
    return {
      time: `${(i * 2).toString().padStart(2, '0')}:00`,
      actual: isFuture ? null : 15 + Math.random() * 10,
      predicted: 14 + Math.random() * 12
    }
  })

  const weeklyData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day,
    kwh: Math.floor(180 + Math.random() * 100),
    isToday: day === 'Thu' // Mock current day
  }))

  const topRooms = (rooms || []).slice(0, 8).map((r, i) => ({
    name: r.name,
    kwh: 45 - (i * 4),
    percentage: 15 - i
  }))

  const anomalyCategories = [
    { name: 'After hours', value: 12, color: 'var(--rose)' },
    { name: 'Low setpoint', value: 8, color: 'var(--amber)' },
    { name: 'Unoccupied', value: 5, color: 'var(--sky)' },
    { name: 'High power', value: 3, color: 'var(--ink-2)' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" description="Monitor campus-wide energy and performance." />
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-8 h-96 flex flex-col"><Skeleton className="h-full w-full" /></Card>
          <Card className="col-span-12 lg:col-span-4 h-96"><Skeleton className="h-full w-full" /></Card>
          {[1,2,3,4].map(i => <Card key={i} className="col-span-12 md:col-span-6 lg:col-span-3 h-32"><Skeleton className="h-full w-full" /></Card>)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" description="Monitor campus-wide energy and performance." />
        <ErrorState message="Could not load overview data. Please check your connection." onRetry={refetch} />
      </div>
    )
  }

  if (!overview && !isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" description="Monitor campus-wide energy and performance." />
        <EmptyState title="No data available" description="There is no energy data for the selected date range." action={<button className="text-accent text-sm font-semibold hover:underline mt-2" onClick={() => setDateRange('today')}>View today</button>} />
      </div>
    )
  }

  const isSim = settings?.mode === 'simulation'

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      viewport={{ once: true }}
    >
      <PageHeader title="Overview" description="Monitor campus-wide energy and performance." />

      {/* Quick Actions Strip */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3 mb-2">
        <button onClick={() => navigate('/app/recommendations')} className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-card text-sm font-medium text-ink hover:text-accent transition-colors border border-transparent hover:border-accent-soft">
          <Lightbulb size={16} className="text-amber" /> Review recommendations
        </button>
        <button onClick={() => navigate('/app/schedules')} className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-card text-sm font-medium text-ink hover:text-accent transition-colors border border-transparent hover:border-accent-soft">
          <Calendar size={16} className="text-sky" /> Edit a schedule
        </button>
        <button onClick={() => navigate('/app/temperature')} className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-card text-sm font-medium text-ink hover:text-accent transition-colors border border-transparent hover:border-accent-soft">
          <Thermometer size={16} className="text-rose" /> Check temperatures
        </button>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 lg:gap-6">
        
        {/* Trend Card */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8 bg-card rounded-card shadow-card p-6 flex flex-col relative">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="text-sm font-semibold text-ink-2 mb-1">Energy used {localRange.toLowerCase()}</h2>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-semibold text-ink tracking-tight tabular-nums">
                  <CountUp value={overview!.totalKwh} decimals={1} />
                  <span className="text-lg text-ink-3 ml-1">kWh</span>
                </div>
                <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-mint-soft text-[#2F9E5D] mb-1.5">
                  12% less
                </div>
              </div>
            </div>
            <PillSwitcher 
              options={['Today', 'Week', 'Month']} 
              defaultSelected={localRange}
              onChange={setLocalRange}
            />
          </div>

          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                <RechartsTooltip 
                  content={<ChartTooltip valueSuffix=" kWh" />} 
                  cursor={{ stroke: 'var(--line)', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Line 
                  name="Actual"
                  type="monotone" 
                  dataKey="actual" 
                  stroke="var(--accent)" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }}
                  animationDuration={1500}
                />
                <Line 
                  name="Predicted"
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="var(--amber)" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <SourceTag type={isSim ? 'simulated' : 'measured'} />
            <SourceTag type="predicted" />
          </div>
        </motion.div>

        {/* Ranked Rooms Card */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4 bg-card rounded-card shadow-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ink">Highest consumers</h2>
            <button className="text-sm font-semibold text-accent hover:text-[#E05D25] transition-colors flex items-center gap-1 outline-none focus-visible:underline">
              See all
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-1">
            {topRooms.map((room, i) => (
              <ProgressRow 
                key={room.name}
                label={room.name}
                value={room.kwh}
                max={50}
                unit="kWh"
                percentage={room.percentage}
              />
            ))}
          </div>
        </motion.div>

        {/* 4 Stat Cards */}
        <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-3">
          <StatCard 
            label="AC units running" 
            value={`${overview!.unitsActive} / 18`}
            source={isSim ? 'simulated' : 'measured'}
          />
        </motion.div>
        <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-3">
          <StatCard 
            label="Rooms occupied" 
            value={`${overview!.occupancyRate}%`}
            source={isSim ? 'simulated' : 'measured'}
          />
        </motion.div>
        <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-3">
          <StatCard 
            label="Anomalies detected" 
            value={overview!.anomaliesCount}
            delta={{ value: "2 more", trend: "bad" }}
            source="predicted"
          />
        </motion.div>
        <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 xl:col-span-3">
          <StatCard 
            label="Estimated savings" 
            value={`₹ ${overview!.estSavings.toLocaleString('en-IN')}`}
            delta={{ value: "could be saved", trend: "neutral" }}
            source="estimated"
          />
        </motion.div>

        {/* Weekly Bar Chart */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-7 bg-card rounded-card shadow-card p-6">
          <h2 className="text-base font-semibold text-ink mb-6">Which days use the most energy?</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="1" opacity="0.2" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} cursor={{ fill: 'var(--page)' }} />
                <Bar dataKey="kwh" radius={[4, 4, 0, 0]} animationDuration={1000}>
                  {weeklyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isToday ? 'var(--accent)' : 'url(#hatch)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Anomaly Donut */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-5 bg-card rounded-card shadow-card p-6 flex flex-col sm:flex-row gap-6 items-center">
          <div className="flex-1 w-full relative h-[200px]">
            <h2 className="text-base font-semibold text-ink mb-2">Anomaly summary</h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={anomalyCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1000}
                >
                  {anomalyCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 top-8 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-semibold text-ink tabular-nums">{overview!.anomaliesCount}</span>
              <span className="text-xs text-ink-3">Total</span>
            </div>
          </div>
          
          <div className="flex-1 w-full space-y-4">
            <h3 className="text-sm font-semibold text-ink-2">Latest alerts</h3>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">Computer Lab 2</div>
                  <div className="text-xs text-ink-3">Today, 18:30</div>
                </div>
                <SeverityDot level="Critical" showLabel={false} />
              </div>
              <div className="w-full h-px bg-line" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">Seminar Hall</div>
                  <div className="text-xs text-ink-3">Today, 14:15</div>
                </div>
                <SeverityDot level="High" showLabel={false} />
              </div>
              <div className="w-full h-px bg-line" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">Admin Office</div>
                  <div className="text-xs text-ink-3">Yesterday, 02:00</div>
                </div>
                <SeverityDot level="Medium" showLabel={false} />
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  )
}