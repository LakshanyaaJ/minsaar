import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { ArrowRight } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { SourceTag } from '../components/ui/SourceTag'
import { PillSwitcher } from '../components/ui/PillSwitcher'

const scrollVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } 
  }
}

export default function Landing() {
  const navigate = useNavigate()

  // Mock data for visual components
  const trendData = Array.from({ length: 12 }).map((_, i) => ({
    time: `${(i * 2).toString().padStart(2, '0')}:00`,
    actual: i > 8 ? null : 15 + Math.random() * 10,
    predicted: 14 + Math.random() * 12
  }))

  const forecastData = Array.from({ length: 14 }).map((_, i) => ({
    day: `D${i+1}`,
    actual: i < 7 ? 120 + Math.random() * 40 : null,
    predicted: 115 + Math.random() * 30
  }))

  return (
    <div className="min-h-screen bg-page selection:bg-accent selection:text-white flex flex-col overflow-x-hidden">
      
      {/* Hero Section */}
      <section className="relative pt-6 flex flex-col items-center min-h-[90vh] sm:min-h-[100vh] bg-[#F7794A] overflow-hidden">
        {/* Layered radial blobs to create an uneven pink-to-orange background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] bg-[#E9528E] rounded-full blur-[120px] mix-blend-hard-light opacity-90" />
          <div className="absolute bottom-0 right-[-10%] w-[80%] h-[80%] bg-[#FFB36B] rounded-full blur-[140px] mix-blend-overlay opacity-90" />
        </div>

        {/* Floating Nav Pill */}
        <nav className="relative z-10 w-full max-w-4xl mx-auto px-4 mb-16 lg:mb-24">
          <div className="flex items-center justify-between bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-2 py-2 pl-6 text-white shadow-lg">
            <div className="font-semibold text-lg flex items-center gap-1">
              Minsaar<span className="w-1.5 h-1.5 rounded-full bg-white mb-2" />
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white/80 transition-colors">How it works</a>
              <a href="#savings" className="hover:text-white/80 transition-colors">Savings</a>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/login')} className="hidden sm:block text-sm font-semibold px-4 py-2 hover:text-white/80 transition-colors">
                Sign in
              </button>
              <button onClick={() => navigate('/login')} className="bg-white text-[#F26A2E] px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm">
                Start free demo
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Text */}
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-semibold text-white tracking-tight mb-6 leading-[1.1]"
          >
            Stop cooling empty rooms. Cut campus energy waste.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Minsaar automatically detects when classroom ACs run past closing time, tracks needless overcooling, and suggests schedules that save thousands of rupees without freezing the students.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button onClick={() => navigate('/login')} className="w-full sm:w-auto bg-white text-[#F26A2E] px-8 py-3.5 rounded-full font-semibold hover:bg-white/90 transition-colors shadow-lg text-base">
              Try the demo
            </button>
            <a href="#features" className="w-full sm:w-auto bg-transparent border border-white text-white px-8 py-3.5 rounded-full font-semibold hover:bg-white/10 transition-colors text-base flex items-center justify-center gap-2">
              See how it works <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-6xl mx-auto px-4 flex-1 flex flex-col"
        >
          {/* Cropped container masking the bottom */}
          <div 
            className="flex-1 rounded-t-[32px] bg-page border-t border-x border-white/20 shadow-2xl p-4 md:p-8 overflow-hidden"
            style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="font-semibold text-lg text-ink">Overview</div>
              <PillSwitcher options={['Today', 'Week', 'Month']} defaultSelected="Today" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Energy used today" value="142.6" unit="kWh" delta={{ value: "12% less", trend: "good" }} source="measured" />
              <StatCard label="AC units running" value="12 / 18" source="measured" />
              <StatCard label="Anomalies detected" value={3} delta={{ value: "2 more", trend: "bad" }} source="predicted" />
              <StatCard label="Estimated savings" value="₹ 4,250" source="estimated" />
            </div>

            <Card className="h-64">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-semibold text-ink-2">Energy used today</h2>
                <SourceTag type="measured" />
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                  <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="predicted" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* Section A: Before & After */}
      <section id="features" className="py-24 px-4 bg-page border-b border-line">
        <motion.div 
          variants={scrollVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-5xl mx-auto"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-ink tracking-tight mb-4">A clear view of wasted runtime</h2>
            <p className="text-ink-2 max-w-2xl mx-auto">We isolate the exact hours ACs run needlessly, translating runtime directly into actionable schedules and rupee savings.</p>
          </div>
          
          <div className="bg-card rounded-card shadow-card p-6 md:p-10 border border-line">
            <h3 className="text-base font-semibold text-ink mb-6">Computer Laboratory 2</h3>
            
            <div className="space-y-8">
              {/* Before */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="w-48 shrink-0">
                  <div className="text-sm font-semibold text-ink">Before Minsaar</div>
                  <div className="text-xs text-rose mt-1">AC left on after class</div>
                </div>
                <div className="flex-1 w-full bg-page rounded-full h-8 relative border border-line overflow-hidden">
                  <div className="absolute left-[30%] w-[50%] h-full bg-line rounded-l-full" />
                  <div className="absolute left-[80%] w-[10%] h-full bg-rose/20 flex items-center justify-center rounded-r-full">
                    <span className="text-[10px] font-semibold text-rose">Wasted</span>
                  </div>
                </div>
              </div>

              {/* After */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="w-48 shrink-0">
                  <div className="text-sm font-semibold text-ink">Optimized Schedule</div>
                  <div className="text-xs text-mint mt-1">Stops exactly at 16:30</div>
                </div>
                <div className="flex-1 w-full bg-page rounded-full h-8 relative border border-line overflow-hidden">
                  <div className="absolute left-[30%] w-[50%] h-full bg-mint-soft flex items-center justify-center rounded-full">
                    <span className="text-[10px] font-semibold text-[#27864F]">Active schedule</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-line flex flex-wrap gap-6 items-center">
              <div>
                <div className="text-xs text-ink-2 font-medium">Estimated daily savings</div>
                <div className="text-2xl font-semibold text-ink tabular-nums tracking-tight">6.4 <span className="text-sm text-ink-2">kWh</span></div>
              </div>
              <div className="w-px h-8 bg-line" />
              <div>
                <div className="text-xs text-ink-2 font-medium">Cost equivalent</div>
                <div className="text-2xl font-semibold text-ink tabular-nums tracking-tight">₹ 51.20</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Section B: Forecasting Split Layout */}
      <section id="how-it-works" className="py-24 px-4 bg-white border-b border-line">
        <motion.div 
          variants={scrollVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        >
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-3xl font-semibold text-ink tracking-tight">Forecasting energy use with two AI models</h2>
            <p className="text-ink-2 leading-relaxed">
              Minsaar relies on two separate intelligence layers to secure your savings. 
              First, the energy forecast model predicts standard daily consumption based on your timetables and local weather.
            </p>
            <p className="text-ink-2 leading-relaxed">
              Second, the anomaly detection engine constantly compares real-time telemetry against the forecast. When a room drifts-like someone overriding a setpoint to 18°C-it instantly flags the waste and generates a recommendation.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/login')}>Explore insights</Button>
          </div>
          
          <div className="lg:col-span-7">
            <Card className="p-6 h-[400px] border border-line bg-page/30 shadow-none">
              <h3 className="text-sm font-semibold text-ink-2 mb-6">Actual vs Predicted (Weekly)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-3)' }} />
                  <Area type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                  <Line type="monotone" dataKey="predicted" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* Section C: Data Integrity Note */}
      <section id="savings" className="py-24 px-4 bg-page border-b border-line">
        <motion.div 
          variants={scrollVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-5xl mx-auto"
        >
          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-ink tracking-tight mb-4">What is measured and what is estimated</h2>
            <p className="text-ink-2 max-w-2xl">Transparency is critical. We never claim cost savings have been achieved unless they are proven by raw hardware telemetry. Every metric displays a clear source tag.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex flex-col gap-3">
              <SourceTag type="measured" className="w-fit" />
              <p className="text-sm text-ink leading-relaxed">Read directly from hardware sensors and electricity meters. These numbers represent indisputable reality on campus.</p>
            </Card>
            <Card className="flex flex-col gap-3">
              <SourceTag type="simulated" className="w-fit" />
              <p className="text-sm text-ink leading-relaxed">Generated from historical models when hardware is offline or running in the simulation demo mode.</p>
            </Card>
            <Card className="flex flex-col gap-3">
              <SourceTag type="predicted" className="w-fit" />
              <p className="text-sm text-ink leading-relaxed">Forecasted future usage calculated by our models, factoring in active schedules and local weather conditions.</p>
            </Card>
            <Card className="flex flex-col gap-3">
              <SourceTag type="estimated" className="w-fit" />
              <p className="text-sm text-ink leading-relaxed">Calculated potential savings derived by subtracting a proposed optimized schedule from the current baseline.</p>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* Section D: CTA and Footer */}
      <section className="bg-white py-24 px-4 text-center">
        <motion.div 
          variants={scrollVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl font-semibold text-ink tracking-tight mb-6">Ready to stop wasting energy?</h2>
          <Button onClick={() => navigate('/login')} className="mb-16 px-8 py-3 text-base">Start the interactive demo</Button>
          
          <div className="border-t border-line pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-3">
            <div className="font-semibold text-ink flex items-center gap-1">
              Minsaar<span className="w-1 h-1 rounded-full bg-accent" />
            </div>
            <div>Built for campus facilities teams.</div>
            <button onClick={() => navigate('/login')} className="hover:text-ink transition-colors font-medium">Sign in</button>
          </div>
        </motion.div>
      </section>

    </div>
  )
}