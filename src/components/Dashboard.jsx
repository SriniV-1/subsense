import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Zap,
} from 'lucide-react'
import {
  calcValueScore,
  calcCostPerHour,
  normalizeScores,
  shouldSnooze,
  isDeadWeight,
  totalMonthlySpend,
  valueGrade,
} from '../utils/calculations.js'
import clsx from 'clsx'

const CHART_COLORS = ['#8b5cf6', '#a78bfa', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#c4b5fd', '#ddd6fe']

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-200">{d.name}</p>
      <p className="text-violet-400 mt-0.5">Score: {d.valueScore}</p>
      <p className="text-slate-400">${d.cph === Infinity ? '∞' : d.cph}/hr</p>
    </div>
  )
}

export default function Dashboard({ subscriptions, profile }) {
  const normalizedScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])

  const enriched = useMemo(
    () =>
      subscriptions.map((sub, i) => ({
        ...sub,
        valueScore: calcValueScore(sub.totalMinutes, sub.monthlyCost),
        cph: calcCostPerHour(sub.monthlyCost, sub.totalMinutes),
        normScore: normalizedScores[i],
        snooze: shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH),
        dead: isDeadWeight(sub.usageLogs),
        grade: valueGrade(normalizedScores[i]),
      })),
    [subscriptions, normalizedScores, profile]
  )

  const spend = totalMonthlySpend(subscriptions)
  const totalHours = subscriptions.reduce((s, sub) => s + sub.totalMinutes / 60, 0)
  const avgCPH = spend / (totalHours || 1)
  const snoozeCount = enriched.filter((s) => s.snooze).length
  const deadCount = enriched.filter((s) => s.dead).length

  const chartData = [...enriched]
    .sort((a, b) => b.valueScore - a.valueScore)
    .map((s) => ({
      name: s.name,
      valueScore: s.valueScore,
      cph: s.cph === Infinity ? 99 : s.cph,
    }))

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">
          Portfolio Overview
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Tracking {subscriptions.length} subscriptions — value-weighted analytics
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Monthly Spend"
          value={`$${spend.toFixed(2)}`}
          sub={`Budget: $${profile.monthlyBudget}`}
          color="text-violet-400"
          pct={(spend / profile.monthlyBudget) * 100}
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Avg Cost / Hour"
          value={`$${avgCPH.toFixed(2)}`}
          sub="across all apps"
          color={avgCPH > profile.alertThresholdCPH ? 'text-red-400' : 'text-emerald-400'}
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Snooze Alerts"
          value={snoozeCount}
          sub={`${snoozeCount} over $${profile.alertThresholdCPH}/hr`}
          color="text-amber-400"
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Dead Weight"
          value={deadCount}
          sub="unused this month"
          color="text-red-400"
        />
      </div>

      {/* Value Score Chart */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Value Score Ranking</h3>
        <p className="text-xs text-slate-500 mb-5">
          Hours used ÷ monthly cost — higher is better
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" domain={[0, 'auto']} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
            <Bar dataKey="valueScore" radius={[0, 6, 6, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subscription Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">
          All Subscriptions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enriched.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, pct }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={clsx('p-1.5 rounded-lg bg-slate-800', color)}>{icon}</span>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <p className={clsx('stat-number', color)}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
      {pct !== undefined && (
        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-700', {
              'bg-emerald-500': pct < 70,
              'bg-amber-500': pct >= 70 && pct < 90,
              'bg-red-500': pct >= 90,
            })}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function SubscriptionCard({ sub }) {
  return (
    <div
      className={clsx(
        'card p-4 hover:border-slate-700 transition-all duration-200 relative overflow-hidden',
        sub.dead && 'border-red-900/50',
        sub.snooze && !sub.dead && 'border-amber-900/50'
      )}
    >
      {/* Accent glow */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${sub.accentColor}, transparent 70%)` }}
      />

      <div className="flex items-start justify-between mb-3 relative">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{sub.icon}</span>
          <div>
            <p className="font-semibold text-slate-200 text-sm leading-tight">{sub.name}</p>
            <p className="text-xs text-slate-500">{sub.category} · {sub.tier}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-slate-200">${sub.monthlyCost}/mo</p>
          {sub.dead ? (
            <span className="badge bg-red-500/15 text-red-400 mt-1">Dead Weight</span>
          ) : sub.snooze ? (
            <span className="badge bg-amber-500/15 text-amber-400 mt-1">Snooze?</span>
          ) : (
            <span className={clsx('badge mt-1', {
              'bg-emerald-500/15 text-emerald-400': sub.normScore >= 60,
              'bg-green-500/15 text-green-400': sub.normScore >= 40 && sub.normScore < 60,
              'bg-slate-500/15 text-slate-400': sub.normScore < 40,
            })}>
              {sub.grade.label}
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3 relative">
        <Metric
          label="Value Score"
          value={sub.valueScore.toFixed(3)}
          color="text-violet-400"
        />
        <Metric
          label="Cost/hr"
          value={sub.cph === Infinity ? '∞' : `$${sub.cph}`}
          color={sub.cph > 15 ? 'text-red-400' : 'text-emerald-400'}
        />
        <Metric
          label="Hours/mo"
          value={(sub.totalMinutes / 60).toFixed(1)}
          color="text-slate-300"
        />
      </div>

      {/* Score bar */}
      <div className="mt-3 relative">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="value-bar"
            style={{ width: `${sub.normScore}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-2 py-1.5 text-center">
      <p className={clsx('font-mono text-xs font-bold', color)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}
