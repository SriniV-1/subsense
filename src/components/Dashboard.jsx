import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import RoutingModal from './RoutingModal.jsx'
import BatchActionModal from './BatchActionModal.jsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Zap, X, ExternalLink,
  ShieldCheck, Cpu, ChevronRight,
} from 'lucide-react'
import ValueScoreModal from './ValueScoreModal.jsx'
import {
  calcValueScore, calcCostPerHour, normalizeScores,
  shouldSnooze, isDeadWeight, totalMonthlySpend, valueGrade,
  daysUntilRenewal, isBudgetOverflow, findCategoryOverlap, sentinelShouldAlert,
} from '../utils/calculations.js'
import { fetchPortfolioSummary } from '../api/subscriptions.js'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

const BAR_COLORS = ['#a855f7','#ec4899','#f97316','#10b981','#0ea5e9','#f59e0b','#6366f1','#14b8a6']

function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

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
      <p className="text-violet-400 mt-1.5 text-[10px]">click bar to inspect →</p>
    </div>
  )
}

// ── Subscription Detail Modal ──────────────────────────────────────────────────

function MiniTrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-violet-100 rounded-xl px-2.5 py-1.5 text-xs shadow-card-hover">
      <p className="text-gray-400">{payload[0]?.payload?.date}</p>
      <p className="text-violet-600 font-mono font-bold">{payload[0]?.value} min</p>
    </div>
  )
}

function SubscriptionDetailModal({ sub, onClose, onSnoozeInvest, swept, onVsInspect }) {
  const navigate = useNavigate()
  const accent = (sub.accentColor === '#ffffff' || sub.accentColor === '#fff') ? '#818cf8' : sub.accentColor
  const days = daysUntilRenewal(sub.renewalDate)

  const trendData = sub.usageLogs.slice(-14).map((l) => ({
    date:    l.date ? format(parseISO(l.date), 'MMM d') : '',
    minutes: l.minutes,
  }))
  const avgMinutes = sub.usageLogs.reduce((s, l) => s + l.minutes, 0) / sub.usageLogs.length

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden bg-white max-h-[90vh] overflow-y-auto"
        style={{ border: `1px solid ${accent}30`, boxShadow: `0 20px 60px ${accent}20, 0 8px 32px rgba(0,0,0,0.15)` }}
      >
        {/* Accent top */}
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{sub.icon}</span>
              <div>
                <h2 className="font-black font-display text-gray-800 text-xl">{sub.name}</h2>
                <p className="text-sm text-gray-400">{sub.category} · {sub.tier}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { onClose(); navigate('/heatmap') }}
                className="text-violet-400 hover:text-violet-600 transition-colors"
                title="View in Heatmap"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Monthly Cost',  value: `$${sub.monthlyCost}/mo`,                    color: 'text-gray-800',    clickable: false },
              { label: 'Value Score',   value: sub.valueScore.toFixed(4),                    color: 'text-violet-600',  clickable: true  },
              { label: 'Cost / Hour',   value: sub.cph === Infinity ? '$∞/hr' : `$${sub.cph}/hr`,
                color: sub.cph > 15 ? 'text-rose-500' : 'text-emerald-600',                                            clickable: false },
              { label: 'Hours / Month', value: `${(sub.totalMinutes / 60).toFixed(1)} hrs`,  color: 'text-gray-700',    clickable: false },
              { label: 'Renews In',     value: days === 0 ? 'Today!' : `${days} days`,
                color: days <= 2 ? 'text-rose-500' : days <= 7 ? 'text-amber-500' : 'text-gray-700',                   clickable: false },
              { label: 'Grade',         value: sub.grade?.label ?? 'N/A',
                color: sub.dead ? 'text-rose-500' : sub.snooze ? 'text-amber-500' : 'text-emerald-600',                clickable: false },
            ].map(({ label, value, color, clickable }) => (
              <div
                key={label}
                className={clsx('bg-violet-50/60 rounded-2xl px-4 py-3 relative', clickable && 'cursor-pointer hover:bg-violet-100/70 transition-colors group')}
                onClick={clickable ? () => onVsInspect?.(sub) : undefined}
              >
                <p className={clsx('font-mono text-base font-black', color)}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{label}</p>
                {clickable && (
                  <span className="absolute top-2 right-2 text-[9px] text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                    inspect ↗
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {sub.dead && <span className="badge badge-rose">Dead Weight</span>}
            {sub.snooze && !sub.dead && <span className="badge badge-amber">Snooze Candidate</span>}
            {swept && <span className="badge badge-emerald">Invested ✓</span>}
            <span className="badge badge-violet">Renews {sub.renewalDate}</span>
            <span className="badge" style={{ background: `${accent}15`, color: accent }}>
              {sub.usagePattern}
            </span>
          </div>

          {/* 14-day trend */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">14-Day Usage Trend</p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id={`modal-line-${sub.id}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={accent} />
                    <stop offset="100%" stopColor={accent}  stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<MiniTrendTooltip />} />
                <ReferenceLine y={avgMinutes} stroke="#c4b5fd" strokeDasharray="4 2" strokeWidth={1.5} />
                <Line
                  type="monotone" dataKey="minutes"
                  stroke={`url(#modal-line-${sub.id})`}
                  strokeWidth={2.5}
                  dot={{ fill: accent, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: accent, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 text-right mt-1 font-mono">
              avg {avgMinutes.toFixed(0)} min/day
            </p>
          </div>

          {/* CTA */}
          {!swept && (
            <button
              onClick={() => { onClose(); onSnoozeInvest(sub) }}
              className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-all duration-200 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${accent}, #4f46e5)`, boxShadow: `0 4px 20px ${accent}30` }}
            >
              {(sub.snooze || sub.dead || sub.grade?.label === 'Dead Weight') ? '⚡ Snooze & Invest' : '↗ Invest'} ${sub.monthlyCost.toFixed(2)}
            </button>
          )}
          {swept && (
            <div
              className="w-full py-3 rounded-2xl text-sm font-semibold text-center text-indigo-600"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              Routed to index portfolio ✓
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── KPI Detail Modal ──────────────────────────────────────────────────────────

function KPIDetailModal({ type, enriched, profile, spend, avgCPH, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black font-display text-gray-800 text-lg">
            {{ spend: 'Spend Breakdown', cph: 'Cost Per Hour', snooze: 'Snooze Candidates', dead: 'Dead Weight Detail' }[type]}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {type === 'spend' && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-gray-500 font-semibold px-1 mb-1">
              <span>Subscription</span><span>Cost · % of budget</span>
            </div>
            {[...enriched].sort((a, b) => b.monthlyCost - a.monthlyCost).map(sub => {
              const pct = (sub.monthlyCost / profile.monthlyBudget) * 100
              const accent = (sub.accentColor === '#ffffff') ? '#818cf8' : sub.accentColor
              return (
                <div key={sub.id} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{sub.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <p className="text-sm font-bold text-gray-700 truncate">{sub.name}</p>
                      <p className="font-mono text-sm font-black text-gray-800 shrink-0 ml-2">${sub.monthlyCost}</p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: accent }} />
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-mono font-black">
              <span className="text-gray-600">Total</span>
              <span className="text-violet-600">${spend.toFixed(2)} / ${profile.monthlyBudget}</span>
            </div>
          </div>
        )}

        {type === 'cph' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-3">Threshold: ${profile.alertThresholdCPH}/hr · lower is better</p>
            {[...enriched].sort((a, b) => (a.cph === Infinity ? 9999 : a.cph) - (b.cph === Infinity ? 9999 : b.cph)).map(sub => (
              <div key={sub.id} className="flex items-center gap-3">
                <span className="text-lg shrink-0">{sub.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-700">{sub.name}</p>
                  <p className="text-[11px] text-gray-400">{(sub.totalMinutes / 60).toFixed(1)} hrs/mo</p>
                </div>
                <span className={clsx(
                  'font-mono text-sm font-black shrink-0',
                  sub.cph === Infinity ? 'text-rose-500' :
                  sub.cph > profile.alertThresholdCPH ? 'text-amber-500' : 'text-emerald-600'
                )}>
                  {sub.cph === Infinity ? '∞' : `$${sub.cph}`}/hr
                </span>
              </div>
            ))}
          </div>
        )}

        {type === 'snooze' && (
          <div className="space-y-3">
            {enriched.filter(s => s.snooze).length === 0
              ? <p className="text-gray-400 text-sm text-center py-6">No snooze candidates right now!</p>
              : enriched.filter(s => s.snooze).map(sub => (
                <div key={sub.id} className="card p-3 border-amber-100 bg-amber-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sub.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{sub.name}</p>
                      <p className="text-xs text-amber-600 font-mono">
                        ${sub.cph === Infinity ? '∞' : sub.cph}/hr · ${sub.monthlyCost}/mo
                      </p>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {type === 'dead' && (
          <div className="space-y-3">
            {enriched.filter(s => s.dead).length === 0
              ? <p className="text-gray-400 text-sm text-center py-6">No dead weight found!</p>
              : enriched.filter(s => s.dead).map(sub => (
                <div key={sub.id} className="card p-3 border-rose-100 bg-rose-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sub.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{sub.name}</p>
                      <p className="text-xs text-rose-500 font-mono">
                        ${sub.monthlyCost}/mo · ${(sub.monthlyCost * 12).toFixed(0)}/yr wasted
                      </p>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({ subscriptions, profile, sweptSubIds = new Set(), investments = [], onInvest, onSnooze }) {
  const normalizedScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])
  const [sweepTarget,    setSweepTarget]    = useState(null)
  const [batchTarget,    setBatchTarget]    = useState(null)   // array of dead-weight subs for batch modal
  const [detailSub,      setDetailSub]      = useState(null)
  const [kpiDetail,      setKpiDetail]      = useState(null)
  const [portfolioData,  setPortfolioData]  = useState(null)
  const [apiSource,      setApiSource]      = useState(false)
  const [vsTarget,          setVsTarget]          = useState(null)   // value score inspect
  const [expandedCategory,  setExpandedCategory]  = useState(null)   // category expand
  const [subSort,           setSubSort]           = useState('default')

  useEffect(() => {
    fetchPortfolioSummary()
      .then(data => { setPortfolioData(data); setApiSource(true) })
      .catch(() => setApiSource(false))
  }, [subscriptions])

  const investmentMap = useMemo(
    () => Object.fromEntries(investments.map(inv => [inv.subId, inv])),
    [investments]
  )

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

  const flagged     = enriched.filter(s => s.snooze || s.dead || s.grade?.label === 'Dead Weight')
  const unswept     = flagged.filter(s => !sweptSubIds.has(s.id))
  const reclaimable = unswept.reduce((sum, s) => sum + s.monthlyCost, 0)

  // Active = not yet snoozed+invested; saved = money freed by routing
  const activeSubs   = enriched.filter(s => !sweptSubIds.has(s.id))
  const savedMonthly = enriched.filter(s =>  sweptSubIds.has(s.id)).reduce((sum, s) => sum + s.monthlyCost, 0)
  const spend        = activeSubs.reduce((s, e) => s + e.monthlyCost, 0)
  const totalHours   = activeSubs.reduce((s, e) => s + e.totalMinutes / 60, 0)
  const avgCPH       = spend / (totalHours || 1)
  const snoozeCount  = activeSubs.filter(s => s.snooze).length
  const deadCount    = activeSubs.filter(s => s.dead || s.grade?.label === 'Dead Weight').length

  const portfolioStats = useMemo(() => {
    const best = [...enriched].sort((a, b) => b.valueScore - a.valueScore)[0]
    const avg  = enriched.reduce((s, e) => s + e.valueScore, 0) / (enriched.length || 1)
    return {
      avg:      parseFloat(avg.toFixed(3)),
      best:     best?.valueScore ?? 0,
      bestName: best?.name ?? '',
      count:    enriched.length,
    }
  }, [enriched])

  // Category breakdown — computed locally so section always renders even without Java API
  const localCategoryBreakdown = useMemo(() => {
    const total = enriched.reduce((s, e) => s + e.monthlyCost, 0)
    const groups = {}
    enriched.forEach(sub => {
      if (!groups[sub.category]) groups[sub.category] = { category: sub.category, count: 0, totalCost: 0, deadWeightCount: 0 }
      groups[sub.category].count++
      groups[sub.category].totalCost += sub.monthlyCost
      if (sub.dead || valueGrade(sub.normScore).label === 'Dead Weight') groups[sub.category].deadWeightCount++
    })
    return Object.values(groups)
      .map(g => ({ ...g, pctOfTotal: total > 0 ? (g.totalCost / total) * 100 : 0 }))
      .sort((a, b) => b.totalCost - a.totalCost)
  }, [enriched])

  const categoryBreakdown = portfolioData?.categoryBreakdown ?? localCategoryBreakdown

  // Health score computed locally from activeSubs — updates live as subs are snoozed/cancelled
  const localHealth = useMemo(() => {
    if (activeSubs.length === 0) return { healthScore: 100, healthGrade: 'Excellent', healthSummary: 'All subscriptions are handled — great work!', topIssues: [] }

    const totalSpend = activeSubs.reduce((s, e) => s + e.monthlyCost, 0)
    const totalHours = activeSubs.reduce((s, e) => s + e.totalMinutes / 60, 0)
    const avgCPH     = totalHours > 0 ? totalSpend / totalHours : 999

    let score = 100

    // Budget overflow: up to -25
    if (totalSpend > profile.monthlyBudget) {
      const overRatio = (totalSpend - profile.monthlyBudget) / profile.monthlyBudget
      score -= Math.min(25, Math.round(overRatio * 40))
    }

    // Dead weight: -5 per sub, max -20
    const deadCount = activeSubs.filter(s => s.dead || s.grade?.label === 'Dead Weight').length
    score -= Math.min(20, deadCount * 5)

    // Sentinel alerts: -8 per alert, max -16
    const sentinelCount = activeSubs.filter(s =>
      sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
    ).length
    score -= Math.min(16, sentinelCount * 8)

    // Snooze-only (not dead/sentinel): -2 per, max -10
    const snoozeOnly = activeSubs.filter(s =>
      s.snooze && !s.dead && s.grade?.label !== 'Dead Weight'
    ).length
    score -= Math.min(10, snoozeOnly * 2)

    // Avg CPH > 2× threshold: -10
    if (avgCPH > profile.alertThresholdCPH * 2) score -= 10

    score = Math.max(0, score)

    const healthGrade =
      score >= 85 ? 'Excellent' :
      score >= 70 ? 'Good' :
      score >= 50 ? 'Fair' :
      score >= 30 ? 'At Risk' : 'Critical'

    const healthSummary =
      score >= 85 ? 'Your portfolio is in great shape — well-optimized value.' :
      totalSpend > profile.monthlyBudget * 1.5 ? `$${(totalSpend - profile.monthlyBudget).toFixed(0)}/mo over budget — cut dead weight to recover quickly.` :
      deadCount >= 4 ? `${deadCount} subscriptions have zero or near-zero usage — easy wins to cancel.` :
      score < 50 ? 'Several high-cost, low-usage subscriptions are dragging your score.' :
      'A few subscriptions could be trimmed to improve overall value.'

    const topIssues = []
    if (totalSpend > profile.monthlyBudget)
      topIssues.push(`$${(totalSpend - profile.monthlyBudget).toFixed(2)}/mo over budget`)
    if (deadCount > 0)
      topIssues.push(`${deadCount} dead weight subscription${deadCount > 1 ? 's' : ''}`)
    if (sentinelCount > 0)
      topIssues.push(`${sentinelCount} sentinel alert${sentinelCount > 1 ? 's' : ''} active`)
    if (snoozeOnly > 0)
      topIssues.push(`${snoozeOnly} high cost-per-hour subscription${snoozeOnly > 1 ? 's' : ''}`)

    return { healthScore: score, healthGrade, healthSummary, topIssues }
  }, [activeSubs, profile])

  const chartData = [...enriched]
    .sort((a, b) => b.valueScore - a.valueScore)
    .map(s => ({ name: s.name, valueScore: s.valueScore, cph: s.cph === Infinity ? 99 : s.cph, id: s.id }))

  function openDetailById(id) {
    const sub = enriched.find(s => s.id === id)
    if (sub) setDetailSub(sub)
  }

  function openVsByName(name) {
    const sub = enriched.find(s => s.name === name)
    if (sub) setVsTarget(sub)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h2 className="text-3xl font-black font-display gradient-text">Portfolio Overview</h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Tracking {subscriptions.length} subscriptions — click any card for details
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<DollarSign className="w-5 h-5" />}
          label="Active Spend"
          value={<AnimatedNumber value={spend} prefix="$" decimals={2} />}
          sub={savedMonthly > 0 ? `↓ saving $${savedMonthly.toFixed(2)}/mo` : `Budget: $${profile.monthlyBudget}`}
          subGreen={savedMonthly > 0}
          gradient="from-violet-500 to-purple-600"
          pct={(spend / profile.monthlyBudget) * 100}
          delay="0.05s"
          onClick={() => setKpiDetail('spend')}
        />
        <KPICard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Cost / Hour"
          value={<AnimatedNumber value={avgCPH} prefix="$" decimals={2} />}
          sub="across all apps"
          gradient={avgCPH > profile.alertThresholdCPH ? 'from-rose-400 to-pink-500' : 'from-emerald-400 to-teal-500'}
          delay="0.10s"
          onClick={() => setKpiDetail('cph')}
        />
        <KPICard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Snooze Alerts"
          value={<AnimatedNumber value={snoozeCount} />}
          sub={`over $${profile.alertThresholdCPH}/hr threshold`}
          gradient="from-amber-400 to-orange-500"
          delay="0.15s"
          onClick={() => setKpiDetail('snooze')}
        />
        <KPICard
          icon={<Zap className="w-5 h-5" />}
          label="Dead Weight"
          value={<AnimatedNumber value={deadCount} />}
          sub="unused this month"
          gradient="from-rose-400 to-pink-500"
          delay="0.20s"
          onClick={() => setKpiDetail('dead')}
        />
      </div>

      {/* Health score + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger-child" style={{ animationDelay: '0.21s' }}>

        {/* Health Score — always visible, computed locally so it updates live */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold font-display text-gray-600 uppercase tracking-wider">Portfolio Health</span>
            </div>
            <span className="text-[10px] text-violet-400 font-semibold">live</span>
          </div>
          <div className="flex items-end gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 transition-all duration-500"
              style={{
                background: localHealth.healthScore >= 70
                  ? 'linear-gradient(135deg,#10b981,#34d399)'
                  : localHealth.healthScore >= 50
                  ? 'linear-gradient(135deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(135deg,#ef4444,#f97316)',
              }}
            >
              <AnimatedNumber value={localHealth.healthScore} decimals={0} />
            </div>
            <div>
              <p className="font-black font-display text-gray-800">{localHealth.healthGrade}</p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">{localHealth.healthSummary}</p>
            </div>
          </div>
          {localHealth.topIssues.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-gray-100">
              {localHealth.topIssues.slice(0, 3).map((issue, i) => (
                <p key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                  <span className="text-rose-400 shrink-0 mt-0.5">•</span>{issue}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown — always shown, local fallback when API offline */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold font-display text-gray-600 uppercase tracking-wider">Spend by Category</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">click to expand</span>
              {apiSource && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100">
                  <Cpu className="w-2.5 h-2.5" />Java
                </span>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            {categoryBreakdown.map(cat => {
              const isExpanded = expandedCategory === cat.category
              const catSubs = enriched.filter(s => s.category === cat.category)
              return (
                <div key={cat.category}>
                  {/* Clickable row */}
                  <div
                    className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-xl hover:bg-violet-50/50 transition-colors group"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                  >
                    <ChevronRight className={clsx(
                      'w-3.5 h-3.5 text-gray-300 transition-transform duration-200 shrink-0',
                      isExpanded && 'rotate-90 text-violet-400'
                    )} />
                    <span className="text-xs font-semibold text-gray-600 w-20 truncate shrink-0">{cat.category}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, cat.pctOfTotal)}%`,
                          background: cat.deadWeightCount > 0
                            ? 'linear-gradient(90deg,#f97316,#ef4444)'
                            : 'linear-gradient(90deg,#8b5cf6,#a855f7)',
                        }}
                      />
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <span className="font-mono text-xs font-bold text-gray-700">${cat.totalCost.toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{cat.pctOfTotal.toFixed(0)}%</span>
                    </div>
                    {cat.deadWeightCount > 0 && (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100 shrink-0">
                        {cat.deadWeightCount} dead
                      </span>
                    )}
                  </div>

                  {/* Expanded subscription list */}
                  {isExpanded && (
                    <div className="ml-9 mb-1 border-l-2 border-violet-100 pl-3 space-y-0.5">
                      {catSubs.map(sub => {
                        const gradeLabel = valueGrade(sub.normScore).label
                        const isDead  = sub.dead || gradeLabel === 'Dead Weight'
                        return (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-violet-50 transition-colors cursor-pointer group/sub"
                            onClick={() => setDetailSub(sub)}
                          >
                            <span className="text-base shrink-0">{sub.icon}</span>
                            <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{sub.name}</span>
                            <span className="font-mono text-xs text-gray-500 shrink-0">${sub.monthlyCost}/mo</span>
                            <span className={clsx(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0',
                              isDead
                                ? 'bg-rose-50 text-rose-600 border-rose-200'
                                : sub.snooze
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-violet-50 text-violet-600 border-violet-200'
                            )}>
                              {isDead ? 'Dead Weight' : sub.snooze ? 'High CPH' : gradeLabel}
                            </span>
                            <span className="text-[9px] text-violet-400 opacity-0 group-hover/sub:opacity-100 transition-opacity font-medium shrink-0">
                              details →
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Savings routing banner */}
      {unswept.length > 0 && (
        <div
          className="rounded-2xl p-4 flex items-center justify-between gap-4 stagger-child"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(99,102,241,0.06))',
            border: '1px solid rgba(124,58,237,0.2)',
            animationDelay: '0.22s',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 font-display">
                <span className="font-mono text-violet-700">${reclaimable.toFixed(2)}/mo</span> recoverable
              </p>
              <p className="text-xs text-gray-500 truncate">
                {unswept.length} subscription{unswept.length > 1 ? 's' : ''} flagged
              </p>
            </div>
          </div>
          <button
            onClick={() => setSweepTarget(unswept[0])}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            Start Routing
          </button>
        </div>
      )}

      {sweptSubIds.size > 0 && unswept.length === 0 && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3 stagger-child"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <span className="text-lg">✓</span>
          <p className="text-sm text-emerald-700 font-semibold font-display">
            All flagged subscriptions routed to your index portfolio.
          </p>
        </div>
      )}

      {/* Investment teaser — visible when investments exist or dead weight is present */}
      {investments.length > 0 ? (
        <div className="card p-5 stagger-child" style={{ animationDelay: '0.23s' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Portfolio</p>
              <p className="text-xs text-gray-500 font-medium">
                {investments.length} subscription{investments.length > 1 ? 's' : ''} redirected ·{' '}
                <span className="font-mono font-bold text-gray-700">${investments.reduce((s, inv) => s + inv.monthlyCost, 0).toFixed(2)}/mo</span>
              </p>
            </div>
            <Link
              to="/investments"
              className="shrink-0 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              View →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 5, 10].map(years => {
              const monthly = investments.reduce((s, inv) => s + inv.monthlyCost, 0)
              const pv = projectedValue(monthly, years)
              return (
                <div key={years} className="rounded-xl bg-violet-50 border border-violet-100 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">{years}yr</p>
                  <p className="text-sm font-black font-mono text-emerald-600 mt-0.5">
                    ${Math.round(pv).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono">
                    −${Math.round(monthly * 12 * years).toLocaleString()} spent
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : deadCount > 0 ? (
        <div className="card p-5 stagger-child border-rose-100" style={{ animationDelay: '0.23s' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-1">Dead Weight — Investment Potential</p>
              <p className="text-xs text-gray-500 font-medium">
                <span className="font-mono font-bold text-gray-700">${reclaimable.toFixed(2)}/mo</span> redirectable from {deadCount} unused subscription{deadCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 5, 10].map(years => {
              const pv = projectedValue(reclaimable, years)
              return (
                <div key={years} className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{years}yr</p>
                  <p className="text-sm font-black font-mono text-gray-700 mt-0.5">
                    ${Math.round(pv).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono">
                    at 10% avg annual
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Value Score chart — bars are clickable */}
      <div className="card p-6 stagger-child" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h3 className="font-bold font-display text-gray-800">Value Score Ranking</h3>
          <span className="text-[10px] text-violet-400 ml-auto font-semibold cursor-default">click a bar to see how it's calculated ↗</span>
        </div>
        <p className="text-xs text-gray-400 mb-5 font-medium">Hours used ÷ monthly cost — higher is better</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData} layout="vertical" margin={{ left: 0, right: 24 }}
            onClick={(data) => data?.activePayload?.[0] && openVsByName(data.activePayload[0].payload.name)}
          >
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
            <Bar dataKey="valueScore" radius={[0, 8, 8, 0]} style={{ cursor: 'pointer' }}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`url(#bar-grad-${i % BAR_COLORS.length})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subscription grid */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400">
            Active Subscriptions — click to inspect
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch action — dead weight */}
            {(() => {
              const unsweptDead = activeSubs.filter(s => s.dead || s.grade?.label === 'Dead Weight')
              if (unsweptDead.length === 0) return null
              return (
                <button
                  onClick={() => setBatchTarget(unsweptDead)}
                  className="px-3 py-1 rounded-xl text-xs font-semibold font-display border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all duration-150"
                >
                  Handle All Dead Weight ({unsweptDead.length}) · ${unsweptDead.reduce((s, x) => s + x.monthlyCost, 0).toFixed(2)}/mo
                </button>
              )
            })()}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'default',     label: 'Default' },
                { key: 'cph-high',    label: '$/hr ↑' },
                { key: 'cph-low',     label: '$/hr ↓' },
                { key: 'grade-best',  label: 'Grade ↑' },
                { key: 'grade-worst', label: 'Grade ↓' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSubSort(opt.key)}
                  className={clsx(
                    'px-3 py-1 rounded-xl text-xs font-semibold font-display transition-all duration-150',
                    subSort === opt.key
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-gray-400 hover:bg-violet-50 hover:text-violet-500'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active subscriptions — not yet snoozed or invested */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...enriched]
            .filter(sub => !sweptSubIds.has(sub.id))
            .sort((a, b) => {
              const GRADE_ORDER = { 'Excellent': 0, 'Good': 1, 'Fair': 2, 'Poor': 3, 'Dead Weight': 4 }
              const cphA = a.cph < 0 ? Infinity : a.cph
              const cphB = b.cph < 0 ? Infinity : b.cph
              const gradeA = GRADE_ORDER[a.grade?.label ?? a.grade] ?? 4
              const gradeB = GRADE_ORDER[b.grade?.label ?? b.grade] ?? 4
              if (subSort === 'cph-high')    return cphB - cphA
              if (subSort === 'cph-low')     return cphA - cphB
              if (subSort === 'grade-best')  return gradeA - gradeB
              if (subSort === 'grade-worst') return gradeB - gradeA
              return 0
            })
            .map((sub, i) => (
              <SubscriptionCard
                key={sub.id}
                sub={sub}
                index={i}
                swept={false}
                investment={null}
                onSnoozeInvest={setSweepTarget}
                onSnooze={onSnooze}
                onOpenDetail={setDetailSub}
                onVsInspect={setVsTarget}
              />
            ))}
        </div>

        {/* Handled section — snoozed or invested, collapsible */}
        {enriched.some(sub => sweptSubIds.has(sub.id)) && (
          <HandledSection
            subs={enriched.filter(sub => sweptSubIds.has(sub.id))}
            investmentMap={investmentMap}
            onOpenDetail={setDetailSub}
          />
        )}
      </div>

      {/* Routing modal */}
      {sweepTarget && (
        <RoutingModal
          subscription={sweepTarget}
          onClose={() => setSweepTarget(null)}
          onInvest={onInvest}
        />
      )}

      {/* Batch action modal */}
      {batchTarget && (
        <BatchActionModal
          subs={batchTarget}
          onSnooze={onSnooze}
          onInvest={onInvest}
          onClose={() => setBatchTarget(null)}
        />
      )}

      {/* Subscription detail modal */}
      {detailSub && (
        <SubscriptionDetailModal
          sub={detailSub}
          onClose={() => setDetailSub(null)}
          onSnoozeInvest={(sub) => { setDetailSub(null); setSweepTarget(sub) }}
          swept={sweptSubIds.has(detailSub.id)}
          onVsInspect={(sub) => { setDetailSub(null); setVsTarget(sub) }}
        />
      )}

      {/* KPI detail modal */}
      {kpiDetail && (
        <KPIDetailModal
          type={kpiDetail}
          enriched={enriched}
          profile={profile}
          spend={spend}
          avgCPH={avgCPH}
          onClose={() => setKpiDetail(null)}
        />
      )}

      {/* Value Score inspector */}
      {vsTarget && (
        <ValueScoreModal
          sub={vsTarget}
          portfolioStats={portfolioStats}
          onClose={() => setVsTarget(null)}
        />
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, subGreen, gradient, pct, delay, onClick }) {
  return (
    <div
      className="card p-5 stagger-child overflow-hidden relative cursor-pointer hover:scale-[1.02] transition-transform duration-200 active:scale-[0.98]"
      style={{ animationDelay: delay }}
      onClick={onClick}
    >
      <div className={clsx('absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r', gradient)} />
      <div className={clsx(
        'w-9 h-9 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-sm',
        gradient
      )}>
        {icon}
      </div>
      <p className="text-2xl font-black font-mono text-gray-800 tabular-nums">{value}</p>
      <p className="text-xs font-semibold font-display text-gray-500 mt-0.5">{label}</p>
      <p className={clsx('text-[11px] mt-1 font-semibold', subGreen ? 'text-emerald-600' : 'text-gray-400')}>{sub}</p>
      {pct !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', gradient)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
      <p className="absolute bottom-2 right-3 text-[9px] text-gray-300 font-medium">click for details</p>
    </div>
  )
}

// ── Subscription Card ─────────────────────────────────────────────────────────

const GRADE_STYLES = {
  'Excellent':   'badge-emerald',
  'Good':        'badge-sky',
  'Fair':        'badge-amber',
  'Poor':        'badge-rose',
  'Dead Weight': 'badge-rose',
}

function HandledSection({ subs, investmentMap, onOpenDetail }) {
  const [open, setOpen] = useState(true)
  const investedCount = subs.filter(s => investmentMap[s.id]).length
  const snoozedCount  = subs.length - investedCount
  const totalFreed    = subs.reduce((sum, s) => sum + s.monthlyCost, 0)

  return (
    <div className="mt-8 border-t border-violet-100 pt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 mb-4 group"
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={clsx('w-3.5 h-3.5 text-gray-400 transition-transform duration-200 group-hover:text-violet-500', open && 'rotate-90')} />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-violet-500 transition-colors">
            Snoozed &amp; Invested ({subs.length})
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {snoozedCount > 0 && (
            <span className="text-emerald-600 font-semibold">{snoozedCount} snoozed</span>
          )}
          {investedCount > 0 && (
            <span className="text-violet-600 font-semibold">{investedCount} invested</span>
          )}
          <span className="text-gray-400">${totalFreed.toFixed(2)}/mo freed</span>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subs.map(sub => {
            const inv = investmentMap[sub.id]
            return (
              <div
                key={sub.id}
                className="card p-4 opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onOpenDetail(sub)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sub.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold font-display text-gray-600 text-sm truncate line-through">{sub.name}</p>
                    <p className="text-xs text-gray-400">{sub.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-gray-400">${sub.monthlyCost}/mo</p>
                    {inv ? (
                      <span className="badge badge-violet text-[10px] mt-1">
                        {inv.trade.ticker ?? inv.trade.brokerage} ✓
                      </span>
                    ) : (
                      <span className="badge badge-emerald text-[10px] mt-1">Snoozed</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubscriptionCard({ sub, index, swept, investment, onSnoozeInvest, onSnooze, onOpenDetail, onVsInspect }) {
  const [hovered, setHovered] = useState(false)
  const isDead    = sub.dead || sub.grade?.label === 'Dead Weight'
  const flagged   = sub.snooze || isDead
  const ctaAccent = (sub.accentColor === '#ffffff' || sub.accentColor === '#fff') ? '#818cf8' : sub.accentColor

  return (
    <div
      className="card p-5 stagger-child relative overflow-hidden cursor-pointer"
      style={{
        animationDelay: `${0.05 * index}s`,
        boxShadow: hovered ? `0 10px 36px ${sub.accentColor}35` : undefined,
        borderColor: hovered ? `${sub.accentColor}60` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpenDetail(sub)}
    >
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl transition-all duration-300"
        style={{
          background: `linear-gradient(90deg, ${sub.accentColor}, ${sub.accentColor}88)`,
          opacity: hovered ? 1 : 0.6,
        }}
      />
      {/* Hover glow */}
      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none rounded-3xl"
        style={{
          background: `radial-gradient(circle at top left, ${sub.accentColor}18, transparent 70%)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="text-2xl transition-transform duration-300 shrink-0"
            style={{ transform: hovered ? 'scale(1.2) rotate(-5deg)' : 'scale(1)' }}
          >
            {sub.icon}
          </span>
          <div>
            <p className="font-bold font-display text-gray-800 text-sm leading-tight">{sub.name}</p>
            <p className="text-xs text-gray-400">{sub.category} · {sub.tier}</p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="font-mono text-sm font-bold text-gray-700">${sub.monthlyCost}/mo</p>
          {swept ? (
            <span className="badge mt-1 badge-emerald">Invested ✓</span>
          ) : (
            <span className={clsx(
              'badge mt-1',
              sub.dead ? 'badge-rose' : sub.snooze ? 'badge-amber' : GRADE_STYLES[sub.grade?.label] ?? 'badge-violet'
            )}>
              {sub.dead ? 'Dead Weight' : sub.snooze ? 'Snooze?' : sub.grade?.label ?? 'OK'}
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="relative grid grid-cols-3 gap-2 mt-3">
        <Metric
          label="Value Score"
          value={sub.valueScore.toFixed(3)}
          color="text-violet-600"
          onClick={(e) => { e.stopPropagation(); onVsInspect?.(sub) }}
          hint="inspect"
        />
        <Metric
          label="Cost/hr"
          value={sub.cph === Infinity ? '∞' : `$${sub.cph}`}
          color={sub.cph > 15 ? 'text-rose-500' : 'text-emerald-600'}
        />
        <Metric label="Hours/mo" value={(sub.totalMinutes / 60).toFixed(1)} color="text-gray-700" />
      </div>

      {/* Score bar */}
      <div className="mt-3 relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="value-bar" style={{ width: `${sub.normScore}%` }} />
      </div>

      {/* Invest CTA / invested state */}
      {swept && investment ? (
        <div
          className="mt-3 rounded-xl overflow-hidden"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-indigo-100/60">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Invested ✓</span>
            <span className="font-mono text-[10px] font-bold text-indigo-600">{investment.trade.ticker}</span>
          </div>
          <div className="px-3 py-1.5 grid grid-cols-2 gap-x-3 text-[10px]">
            <span className="text-gray-400">Shares</span>
            <span className="font-mono font-bold text-indigo-600 text-right">{investment.trade.fractionalShares}</span>
            <span className="text-gray-400">Trade ID</span>
            <span className="font-mono text-gray-500 text-right truncate">{investment.trade.tradeId?.slice(-8)}</span>
          </div>
        </div>
      ) : swept ? (
        <div
          className="mt-3 py-2 rounded-xl text-xs font-semibold text-center text-emerald-600"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          Routed to index portfolio ✓
        </div>
      ) : isDead ? (
        <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onSnoozeInvest(sub)}
            className="relative flex-1 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 group overflow-hidden active:scale-[0.98]"
            style={{ background: `${ctaAccent}18`, border: `1px solid ${ctaAccent}40`, color: ctaAccent }}
          >
            <span className="relative z-10 flex items-center justify-center gap-1">
              ⚡ &amp; Invest
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: `${ctaAccent}12` }} />
          </button>
        </div>
      ) : flagged ? (
        <button
          onClick={(e) => { e.stopPropagation(); onSnoozeInvest(sub) }}
          className="relative mt-3 w-full py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 group overflow-hidden active:scale-[0.98]"
          style={{ background: `${ctaAccent}18`, border: `1px solid ${ctaAccent}40`, color: ctaAccent }}
        >
          <span className="relative z-10 flex items-center justify-center gap-1.5">
            ⚡ Snooze &amp; Invest ${sub.monthlyCost.toFixed(2)}
          </span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: `${ctaAccent}12` }} />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onSnoozeInvest(sub) }}
          className="relative mt-3 w-full py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group overflow-hidden active:scale-[0.98] text-gray-400 hover:text-indigo-500"
          style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <span className="relative z-10 flex items-center justify-center gap-1.5">
            ↗ Invest ${sub.monthlyCost.toFixed(2)}
          </span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: 'rgba(99,102,241,0.05)' }} />
        </button>
      )}
    </div>
  )
}

function Metric({ label, value, color, onClick, hint }) {
  return (
    <div
      className={clsx(
        'bg-violet-50/70 rounded-xl px-2 py-2 text-center transition-colors relative group',
        onClick ? 'cursor-pointer hover:bg-violet-100 hover:ring-1 hover:ring-violet-300' : 'hover:bg-violet-50'
      )}
      onClick={onClick}
    >
      <p className={clsx('font-mono text-xs font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight font-medium">{label}</p>
      {hint && (
        <span className="absolute -top-1 -right-1 text-[8px] bg-violet-500 text-white px-1 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none">
          {hint}
        </span>
      )}
    </div>
  )
}
