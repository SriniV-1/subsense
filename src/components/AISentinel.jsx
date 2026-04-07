import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Bell, BellRing, Calendar, TrendingDown,
  FlaskConical, AlertCircle, CheckCircle2, AlertTriangle, Layers, DollarSign, Cpu,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  sentinelShouldAlert, usageDropPercent, daysUntilRenewal, calcCostPerHour,
  findCategoryOverlap, isBingeAndAbandon, hasChronicLowUsage,
  isBudgetOverflow, shouldSnooze, isDeadWeight, normalizeScores, valueGrade,
} from '../utils/calculations.js'
import { fetchInsights } from '../api/subscriptions.js'
import RoutingModal from './RoutingModal.jsx'
import clsx from 'clsx'

// Map backend alert types → lucide icon
function alertIcon(type) {
  switch (type) {
    case 'budget':       return <DollarSign className="w-4 h-4 text-rose-500" />
    case 'overlap':      return <Layers className="w-4 h-4 text-amber-500" />
    case 'binge_abandon':return <TrendingDown className="w-4 h-4 text-amber-500" />
    case 'chronic_low':  return <AlertTriangle className="w-4 h-4 text-violet-500" />
    case 'high_cph':     return <AlertCircle className="w-4 h-4 text-violet-500" />
    default:             return <AlertCircle className="w-4 h-4 text-gray-400" />
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      {days === 0 ? 'Renews TODAY' : days === 1 ? 'Renews tomorrow' : `Renews in ${days}d`}
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
      {pct}% drop
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

function SentinelCard({ sub, profile, isAlert, devMode, isDropped, onToggleDrop, onSnoozeInvest, swept, normScore = 0 }) {
  const [cancelState, setCancelState] = useState('idle') // idle | confirming | cancelled
  const [dismissed,   setDismissed]   = useState(false)

  const isDead    = isDeadWeight(sub.usageLogs) || valueGrade(normScore).label === 'Dead Weight'
  const isSnooze  = shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH)
  const showActions = (isAlert && !dismissed) || isDead || isSnooze

  const drop          = usageDropPercent(sub.usageLogs)
  const days          = daysUntilRenewal(sub.renewalDate)
  const cph           = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const recentAvg     = sub.usageLogs.slice(-7).reduce((s, l) => s + l.minutes, 0) / 7
  const historicalAvg = sub.usageLogs.slice(0, -7).reduce((s, l) => s + l.minutes, 0) / Math.max(1, sub.usageLogs.length - 7)
  const annualSavings = (sub.monthlyCost * 12).toFixed(0)

  const trendData = sub.usageLogs.slice(-14).map((l) => ({
    date:    l.date ? format(parseISO(l.date), 'MMM d') : '',
    minutes: l.minutes,
  }))

  if (cancelState === 'cancelled') {
    return (
      <div className="card overflow-hidden border-emerald-200">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black font-display text-emerald-700">Cancellation Initiated</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {sub.name} will not renew. You save{' '}
              <span className="font-mono font-black">${sub.monthlyCost}/mo</span> ·{' '}
              <span className="font-mono font-black">${annualSavings}/yr</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black font-mono text-emerald-600">${sub.monthlyCost}</p>
            <p className="text-[10px] text-emerald-500 font-semibold">saved/mo</p>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center gap-3">
          <span className="text-2xl">{sub.icon}</span>
          <div>
            <p className="text-sm font-bold font-display text-gray-500 line-through">{sub.name}</p>
            <p className="text-xs text-gray-400">{sub.category} · was ${sub.monthlyCost}/mo</p>
          </div>
          <span className="ml-auto badge badge-emerald">Cancelled</span>
        </div>
      </div>
    )
  }

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
            <p className="text-sm font-black font-display text-rose-600">AI Sentinel Alert</p>
            <p className="text-xs text-rose-500 mt-0.5">
              {sub.name} renews{' '}
              {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} — usage dropped{' '}
              <span className="font-black text-rose-600">{drop}%</span> in the last 7 days.
            </p>
            <blockquote className="mt-3 pl-3 border-l-2 border-rose-400">
              <p className="text-xs italic text-rose-500 leading-relaxed">
                "Don't pay for the person you were last month —{' '}
                <span className="font-black not-italic text-rose-700">pay for the person you are today.</span>"
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
            <span className={clsx('text-2xl', isAlert && !dismissed && 'animate-wiggle')}>
              {sub.icon}
            </span>
            <div>
              <h3 className="font-bold font-display text-gray-800">{sub.name}</h3>
              <p className="text-xs text-gray-400">
                {sub.category} · <span className="font-mono font-semibold">${sub.monthlyCost}/mo</span>
              </p>
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
              {isDropped ? 'Zeroed' : 'Drop Usage'}
            </button>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricBox label="Recent Avg"  value={`${recentAvg.toFixed(0)} min/d`}     sub="last 7 days"  hot={recentAvg < historicalAvg * 0.5} />
          <MetricBox label="Prev Avg"    value={`${historicalAvg.toFixed(0)} min/d`} sub="prior period" />
          <MetricBox label="Cost/hr"     value={cph === Infinity ? '$∞' : `$${cph}`}  sub="this month"   hot={cph > profile.alertThresholdCPH} />
        </div>

        {/* Sparkline */}
        <ResponsiveContainer width="100%" height={80}>
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
        {showActions && (
          <>
            {/* Dead weight / snooze label when not a sentinel alert */}
            {!isAlert && (isDead || isSnooze) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5 mb-2">
                {isDead && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">
                    Dead Weight
                  </span>
                )}
                {isSnooze && !isDead && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                    High CPH
                  </span>
                )}
              </div>
            )}

            {cancelState === 'confirming' ? (
              <div className={clsx('space-y-2', !isAlert && 'mt-2')}>
                <div className="bg-rose-50 rounded-xl px-3 py-2.5 border border-rose-100">
                  <p className="text-xs font-bold text-rose-700">
                    Cancel {sub.name}?
                  </p>
                  <p className="text-xs text-rose-500 mt-0.5">
                    Saves <span className="font-mono font-black">${sub.monthlyCost}/mo</span> ·{' '}
                    <span className="font-mono font-black">${annualSavings}/yr</span>. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCancelState('cancelled')}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold font-display py-2 rounded-xl transition-all duration-200 active:scale-95"
                  >
                    Confirm Cancel
                  </button>
                  <button
                    onClick={() => setCancelState('idle')}
                    className="flex-1 btn-ghost text-xs font-semibold"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            ) : (
              <div className={clsx('flex gap-2 pt-3 border-t border-gray-100', !isAlert ? 'mt-0' : 'mt-3')}>
                {swept ? (
                  <div
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-center text-indigo-600"
                    style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    Routed to portfolio ✓
                  </div>
                ) : (
                  <button
                    onClick={() => onSnoozeInvest(sub)}
                    className="flex-1 text-xs font-bold font-display py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(99,102,241,0.08))',
                      border: '1px solid rgba(124,58,237,0.3)',
                      color: '#7c3aed',
                    }}
                  >
                    ⚡ Snooze &amp; Invest
                  </button>
                )}
                <button
                  onClick={() => setCancelState('confirming')}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold font-display py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  Cancel Sub
                </button>
                {isAlert && !dismissed && (
                  <button
                    onClick={() => setDismissed(true)}
                    className="flex-1 btn-ghost text-xs font-semibold"
                  >
                    Keep
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetricBox({ label, value, sub, hot }) {
  return (
    <div className={clsx(
      'rounded-2xl px-3 py-2.5 transition-all duration-200',
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
    <div className="card p-5 stagger-child">
      <div className={clsx('w-11 h-11 rounded-2xl flex items-center justify-center mb-3 shadow-sm', bg)}>
        {icon}
      </div>
      <p className={clsx('text-2xl font-black font-mono', color)}>{value}</p>
      <p className="text-xs font-semibold font-display text-gray-400 mt-1">{label}</p>
    </div>
  )
}

// ── Portfolio insight cards ───────────────────────────────────────────────────

function InsightCard({ icon, title, body, severity }) {
  const styles = {
    high:   { card: 'border-rose-200 bg-rose-50/50',   icon: 'bg-rose-100',   title: 'text-rose-700',   body: 'text-rose-500' },
    medium: { card: 'border-amber-200 bg-amber-50/50', icon: 'bg-amber-100',  title: 'text-amber-700',  body: 'text-amber-600' },
    low:    { card: 'border-violet-100 bg-violet-50/30', icon: 'bg-violet-100', title: 'text-violet-700', body: 'text-violet-500' },
  }[severity] ?? {}

  return (
    <div className={clsx('card p-4 flex items-start gap-3', styles.card)}>
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', styles.icon)}>
        {icon}
      </div>
      <div>
        <p className={clsx('text-sm font-bold font-display', styles.title)}>{title}</p>
        <p className={clsx('text-xs mt-0.5 leading-relaxed', styles.body)}>{body}</p>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AISentinel({
  subscriptions, profile, devMode, droppedIds, toggleDrop,
  sweptSubIds = new Set(), onInvest,
}) {
  const [sweepTarget,  setSweepTarget]  = useState(null)
  const [apiInsights,  setApiInsights]  = useState(null)  // null = not fetched yet
  const [apiSource,    setApiSource]    = useState(false)  // true when using backend data
  const [activeTab,    setActiveTab]    = useState('alerts') // 'alerts' | 'insights' | 'monitoring'

  // Normalized scores keyed by subscription id — for grade-based dead weight detection
  const normScoreMap = useMemo(() => {
    const scores = normalizeScores(subscriptions)
    return Object.fromEntries(subscriptions.map((s, i) => [s.id, scores[i]]))
  }, [subscriptions])

  // Try to load insights from the Java backend; fall back to local computation
  useEffect(() => {
    fetchInsights()
      .then(data => { setApiInsights(data); setApiSource(true) })
      .catch(() => { setApiInsights(null); setApiSource(false) })
  }, [subscriptions])

  const alerts = useMemo(
    () => subscriptions.filter((s) =>
      sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
    ),
    [subscriptions, profile.sentinelDropThreshold]
  )
  const nonAlerts = subscriptions.filter(
    (s) => !sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
  )

  // ── Portfolio-level insights (local fallback when backend offline) ────────
  const localInsights = useMemo(() => {
    const result = []
    // Exclude snoozed+invested subs — they're already handled
    const activeSubs = subscriptions.filter(s => !sweptSubIds.has(s.id))

    // Budget overflow — based on active spend only
    if (isBudgetOverflow(activeSubs, profile.monthlyBudget)) {
      const over = activeSubs.reduce((s, x) => s + x.monthlyCost, 0) - profile.monthlyBudget
      result.push({
        id: 'budget',
        severity: 'high',
        icon: <DollarSign className="w-4 h-4 text-rose-500" />,
        title: `Over Budget by $${over.toFixed(2)}/mo`,
        body: `Active subscriptions total $${activeSubs.reduce((s, x) => s + x.monthlyCost, 0).toFixed(2)}/mo against a $${profile.monthlyBudget} budget. Cancel or snooze to get back on track.`,
      })
    }

    // Category overlap — active subs only
    findCategoryOverlap(activeSubs).forEach(({ category, subs, totalCost }) => {
      result.push({
        id: `overlap-${category}`,
        severity: 'medium',
        icon: <Layers className="w-4 h-4 text-amber-500" />,
        title: `${subs.length} ${category} subscriptions — $${totalCost.toFixed(2)}/mo`,
        body: `${subs.map(s => s.name).join(', ')} overlap in the ${category} category. You may only need one.`,
      })
    })

    // Binge-and-abandon — active subs only
    activeSubs.forEach((s) => {
      if (isBingeAndAbandon(s.usageLogs)) {
        result.push({
          id: `binge-${s.id}`,
          severity: 'medium',
          icon: <TrendingDown className="w-4 h-4 text-amber-500" />,
          title: `${s.name}: Binge & Abandon Pattern`,
          body: `${s.name} saw heavy usage historically but has gone cold. You're paying $${s.monthlyCost}/mo for something you've stopped using.`,
        })
      }
    })

    // Chronic low usage — active subs only
    activeSubs.forEach((s) => {
      if (hasChronicLowUsage(s.usageLogs)) {
        result.push({
          id: `chronic-${s.id}`,
          severity: 'low',
          icon: <AlertTriangle className="w-4 h-4 text-violet-500" />,
          title: `${s.name}: Consistently Low Usage`,
          body: `${s.name} averages under 8 min/day all month at $${s.monthlyCost}/mo. Consider whether it's worth keeping.`,
        })
      }
    })

    // High CPH not near renewal — active subs only
    activeSubs.forEach((s) => {
      const days = daysUntilRenewal(s.renewalDate)
      const cph  = calcCostPerHour(s.monthlyCost, s.totalMinutes)
      if (
        shouldSnooze(s.monthlyCost, s.totalMinutes, profile.alertThresholdCPH) &&
        days > 2 &&
        !alerts.find(a => a.id === s.id)
      ) {
        result.push({
          id: `cph-${s.id}`,
          severity: 'low',
          icon: <AlertCircle className="w-4 h-4 text-violet-500" />,
          title: `${s.name}: High Cost-Per-Hour ($${cph === Infinity ? '∞' : cph}/hr)`,
          body: `Above your $${profile.alertThresholdCPH}/hr threshold. Renews in ${days} days — watch this one.`,
        })
      }
    })

    return result
  }, [subscriptions, profile, alerts, sweptSubIds])

  // Use backend insights when available, local computation as fallback
  const insights = apiInsights ?? localInsights

  const TAB_CONFIG = [
    { id: 'alerts',     label: 'Alerts',     count: alerts.length,   color: 'rose' },
    { id: 'insights',   label: 'Insights',   count: insights.length, color: 'amber' },
    { id: 'monitoring', label: 'Monitoring', count: nonAlerts.length, color: 'violet' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child">
        <h2 className="text-3xl font-black font-display flex items-center gap-2" style={{ color: '#be185d' }}>
          <BellRing className="w-7 h-7 text-rose-500" />
          AI Usage Sentinel
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Monitors usage trends, portfolio health, and fires smart alerts before costly renewals
        </p>
      </div>

      {/* Dev mode banner */}
      {devMode && (
        <div className="card stagger-child p-4 border-amber-200 bg-amber-50 flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold font-display text-amber-700">Developer Mode Active</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Click "Drop Usage" on any card to zero out the last 10 days and trigger a live Sentinel alert.
            </p>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 stagger-child">
        <SummaryCard
          icon={<BellRing className="w-5 h-5 text-rose-500" />}
          label="Active Alerts"
          value={alerts.length}
          color="text-rose-500"
          bg="bg-rose-100"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          label="Portfolio Insights"
          value={insights.length}
          color="text-amber-500"
          bg="bg-amber-100"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          label="Monitoring"
          value={nonAlerts.length}
          color="text-emerald-500"
          bg="bg-emerald-100"
        />
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 stagger-child">
        {TAB_CONFIG.map(({ id, label, count, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold font-display transition-all duration-200',
              activeTab === id
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
            {count > 0 && (
              <span className={clsx(
                'text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center',
                activeTab === id
                  ? color === 'rose'   ? 'bg-rose-100 text-rose-600'
                  : color === 'amber'  ? 'bg-amber-100 text-amber-600'
                                       : 'bg-violet-100 text-violet-600'
                  : 'bg-gray-200 text-gray-500'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Alerts ────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4 stagger-child">
          {alerts.length === 0 ? (
            <div className="rounded-3xl p-12 text-center"
              style={{ background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.15)' }}>
              <CheckCircle2 className="w-10 h-10 text-rose-300 mx-auto mb-3" />
              <p className="text-lg font-black font-display text-rose-600">No Active Alerts</p>
              <p className="text-sm text-gray-400 mt-1">All subscriptions look healthy right now.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
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
                    onSnoozeInvest={setSweepTarget}
                    swept={sweptSubIds.has(sub.id)}
                    normScore={normScoreMap[sub.id] ?? 0}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Insights ──────────────────────────────────────────────────── */}
      {activeTab === 'insights' && (
        <div className="space-y-4 stagger-child">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">Portfolio Insights</h3>
            <span className="badge badge-amber">{insights.length}</span>
            {apiSource && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                <Cpu className="w-3 h-3" /> Java API
              </span>
            )}
          </div>

          {insights.length === 0 ? (
            <div className="rounded-3xl p-12 text-center"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <CheckCircle2 className="w-10 h-10 text-amber-300 mx-auto mb-3" />
              <p className="text-lg font-black font-display text-amber-600">Portfolio Looks Good</p>
              <p className="text-sm text-gray-400 mt-1">No issues detected across your subscriptions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map(insight => (
                <InsightCard
                  key={insight.id}
                  {...insight}
                  icon={insight.icon ?? alertIcon(insight.type)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Monitoring ────────────────────────────────────────────────── */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4 stagger-child">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">All Subscriptions</h3>
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
                onSnoozeInvest={setSweepTarget}
                swept={sweptSubIds.has(sub.id)}
                normScore={normScoreMap[sub.id] ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {sweepTarget && (
        <RoutingModal
          subscription={sweepTarget}
          onClose={() => setSweepTarget(null)}
          onInvest={onInvest}
        />
      )}
    </div>
  )
}
