import { useState, useMemo } from 'react'
import {
  Flag, TrendingDown, Zap, CheckCircle2, BellRing,
} from 'lucide-react'
import {
  isDeadWeight, shouldSnooze, sentinelShouldAlert,
  isBingeAndAbandon, calcCostPerHour, daysUntilRenewal,
} from '../utils/calculations.js'
import RoutingModal from './RoutingModal.jsx'
import clsx from 'clsx'

// ── Issue tags ────────────────────────────────────────────────────────────────

function issueTag(type) {
  const map = {
    sentinel:     { label: 'Sentinel Alert',  style: 'bg-rose-100 text-rose-600 border-rose-200' },
    dead:         { label: 'Dead Weight',      style: 'bg-rose-100 text-rose-600 border-rose-200' },
    snooze:       { label: 'High CPH',         style: 'bg-amber-100 text-amber-600 border-amber-200' },
    binge_abandon:{ label: 'Binge & Abandon',  style: 'bg-amber-100 text-amber-600 border-amber-200' },
  }
  return map[type] ?? { label: type, style: 'bg-gray-100 text-gray-500' }
}

// ── Single flagged subscription card ─────────────────────────────────────────

function FlaggedCard({ sub, issues, swept, investment, onInvest, profile }) {
  const [cancelState, setCancelState] = useState('idle')

  const accent        = (sub.accentColor === '#ffffff' || sub.accentColor === '#fff') ? '#818cf8' : sub.accentColor
  const cph           = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const days          = daysUntilRenewal(sub.renewalDate)
  const annualSavings = (sub.monthlyCost * 12).toFixed(0)
  const isSentinel    = issues.includes('sentinel')

  if (cancelState === 'cancelled') {
    return (
      <div className="card overflow-hidden border-emerald-200">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black font-display text-emerald-700">Cancellation Initiated</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {sub.name} will not renew — saves{' '}
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

  if (swept && investment) {
    return (
      <div className="card overflow-hidden border-indigo-200">
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{sub.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold font-display text-gray-700 text-sm">{sub.name}</p>
              <p className="text-xs text-gray-400">{sub.category} · ${sub.monthlyCost}/mo</p>
            </div>
            <span className="badge badge-violet shrink-0">Invested ✓</span>
          </div>
          <div className="bg-indigo-50/70 rounded-2xl p-3 border border-indigo-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Ticker</span>
              <span className="font-mono font-black text-indigo-700">{investment.trade.ticker}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Shares</span>
              <span className="font-mono font-black text-indigo-700">{investment.trade.fractionalShares}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Trade ID</span>
              <span className="font-mono text-gray-500 truncate ml-4">{investment.trade.tradeId}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(
      'card overflow-hidden',
      isSentinel ? 'border-rose-200' : 'border-amber-100'
    )}>
      {/* Accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{sub.icon}</span>
            <div className="min-w-0">
              <p className="font-bold font-display text-gray-800 text-sm">{sub.name}</p>
              <p className="text-xs text-gray-400">{sub.category} · {sub.tier}</p>
            </div>
          </div>
          <p className="font-mono text-sm font-black text-gray-700 shrink-0 ml-2">${sub.monthlyCost}/mo</p>
        </div>

        {/* Issue tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {issues.map(issue => {
            const { label, style } = issueTag(issue)
            return (
              <span key={issue} className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', style)}>
                {label}
              </span>
            )
          })}
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Renews in {days}d
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-violet-50/70 rounded-xl px-2 py-2 text-center">
            <p className="font-mono text-xs font-bold text-gray-700">
              {(sub.totalMinutes / 60).toFixed(1)} hrs
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Hours/mo</p>
          </div>
          <div className={clsx(
            'rounded-xl px-2 py-2 text-center',
            cph === Infinity || cph > (profile?.alertThresholdCPH ?? 15)
              ? 'bg-rose-50/70' : 'bg-violet-50/70'
          )}>
            <p className={clsx(
              'font-mono text-xs font-bold',
              cph === Infinity || cph > (profile?.alertThresholdCPH ?? 15) ? 'text-rose-500' : 'text-gray-700'
            )}>
              {cph === Infinity ? '$∞' : `$${cph}`}/hr
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Cost/hr</p>
          </div>
          <div className="bg-amber-50/70 rounded-xl px-2 py-2 text-center">
            <p className="font-mono text-xs font-bold text-amber-600">${annualSavings}/yr</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">If cancelled</p>
          </div>
        </div>

        {/* Actions */}
        {cancelState === 'confirming' ? (
          <div className="space-y-2">
            <div className="bg-rose-50 rounded-xl px-3 py-2.5 border border-rose-100">
              <p className="text-xs font-bold text-rose-700">Cancel {sub.name}?</p>
              <p className="text-xs text-rose-500 mt-0.5">
                Saves <span className="font-mono font-black">${sub.monthlyCost}/mo</span> ·{' '}
                <span className="font-mono font-black">${annualSavings}/yr</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelState('cancelled')}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold font-display py-2 rounded-xl transition-all active:scale-95"
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
          <div className="flex gap-2">
            <button
              onClick={() => onInvest(sub)}
              className="flex-1 text-xs font-bold font-display py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accent}18, ${accent}10)`,
                border: `1px solid ${accent}40`,
                color: accent,
              }}
            >
              ⚡ Snooze &amp; Invest
            </button>
            <button
              onClick={() => setCancelState('confirming')}
              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold font-display py-2 rounded-xl transition-all hover:-translate-y-0.5"
            >
              Cancel Sub
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main FlaggedView ──────────────────────────────────────────────────────────

export default function FlaggedView({ subscriptions, profile, sweptSubIds = new Set(), investments = [], onInvest }) {
  const [sweepTarget, setSweepTarget] = useState(null)

  const investmentMap = Object.fromEntries(investments.map(inv => [inv.subId, inv]))

  const flagged = useMemo(() => {
    return subscriptions.map(sub => {
      const issues = []
      if (sentinelShouldAlert(sub.renewalDate, sub.usageLogs, profile.sentinelDropThreshold)) issues.push('sentinel')
      if (isDeadWeight(sub.usageLogs)) issues.push('dead')
      if (shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH) && !issues.includes('sentinel')) issues.push('snooze')
      if (isBingeAndAbandon(sub.usageLogs) && !issues.includes('dead')) issues.push('binge_abandon')
      return { ...sub, issues }
    }).filter(sub => sub.issues.length > 0)
  }, [subscriptions, profile])

  const unswept = flagged.filter(sub => !sweptSubIds.has(sub.id) && !sub._cancelled)
  const totalRecoverable = unswept.reduce((sum, s) => sum + s.monthlyCost, 0)
  const sentinelCount = flagged.filter(s => s.issues.includes('sentinel')).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child">
        <h2 className="text-3xl font-black font-display flex items-center gap-2" style={{ color: '#dc2626' }}>
          <Flag className="w-7 h-7 text-rose-500" />
          Flagged Subscriptions
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          {flagged.length} subscription{flagged.length !== 1 ? 's' : ''} need attention
        </p>
      </div>

      {/* Summary banner */}
      {unswept.length > 0 && (
        <div
          className="rounded-2xl p-4 stagger-child"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(245,158,11,0.05))',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-black font-mono text-rose-600">{flagged.length}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Total Flagged</p>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-amber-600">${totalRecoverable.toFixed(2)}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Recoverable / mo</p>
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-violet-600">
                ${(totalRecoverable * 12).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Annual Waste</p>
            </div>
          </div>
        </div>
      )}

      {/* Sentinel alerts first */}
      {sentinelCount > 0 && (
        <div className="stagger-child">
          <div className="flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">Urgent — Renewing Soon</h3>
            <span className="badge badge-rose">{sentinelCount}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged.filter(s => s.issues.includes('sentinel')).map(sub => (
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
      )}

      {/* Dead weight */}
      {flagged.filter(s => s.issues.includes('dead') && !s.issues.includes('sentinel')).length > 0 && (
        <div className="stagger-child">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">Dead Weight — Zero Usage</h3>
            <span className="badge badge-rose">
              {flagged.filter(s => s.issues.includes('dead') && !s.issues.includes('sentinel')).length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged
              .filter(s => s.issues.includes('dead') && !s.issues.includes('sentinel'))
              .map(sub => (
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
      )}

      {/* Snooze / Binge-abandon */}
      {flagged.filter(s => (s.issues.includes('snooze') || s.issues.includes('binge_abandon')) && !s.issues.includes('dead') && !s.issues.includes('sentinel')).length > 0 && (
        <div className="stagger-child">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold font-display text-gray-700">High Cost / Low Value</h3>
            <span className="badge badge-amber">
              {flagged.filter(s => (s.issues.includes('snooze') || s.issues.includes('binge_abandon')) && !s.issues.includes('dead') && !s.issues.includes('sentinel')).length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged
              .filter(s => (s.issues.includes('snooze') || s.issues.includes('binge_abandon')) && !s.issues.includes('dead') && !s.issues.includes('sentinel'))
              .map(sub => (
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
      )}

      {flagged.length === 0 && (
        <div
          className="rounded-3xl p-12 text-center"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-lg font-black font-display text-emerald-700">All Clear!</p>
          <p className="text-sm text-gray-400 mt-1">No subscriptions currently flagged.</p>
        </div>
      )}

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
