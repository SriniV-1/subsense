import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Flag, TrendingDown, Zap, CheckCircle2, BellRing, Clock, DollarSign,
} from 'lucide-react'
import {
  isDeadWeight, shouldSnooze, sentinelShouldAlert,
  isBingeAndAbandon, calcCostPerHour, daysUntilRenewal,
  normalizeScores, valueGrade,
} from '../utils/calculations.js'
import RoutingModal from './RoutingModal.jsx'
import clsx from 'clsx'

// ── Section config ────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: 'sentinel',
    label: 'Renewing Soon',
    icon: BellRing,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
    badge: 'badge-rose',
    borderCard: 'border-rose-200',
    filter: (s) => s.issues.includes('sentinel'),
  },
  {
    key: 'dead',
    label: 'Dead Weight',
    icon: Zap,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
    badge: 'badge-rose',
    borderCard: 'border-rose-100',
    filter: (s) => s.issues.includes('dead') && !s.issues.includes('sentinel'),
  },
  {
    key: 'value',
    label: 'High Cost / Low Value',
    icon: TrendingDown,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    badge: 'badge-amber',
    borderCard: 'border-amber-100',
    filter: (s) =>
      (s.issues.includes('snooze') || s.issues.includes('binge_abandon')) &&
      !s.issues.includes('dead') &&
      !s.issues.includes('sentinel'),
  },
]

// ── Issue badge pill ──────────────────────────────────────────────────────────

const ISSUE_STYLES = {
  sentinel:     'bg-rose-100 text-rose-600 border-rose-200',
  dead:         'bg-rose-100 text-rose-600 border-rose-200',
  snooze:       'bg-amber-100 text-amber-600 border-amber-200',
  binge_abandon:'bg-amber-100 text-amber-600 border-amber-200',
}

const ISSUE_LABELS = {
  sentinel:     'Sentinel Alert',
  dead:         'Dead Weight',
  snooze:       'High CPH',
  binge_abandon:'Binge & Abandon',
}

// ── FlaggedCard ───────────────────────────────────────────────────────────────

function FlaggedCard({ sub, issues, swept, investment, onInvest, profile }) {
  const [cancelState, setCancelState] = useState('idle')

  const accent        = (sub.accentColor === '#ffffff' || sub.accentColor === '#fff') ? '#818cf8' : sub.accentColor
  const cph           = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const days          = daysUntilRenewal(sub.renewalDate)
  const annualSavings = (sub.monthlyCost * 12).toFixed(0)

  // ── Cancelled state ───────────────────────────────────────────────────────
  if (cancelState === 'cancelled') {
    return (
      <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-white">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black font-display text-emerald-700">Cancellation Initiated</p>
            <p className="text-xs text-emerald-600 mt-0.5 truncate">
              Saves <span className="font-mono font-black">${sub.monthlyCost}/mo</span> ·{' '}
              <span className="font-mono font-black">${annualSavings}/yr</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black font-mono text-emerald-600">${sub.monthlyCost}</p>
            <p className="text-[10px] text-emerald-500 font-semibold">saved/mo</p>
          </div>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-xl">{sub.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold font-display text-gray-400 line-through truncate">{sub.name}</p>
            <p className="text-xs text-gray-400">{sub.category}</p>
          </div>
          <span className="badge badge-emerald">Cancelled</span>
        </div>
      </div>
    )
  }

  // ── Invested state ────────────────────────────────────────────────────────
  if (swept && investment) {
    return (
      <div className="rounded-2xl overflow-hidden border border-indigo-200 bg-white">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{sub.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold font-display text-gray-700 text-sm truncate">{sub.name}</p>
              <p className="text-xs text-gray-400">{sub.category} · <span className="font-mono">${sub.monthlyCost}/mo</span></p>
            </div>
            <span className="badge shrink-0" style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.2)' }}>
              Invested ✓
            </span>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-sm font-black text-indigo-700">{investment.trade.ticker}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Ticker</p>
            </div>
            <div>
              <p className="font-mono text-sm font-black text-indigo-700">{investment.trade.fractionalShares}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Shares</p>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-gray-500 truncate">{investment.trade.tradeId?.slice(-8)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Trade ID</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Default (actionable) state ────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }} />
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{sub.icon}</span>
            <div className="min-w-0">
              <p className="font-bold font-display text-gray-800 text-sm leading-tight truncate">{sub.name}</p>
              <p className="text-xs text-gray-400">{sub.category} · {sub.tier}</p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="font-mono text-sm font-black text-gray-800">${sub.monthlyCost}/mo</p>
            <p className="text-[10px] text-gray-400 font-medium">Renews in {days}d</p>
          </div>
        </div>

        {/* Issue pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {issues.map(issue => (
            <span key={issue} className={clsx(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              ISSUE_STYLES[issue] ?? 'bg-gray-100 text-gray-500 border-gray-200'
            )}>
              {ISSUE_LABELS[issue] ?? issue}
            </span>
          ))}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-gray-50 rounded-xl py-2 px-1">
            <p className="font-mono text-xs font-bold text-gray-700">
              {(sub.totalMinutes / 60).toFixed(1)}h
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Hours/mo</p>
          </div>
          <div className={clsx(
            'text-center rounded-xl py-2 px-1',
            cph === Infinity || cph > (profile?.alertThresholdCPH ?? 15) ? 'bg-rose-50' : 'bg-gray-50'
          )}>
            <p className={clsx(
              'font-mono text-xs font-bold',
              cph === Infinity || cph > (profile?.alertThresholdCPH ?? 15) ? 'text-rose-500' : 'text-gray-700'
            )}>
              {cph === Infinity ? '∞' : `$${cph}`}/hr
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Cost/hr</p>
          </div>
          <div className="text-center bg-amber-50 rounded-xl py-2 px-1">
            <p className="font-mono text-xs font-bold text-amber-600">${annualSavings}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Annual waste</p>
          </div>
        </div>

        {/* Action area */}
        {cancelState === 'confirming' ? (
          <div className="space-y-2">
            <div className="bg-rose-50 rounded-xl px-3 py-2.5 border border-rose-100">
              <p className="text-xs font-bold text-rose-700">Cancel {sub.name}?</p>
              <p className="text-xs text-rose-500 mt-0.5">
                Saves <span className="font-mono font-black">${sub.monthlyCost}/mo</span> · <span className="font-mono font-black">${annualSavings}/yr</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelState('cancelled')}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold font-display py-2.5 rounded-xl transition-all active:scale-95"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setCancelState('idle')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold py-2.5 rounded-xl transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onInvest(sub)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold font-display transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
                border: `1px solid ${accent}35`,
                color: accent,
              }}
            >
              ⚡ Invest ${sub.monthlyCost.toFixed(2)}
            </button>
            <button
              onClick={() => setCancelState('confirming')}
              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold font-display py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
            >
              Cancel Sub
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, count, colorClass, bgClass, badgeClass }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={clsx('w-7 h-7 rounded-xl flex items-center justify-center shrink-0', bgClass)}>
        <Icon className={clsx('w-3.5 h-3.5', colorClass)} />
      </div>
      <h3 className="text-sm font-bold font-display text-gray-700 flex-1">{label}</h3>
      <span className={clsx('badge', badgeClass)}>{count}</span>
    </div>
  )
}

// ── Main FlaggedView ──────────────────────────────────────────────────────────

export default function FlaggedView({ subscriptions, profile, sweptSubIds = new Set(), investments = [], onInvest }) {
  const [sweepTarget, setSweepTarget] = useState(null)

  const investmentMap = useMemo(
    () => Object.fromEntries(investments.map(inv => [inv.subId, inv])),
    [investments]
  )

  // Compute normalized scores (same as Dashboard) so grade-based dead weight matches
  const normalizedScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])

  const flagged = useMemo(() => {
    return subscriptions.map((sub, i) => {
      const issues = []
      const grade  = valueGrade(normalizedScores[i])

      if (sentinelShouldAlert(sub.renewalDate, sub.usageLogs, profile.sentinelDropThreshold))
        issues.push('sentinel')

      // Dead weight: either literally zero usage OR grade = "Dead Weight" (low normalized score)
      // This matches the Dashboard badge which shows "Dead Weight" for both cases
      if (isDeadWeight(sub.usageLogs) || grade.label === 'Dead Weight')
        issues.push('dead')

      if (shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH) && !issues.includes('sentinel'))
        issues.push('snooze')

      if (isBingeAndAbandon(sub.usageLogs) && !issues.includes('dead'))
        issues.push('binge_abandon')

      return { ...sub, issues }
    }).filter(sub => sub.issues.length > 0)
  }, [subscriptions, normalizedScores, profile])

  const totalRecoverable = flagged
    .filter(s => !sweptSubIds.has(s.id))
    .reduce((sum, s) => sum + s.monthlyCost, 0)

  return (
    <div className="space-y-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="stagger-child">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-sm">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black font-display" style={{
              background: 'linear-gradient(135deg, #dc2626, #f97316)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Flagged
            </h2>
          </div>
        </div>
        <p className="text-gray-500 text-sm font-medium ml-[52px]">
          {flagged.length} subscription{flagged.length !== 1 ? 's' : ''} need attention
        </p>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      {flagged.length > 0 && (
        <div className="grid grid-cols-3 gap-3 stagger-child">
          {[
            { label: 'Total Flagged',    value: flagged.length,              mono: false, color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100' },
            { label: 'Recoverable / mo', value: `$${totalRecoverable.toFixed(2)}`, mono: true,  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
            { label: 'Annual Waste',     value: `$${(totalRecoverable * 12).toFixed(0)}`, mono: true, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          ].map(({ label, value, mono, color, bg, border }) => (
            <div key={label} className={clsx('rounded-2xl p-4 border', bg, border)}>
              <p className={clsx('text-xl font-black', mono ? 'font-mono' : 'font-display', color)}>{value}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Sections ─────────────────────────────────────────────────────── */}
      {SECTIONS.map(section => {
        const items = flagged.filter(section.filter)
        if (items.length === 0) return null
        return (
          <div key={section.key} className="stagger-child">
            <SectionHeader
              icon={section.icon}
              label={section.label}
              count={items.length}
              colorClass={section.color}
              bgClass={section.bg}
              badgeClass={section.badge}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(sub => (
                <FlaggedCard
                  key={sub.id}
                  sub={sub}
                  issues={sub.issues}
                  swept={sweptSubIds.has(sub.id)}
                  investment={investmentMap[sub.id]}
                  onInvest={setSweepTarget}
                  profile={profile}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {flagged.length === 0 && (
        <div
          className="rounded-3xl p-14 text-center stagger-child"
          style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="text-lg font-black font-display text-emerald-700">All Clear</p>
          <p className="text-sm text-gray-400 mt-1">No subscriptions currently flagged.</p>
        </div>
      )}

      {/* ── Routing modal (portal-rendered) ──────────────────────────────── */}
      {sweepTarget && (
        <RoutingModal
          subscription={sweepTarget}
          onClose={() => setSweepTarget(null)}
          onInvest={(sub, trade) => { onInvest(sub, trade); setSweepTarget(null) }}
        />
      )}
    </div>
  )
}
