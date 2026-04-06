import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Bell, BellOff, BellRing, Calendar, TrendingDown, FlaskConical, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  sentinelShouldAlert,
  usageDropPercent,
  daysUntilRenewal,
  calcCostPerHour,
} from '../utils/calculations.js'
import clsx from 'clsx'

function RenewalCountdown({ days }) {
  const urgent = days <= 1
  const warning = days <= 3 && !urgent
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        urgent
          ? 'bg-red-500/20 text-red-400 animate-pulse-slow'
          : warning
          ? 'bg-amber-500/15 text-amber-400'
          : 'bg-slate-700 text-slate-400'
      )}
    >
      <Calendar className="w-3 h-3" />
      {days === 0
        ? 'Renews TODAY'
        : days === 1
        ? 'Renews tomorrow'
        : `Renews in ${days} days`}
    </div>
  )
}

function UsageDropBadge({ pct }) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        pct >= 75
          ? 'bg-red-500/20 text-red-400'
          : pct >= 50
          ? 'bg-amber-500/15 text-amber-400'
          : 'bg-slate-700 text-slate-400'
      )}
    >
      <TrendingDown className="w-3 h-3" />
      {pct}% usage drop
    </div>
  )
}

function AreaTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{payload[0]?.payload?.date}</p>
      <p className="text-violet-400 font-semibold">{payload[0]?.value} min</p>
    </div>
  )
}

function SentinelCard({ sub, profile, isAlert, devMode, isDropped, onToggleDrop }) {
  const [dismissed, setDismissed] = useState(false)
  const drop = usageDropPercent(sub.usageLogs)
  const days = daysUntilRenewal(sub.renewalDate)
  const cph = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)

  const trendData = sub.usageLogs.slice(-14).map((l) => ({
    date: l.date ? format(parseISO(l.date), 'MMM d') : '',
    minutes: l.minutes,
  }))

  const recentAvg = sub.usageLogs
    .slice(-7)
    .reduce((s, l) => s + l.minutes, 0) / 7
  const historicalAvg = sub.usageLogs
    .slice(0, -7)
    .reduce((s, l) => s + l.minutes, 0) / Math.max(1, sub.usageLogs.length - 7)

  return (
    <div
      className={clsx(
        'card overflow-hidden transition-all duration-300',
        isAlert && !dismissed
          ? 'border-red-500/40 shadow-[0_0_30px_-10px] shadow-red-500/20'
          : 'border-slate-800'
      )}
    >
      {/* Alert banner */}
      {isAlert && !dismissed && (
        <div className="bg-gradient-to-r from-red-950/60 to-slate-900 border-b border-red-900/40 px-4 py-4 flex items-start gap-3">
          <BellRing className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse-slow" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">⚡ AI Sentinel Alert</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              {sub.name} renews{' '}
              {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} — usage dropped{' '}
              <span className="font-bold text-red-300">{drop}%</span> in the last 7 days.
              Cancel before you're charged again?
            </p>
            {/* Hook quote */}
            <blockquote className="mt-3 border-l-2 border-red-500/60 pl-3">
              <p className="text-xs italic text-red-300/90 leading-relaxed">
                "Don't pay for the person you were last month —{' '}
                <span className="font-semibold not-italic text-red-200">
                  pay for the person you are today.
                </span>
                "
              </p>
            </blockquote>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          {/* Sub info */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sub.icon}</span>
            <div>
              <h3 className="font-semibold text-slate-200">{sub.name}</h3>
              <p className="text-xs text-slate-500">{sub.category} · ${sub.monthlyCost}/mo</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <RenewalCountdown days={days} />
                {drop > 0 && <UsageDropBadge pct={drop} />}
              </div>
            </div>
          </div>

          {/* Dev mode drop toggle */}
          {devMode && (
            <button
              onClick={() => onToggleDrop(sub.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                isDropped
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'text-slate-400 border-slate-700 hover:border-amber-500/30 hover:text-amber-400'
              )}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {isDropped ? 'Usage Zeroed' : 'Drop Usage'}
            </button>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricBox
            label="Recent Avg"
            value={`${recentAvg.toFixed(0)} min/d`}
            sub="last 7 days"
            color={recentAvg < historicalAvg * 0.5 ? 'red' : 'slate'}
          />
          <MetricBox
            label="Historical Avg"
            value={`${historicalAvg.toFixed(0)} min/d`}
            sub="prior 23 days"
            color="slate"
          />
          <MetricBox
            label="Cost/hr"
            value={cph === Infinity ? '$∞' : `$${cph}`}
            sub="this month"
            color={cph > profile.alertThresholdCPH ? 'red' : 'emerald'}
          />
        </div>

        {/* Trend chart */}
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${sub.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isAlert ? '#ef4444' : '#8b5cf6'}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isAlert ? '#ef4444' : '#8b5cf6'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip content={<AreaTooltip />} />
            <Area
              type="monotone"
              dataKey="minutes"
              stroke={isAlert ? '#ef4444' : '#8b5cf6'}
              strokeWidth={2}
              fill={`url(#grad-${sub.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Action row */}
        {isAlert && !dismissed && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
            <button className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 text-xs font-medium py-2 rounded-xl transition-all">
              Cancel Subscription
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 btn-ghost text-xs"
            >
              Keep for Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub, color }) {
  const colors = {
    red: 'text-red-400',
    emerald: 'text-emerald-400',
    slate: 'text-slate-300',
    amber: 'text-amber-400',
  }
  return (
    <div className="bg-slate-800/50 rounded-xl px-3 py-2">
      <p className={clsx('font-mono text-sm font-bold', colors[color])}>{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
      <p className="text-[10px] text-slate-600">{sub}</p>
    </div>
  )
}

export default function AISentinel({
  subscriptions,
  profile,
  devMode,
  droppedIds,
  toggleDrop,
}) {
  const alerts = useMemo(
    () =>
      subscriptions.filter((s) =>
        sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
      ),
    [subscriptions, profile.sentinelDropThreshold]
  )

  const nonAlerts = subscriptions.filter(
    (s) => !sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BellRing className="w-6 h-6 text-red-400" />
          AI Usage Sentinel
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Monitors usage trends and fires 48-hr warnings before costly renewals
        </p>
      </div>

      {/* Dev mode info */}
      {devMode && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Developer Mode Active</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Click "Drop Usage" on any card below to zero out the last 10 days of usage and
              trigger a live Sentinel alert for the judges.
            </p>
          </div>
        </div>
      )}

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<BellRing className="w-5 h-5 text-red-400" />}
          label="Active Alerts"
          value={alerts.length}
          color="text-red-400"
          bg="bg-red-500/10"
        />
        <SummaryCard
          icon={<Calendar className="w-5 h-5 text-amber-400" />}
          label="Renewing ≤ 2 Days"
          value={subscriptions.filter((s) => daysUntilRenewal(s.renewalDate) <= 2).length}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          label="Healthy"
          value={nonAlerts.length}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
      </div>

      {/* Alerts first */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-slate-300">Urgent Alerts</h3>
            <span className="badge bg-red-500/15 text-red-400">{alerts.length}</span>
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

      {/* All other subscriptions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Monitoring</h3>
          <span className="badge bg-slate-700 text-slate-400">{nonAlerts.length}</span>
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

function SummaryCard({ icon, label, value, color, bg }) {
  return (
    <div className="card p-4">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
        {icon}
      </div>
      <p className={clsx('text-2xl font-bold font-mono', color)}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  )
}
