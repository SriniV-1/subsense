import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Zap,
} from 'lucide-react'
import {
  calcValueScore, calcCostPerHour, normalizeScores,
  shouldSnooze, isDeadWeight, totalMonthlySpend, valueGrade,
} from '../utils/calculations.js'
import clsx from 'clsx'

// Per-bar gradient IDs for the chart
const BAR_COLORS = ['#a855f7','#ec4899','#f97316','#10b981','#0ea5e9','#f59e0b','#6366f1','#14b8a6']

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = parseFloat(value) || 0
    const duration = 900
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(parseFloat((ease * target).toFixed(decimals)))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, decimals])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-violet-100 rounded-2xl px-4 py-3 text-xs shadow-card-hover">
      <p className="font-bold font-display text-gray-800">{d.name}</p>
      <p className="text-violet-600 mt-1 font-mono font-semibold">Score: {d.valueScore}</p>
      <p className="text-gray-400">${d.cph === 99 ? '∞' : d.cph}/hr</p>
    </div>
  )
}

export default function Dashboard({ subscriptions, profile }) {
  const normalizedScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])

  const enriched = useMemo(
    () => subscriptions.map((sub, i) => ({
      ...sub,
      valueScore: calcValueScore(sub.totalMinutes, sub.monthlyCost),
      cph:        calcCostPerHour(sub.monthlyCost, sub.totalMinutes),
      normScore:  normalizedScores[i],
      snooze:     shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH),
      dead:       isDeadWeight(sub.usageLogs),
      grade:      valueGrade(normalizedScores[i]),
    })),
    [subscriptions, normalizedScores, profile]
  )

  const spend       = totalMonthlySpend(subscriptions)
  const totalHours  = subscriptions.reduce((s, sub) => s + sub.totalMinutes / 60, 0)
  const avgCPH      = spend / (totalHours || 1)
  const snoozeCount = enriched.filter((s) => s.snooze).length
  const deadCount   = enriched.filter((s) => s.dead).length

  const chartData = [...enriched]
    .sort((a, b) => b.valueScore - a.valueScore)
    .map((s) => ({ name: s.name, valueScore: s.valueScore, cph: s.cph === Infinity ? 99 : s.cph }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h2 className="text-3xl font-black font-display gradient-text">Portfolio Overview</h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Tracking {subscriptions.length} subscriptions — value-weighted analytics ✨
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Monthly Spend"
          value={<AnimatedNumber value={spend} prefix="$" decimals={2} />}
          sub={`Budget: $${profile.monthlyBudget}`}
          gradient="from-violet-500 to-purple-600"
          pct={(spend / profile.monthlyBudget) * 100}
          delay="0.05s"
        />
        <KPICard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Cost / Hour"
          value={<AnimatedNumber value={avgCPH} prefix="$" decimals={2} />}
          sub="across all apps"
          gradient={avgCPH > profile.alertThresholdCPH ? 'from-rose-400 to-pink-500' : 'from-emerald-400 to-teal-500'}
          delay="0.10s"
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Snooze Alerts"
          value={<AnimatedNumber value={snoozeCount} />}
          sub={`over $${profile.alertThresholdCPH}/hr threshold`}
          gradient="from-amber-400 to-orange-500"
          delay="0.15s"
        />
        <KPICard
          icon={<Zap className="w-5 h-5" />}
          label="Dead Weight"
          value={<AnimatedNumber value={deadCount} />}
          sub="unused this month"
          gradient="from-rose-400 to-pink-500"
          delay="0.20s"
        />
      </div>

      {/* Value Score chart */}
      <div className="card p-6 stagger-child" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h3 className="font-bold font-display text-gray-800">Value Score Ranking</h3>
        </div>
        <p className="text-xs text-gray-400 mb-5 font-medium">Hours used ÷ monthly cost — higher is better</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24 }}>
            <defs>
              {BAR_COLORS.map((color, i) => (
                <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <XAxis type="number" domain={[0, 'auto']} hide />
            <YAxis
              type="category" dataKey="name" width={110}
              tick={{ fontSize: 12, fill: '#6b7280', fontFamily: 'Nunito', fontWeight: 600 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(196,181,253,0.15)' }} />
            <Bar dataKey="valueScore" radius={[0, 8, 8, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`url(#bar-grad-${i % BAR_COLORS.length})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subscription grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">All Subscriptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enriched.map((sub, i) => (
            <SubscriptionCard key={sub.id} sub={sub} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, gradient, pct, delay }) {
  return (
    <div className="card p-5 stagger-child overflow-hidden relative" style={{ animationDelay: delay }}>
      {/* Gradient top strip */}
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r', gradient)} />

      <div className={clsx(
        'w-9 h-9 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-sm',
        gradient
      )}>
        {icon}
      </div>

      <p className="text-2xl font-black font-mono text-gray-800 tabular-nums">{value}</p>
      <p className="text-xs font-semibold font-display text-gray-500 mt-0.5">{label}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>

      {pct !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', gradient)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

const GRADE_STYLES = {
  'Excellent':   'badge-emerald',
  'Good':        'badge-sky',
  'Fair':        'badge-amber',
  'Poor':        'badge-rose',
  'Dead Weight': 'badge-rose',
}

function SubscriptionCard({ sub, index }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="card p-5 stagger-child relative overflow-hidden cursor-pointer"
      style={{
        animationDelay: `${0.05 * index}s`,
        boxShadow: hovered
          ? `0 10px 36px ${sub.accentColor}35`
          : undefined,
        borderColor: hovered ? `${sub.accentColor}60` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Colored accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl transition-all duration-300"
        style={{
          background: `linear-gradient(90deg, ${sub.accentColor}, ${sub.accentColor}88)`,
          opacity: hovered ? 1 : 0.6,
        }}
      />

      {/* Subtle background glow */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none rounded-3xl"
        style={{
          background: `radial-gradient(circle at top left, ${sub.accentColor}18, transparent 70%)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="text-2xl transition-transform duration-300"
            style={{ transform: hovered ? 'scale(1.2) rotate(-5deg)' : 'scale(1)' }}
          >
            {sub.icon}
          </span>
          <div>
            <p className="font-bold font-display text-gray-800 text-sm leading-tight">{sub.name}</p>
            <p className="text-xs text-gray-400">{sub.category} · {sub.tier}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-gray-700">${sub.monthlyCost}/mo</p>
          <span className={clsx('badge mt-1', sub.dead ? 'badge-rose' : sub.snooze ? 'badge-amber' : GRADE_STYLES[sub.grade?.label] ?? 'badge-violet')}>
            {sub.dead ? 'Dead Weight' : sub.snooze ? 'Snooze?' : sub.grade?.label ?? 'OK'}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="relative grid grid-cols-3 gap-2 mt-3">
        <Metric label="Value Score" value={sub.valueScore.toFixed(3)} color="text-violet-600" />
        <Metric label="Cost/hr"     value={sub.cph === Infinity ? '∞' : `$${sub.cph}`} color={sub.cph > 15 ? 'text-rose-500' : 'text-emerald-600'} />
        <Metric label="Hours/mo"    value={(sub.totalMinutes / 60).toFixed(1)}           color="text-gray-700" />
      </div>

      {/* Score bar */}
      <div className="mt-3 relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="value-bar" style={{ width: `${sub.normScore}%` }} />
      </div>
    </div>
  )
}

function Metric({ label, value, color }) {
  return (
    <div className="bg-violet-50/70 rounded-xl px-2 py-2 text-center hover:bg-violet-50 transition-colors">
      <p className={clsx('font-mono text-xs font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight font-medium">{label}</p>
    </div>
  )
}
