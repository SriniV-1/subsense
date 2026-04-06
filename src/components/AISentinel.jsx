import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Bell, BellOff, BellRing, Calendar, TrendingDown,
  FlaskConical, AlertCircle, CheckCircle2, Sparkles,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  sentinelShouldAlert, usageDropPercent, daysUntilRenewal, calcCostPerHour,
} from '../utils/calculations.js'
import clsx from 'clsx'

function RenewalCountdown({ days }) {
  const urgent  = days <= 1
  const warning = days <= 3 && !urgent
  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-display',
      urgent  ? 'bg-rose-100 text-rose-600 animate-pulse-soft' :
      warning ? 'bg-amber-100 text-amber-600' :
                'bg-violet-100 text-violet-600'
    )}>
      <Calendar className="w-3 h-3" />
      {days === 0 ? 'Renews TODAY 😱' : days === 1 ? 'Renews tomorrow' : `Renews in ${days} days`}
    </div>
  )
}

function DropBadge({ pct }) {
  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-display',
      pct >= 75 ? 'bg-rose-100 text-rose-600' :
      pct >= 50 ? 'bg-amber-100 text-amber-600' :
                  'bg-gray-100 text-gray-500'
    )}>
      <TrendingDown className="w-3 h-3" />
      {pct}% usage drop
    </div>
  )
}

function AreaTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-violet-100 rounded-2xl px-3 py-2 text-xs shadow-card-hover">
      <p className="text-gray-400 font-medium">{payload[0]?.payload?.date}</p>
      <p className="text-violet-600 font-bold font-mono">{payload[0]?.value} min</p>
    </div>
  )
}

function SentinelCard({ sub, profile, isAlert, devMode, isDropped, onToggleDrop }) {
  const [dismissed, setDismissed] = useState(false)
  const drop       = usageDropPercent(sub.usageLogs)
  const days       = daysUntilRenewal(sub.renewalDate)
  const cph        = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const recentAvg  = sub.usageLogs.slice(-7).reduce((s, l) => s + l.minutes, 0) / 7
  const historicalAvg = sub.usageLogs.slice(0, -7).reduce((s, l) => s + l.minutes, 0) / Math.max(1, sub.usageLogs.length - 7)

  const trendData = sub.usageLogs.slice(-14).map((l) => ({
    date: l.date ? format(parseISO(l.date), 'MMM d') : '',
    minutes: l.minutes,
  }))

  return (
    <div className={clsx(
      'card overflow-hidden transition-all duration-300 stagger-child',
      isAlert && !dismissed ? 'border-rose-200 shadow-rose' : ''
    )}>
      {/* Alert banner */}
      {isAlert && !dismissed && (
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-5 py-4 flex items-start gap-3">
          <BellRing className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-wiggle" />
          <div className="flex-1">
            <p className="text-sm font-black font-display text-rose-600">⚡ AI Sentinel Alert</p>
            <p className="text-xs text-rose-500 mt-0.5">
              {sub.name} renews{' '}
              {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} — usage dropped{' '}
              <span className="font-black text-rose-600">{drop}%</span> in the last 7 days.
            </p>
            {/* The hook quote */}
            <blockquote className="mt-3 pl-3 border-l-2 border-rose-400">
              <p className="text-xs italic text-rose-500 leading-relaxed">
                "Don't pay for the person you were last month —{' '}
                <span className="font-black not-italic text-rose-700">
                  pay for the person you are today.
                </span>"
              </p>
            </blockquote>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-rose-300 hover:text-rose-500 transition-colors text-xs font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={clsx(
              'text-2xl transition-transform duration-300',
              isAlert && !dismissed && 'animate-wiggle'
            )}>
              {sub.icon}
            </span>
            <div>
              <h3 className="font-bold font-display text-gray-800">{sub.name}</h3>
              <p className="text-xs text-gray-400">{sub.category} · <span className="font-mono font-semibold">${sub.monthlyCost}/mo</span></p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <RenewalCountdown days={days} />
                {drop > 0 && <DropBadge pct={drop} />}
              </div>
            </div>
          </div>

          {devMode && (
            <button
              onClick={() => onToggleDrop(sub.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-display border transition-all duration-200',
                isDropped
                  ? 'bg-amber-100 text-amber-600 border-amber-200'
                  : 'text-gray-400 border-gray-200 hover:border-amber-200 hover:text-amber-500 hover:bg-amber-50'
              )}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {isDropped ? '✅ Zeroed' : 'Drop Usage'}
            </button>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricBox label="Recent Avg"  value={`${recentAvg.toFixed(0)} min/d`} sub="last 7 days"  hot={recentAvg < historicalAvg * 0.5} />
          <MetricBox label="Prev Avg"    value={`${historicalAvg.toFixed(0)} min/d`} sub="prior period" />
          <MetricBox label="Cost/hr"     value={cph === Infinity ? '$∞' : `$${cph}`} sub="this month"   hot={cph > profile.alertThresholdCPH} />
        </div>

        {/* Trend sparkline */}
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`area-${sub.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isAlert ? '#f43f5e' : '#a855f7'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isAlert ? '#f43f5e' : '#a855f7'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip content={<AreaTooltip />} />
            <Area
              type="monotone" dataKey="minutes"
              stroke={isAlert ? '#f43f5e' : '#a855f7'}
              strokeWidth={2}
              fill={`url(#area-${sub.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Actions */}
        {isAlert && !dismissed && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold font-display py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5">
              Cancel Subscription
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 btn-ghost text-xs font-semibold"
            >
              Keep for Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub, hot }) {
  return (
    <div className={clsx(
      'rounded-2xl px-3 py-2.5 transition-all duration-200 hover:scale-105',
      hot ? 'bg-rose-50 border border-rose-100' : 'bg-violet-50 border border-violet-100'
    )}>
      <p className={clsx('font-mono text-sm font-black', hot ? 'text-rose-500' : 'text-gray-700')}>{value}</p>
      <p className="text-[10px] font-bold font-display text-gray-500 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  )
}

function SummaryCard({ icon, label, value, color, bg }) {
  return (
    <div className="card p-5 stagger-child hover:scale-105 transition-transform duration-200 cursor-default">
      <div className={clsx('w-11 h-11 rounded-2xl flex items-center justify-center mb-3 shadow-sm', bg)}>
        {icon}
      </div>
      <p className={clsx('text-2xl font-black font-mono', color)}>{value}</p>
      <p className="text-xs font-semibold font-display text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function AISentinel({
  subscriptions, profile, devMode, droppedIds, toggleDrop,
}) {
  const alerts = useMemo(
    () => subscriptions.filter((s) =>
      sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
    ),
    [subscriptions, profile.sentinelDropThreshold]
  )
  const nonAlerts = subscriptions.filter(
    (s) => !sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child">
        <h2 className="text-3xl font-black font-display flex items-center gap-2" style={{ color: '#be185d' }}>
          <BellRing className="w-7 h-7 text-rose-500" />
          AI Usage Sentinel
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Monitors usage trends and fires 48-hr warnings before costly renewals 🚨
        </p>
      </div>

      {/* Dev mode banner */}
      {devMode && (
        <div className="card stagger-child p-4 border-amber-200 bg-amber-50 flex items-start gap-3" style={{ animationDelay: '0.05s' }}>
          <FlaskConical className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold font-display text-amber-700">Developer Mode Active 🧪</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Click "Drop Usage" on any card to zero out the last 10 days and trigger a live Sentinel alert!
            </p>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<BellRing className="w-5 h-5 text-rose-500" />}
          label="Active Alerts"
          value={alerts.length}
          color="text-rose-500"
          bg="bg-rose-100"
        />
        <SummaryCard
          icon={<Calendar className="w-5 h-5 text-amber-500" />}
          label="Renewing ≤ 2 Days"
          value={subscriptions.filter((s) => daysUntilRenewal(s.renewalDate) <= 2).length}
          color="text-amber-500"
          bg="bg-amber-100"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          label="Healthy"
          value={nonAlerts.length}
          color="text-emerald-500"
          bg="bg-emerald-100"
        />
      </div>

      {/* Alerts first */}
      {alerts.length > 0 && (
        <div className="stagger-child" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">Urgent Alerts</h3>
            <span className="badge badge-rose">{alerts.length}</span>
          </div>
          <div className="space-y-4">
            {alerts.map((sub) => (
              <SentinelCard
                key={sub.id}
                sub={sub}
                profile={profile}
                isAlert
                devMode={devMode}
                isDropped={droppedIds.includes(sub.id)}
                onToggleDrop={toggleDrop}
              />
            ))}
          </div>
        </div>
      )}

      {/* Monitoring */}
      <div className="stagger-child" style={{ animationDelay: '0.20s' }}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-bold font-display text-gray-700">Monitoring</h3>
          <span className="badge badge-violet">{nonAlerts.length}</span>
        </div>
        <div className="space-y-4">
          {nonAlerts.map((sub) => (
            <SentinelCard
              key={sub.id}
              sub={sub}
              profile={profile}
              isAlert={false}
              devMode={devMode}
              isDropped={droppedIds.includes(sub.id)}
              onToggleDrop={toggleDrop}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
