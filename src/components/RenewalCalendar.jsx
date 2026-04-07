import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, AlertCircle, Clock, CheckCircle2, Cpu, TrendingDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fetchUpcomingRenewals } from '../api/subscriptions.js'
import { daysUntilRenewal, isDeadWeight, shouldSnooze, sentinelShouldAlert } from '../utils/calculations.js'
import { userProfile } from '../data/mockData.js'
import RoutingModal from './RoutingModal.jsx'
import clsx from 'clsx'

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY = {
  today:   { label: 'Today',        ring: 'border-rose-400',   bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-700' },
  urgent:  { label: 'Next 2 Days',  ring: 'border-rose-200',   bg: 'bg-rose-50/50',text: 'text-rose-500',   dot: 'bg-rose-400',   badge: 'bg-rose-100 text-rose-600' },
  warning: { label: 'This Week',    ring: 'border-amber-200',  bg: 'bg-amber-50/50',text: 'text-amber-600', dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  normal:  { label: 'This Month',   ring: 'border-gray-100',   bg: 'bg-white',      text: 'text-gray-400',  dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600' },
}

const SECTIONS = ['today', 'urgent', 'warning', 'normal']

// ── Build local renewal events from raw subscriptions (offline fallback) ──────

function buildLocalRenewals(subscriptions) {
  return subscriptions
    .map(sub => {
      const days = daysUntilRenewal(sub.renewalDate)
      if (days < 0 || days > 30) return null
      const urgency = days === 0 ? 'today' : days <= 2 ? 'urgent' : days <= 7 ? 'warning' : 'normal'
      const flagged = isDeadWeight(sub.usageLogs) || shouldSnooze(sub.monthlyCost, sub.totalMinutes, userProfile.alertThresholdCPH) || sentinelShouldAlert(sub.renewalDate, sub.usageLogs, userProfile.sentinelDropThreshold)
      return {
        id: sub.id, name: sub.name, icon: sub.icon, category: sub.category,
        monthlyCost: sub.monthlyCost, accentColor: sub.accentColor,
        renewalDate: sub.renewalDate, daysUntilRenewal: days,
        urgency, isFlagged: flagged,
        sentinelAlert: sentinelShouldAlert(sub.renewalDate, sub.usageLogs, userProfile.sentinelDropThreshold),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
}

// ── RenewalCard ───────────────────────────────────────────────────────────────

function RenewalCard({ event, onInvest, sweptSubIds }) {
  const u = URGENCY[event.urgency] ?? URGENCY.normal
  const accent = (event.accentColor === '#ffffff' || event.accentColor === '#fff') ? '#818cf8' : event.accentColor
  const swept  = sweptSubIds.has(event.id)

  return (
    <div className={clsx(
      'flex items-center gap-4 rounded-2xl p-4 border bg-white transition-all duration-200 hover:shadow-md',
      u.ring, event.isFlagged && !swept ? 'shadow-sm' : ''
    )}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div className={clsx('w-2.5 h-2.5 rounded-full', u.dot)} />
      </div>

      {/* Icon + name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-2xl shrink-0">{event.icon}</span>
        <div className="min-w-0">
          <p className="font-bold font-display text-gray-800 text-sm truncate">{event.name}</p>
          <p className="text-xs text-gray-400 truncate">{event.category}</p>
        </div>
      </div>

      {/* Renewal info */}
      <div className="text-right shrink-0 space-y-1">
        <p className="font-mono text-sm font-black text-gray-800">${event.monthlyCost}/mo</p>
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full inline-block', u.badge)}>
          {event.daysUntilRenewal === 0 ? 'TODAY' : `${event.daysUntilRenewal}d`}
        </span>
      </div>

      {/* Issue + action */}
      {event.isFlagged && !swept && (
        <div className="shrink-0">
          <button
            onClick={() => onInvest(event)}
            className="text-xs font-bold font-display px-3 py-1.5 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95"
            style={{
              background: `${accent}15`,
              border: `1px solid ${accent}35`,
              color: accent,
            }}
          >
            ⚡ Route
          </button>
        </div>
      )}
      {swept && (
        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full shrink-0">
          Invested ✓
        </span>
      )}
    </div>
  )
}

// ── Main RenewalCalendar ──────────────────────────────────────────────────────

export default function RenewalCalendar({ subscriptions, sweptSubIds = new Set(), onInvest }) {
  const [events,     setEvents]     = useState(null)
  const [apiSource,  setApiSource]  = useState(false)
  const [sweepTarget,setSweepTarget]= useState(null)

  useEffect(() => {
    fetchUpcomingRenewals()
      .then(data => { setEvents(data); setApiSource(true) })
      .catch(() => { setEvents(buildLocalRenewals(subscriptions)); setApiSource(false) })
  }, [subscriptions])

  const display = events ?? buildLocalRenewals(subscriptions)

  const grouped = useMemo(() => {
    const map = {}
    for (const s of SECTIONS) map[s] = display.filter(e => e.urgency === s)
    return map
  }, [display])

  const totalThisMonth = display.reduce((s, e) => s + e.monthlyCost, 0)
  const urgentCount    = display.filter(e => e.urgency === 'today' || e.urgency === 'urgent').length
  const flaggedCount   = display.filter(e => e.isFlagged).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black font-display"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Renewal Calendar
            </h2>
          </div>
          {apiSource && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
              <Cpu className="w-3 h-3" /> Java API
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm font-medium ml-[52px]">
          Next 30 days — {display.length} renewal{display.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 stagger-child">
        {[
          { label: 'Due This Month',   value: `$${totalThisMonth.toFixed(2)}`, color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
          { label: 'Urgent (≤2 days)', value: urgentCount,                     color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100' },
          { label: 'Flagged Renewals', value: flaggedCount,                     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={clsx('rounded-2xl p-4 border', bg, border)}>
            <p className={clsx('text-xl font-black font-mono', color)}>{value}</p>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(key => {
        const items = grouped[key] ?? []
        if (items.length === 0) return null
        const u = URGENCY[key]
        const sectionCost = items.reduce((s, e) => s + e.monthlyCost, 0)
        return (
          <div key={key} className="stagger-child">
            <div className="flex items-center gap-2 mb-3">
              <div className={clsx('w-2 h-2 rounded-full', u.dot)} />
              <h3 className={clsx('text-sm font-bold font-display', u.text)}>{u.label}</h3>
              <span className="text-xs text-gray-400 font-mono ml-1">{items.length} sub{items.length !== 1 ? 's' : ''}</span>
              <span className="ml-auto text-xs font-mono font-black text-gray-600">${sectionCost.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              {items.map(event => (
                <RenewalCard
                  key={event.id}
                  event={event}
                  onInvest={setSweepTarget}
                  sweptSubIds={sweptSubIds}
                />
              ))}
            </div>
          </div>
        )
      })}

      {display.length === 0 && (
        <div className="rounded-3xl p-14 text-center stagger-child"
          style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.15)' }}>
          <CheckCircle2 className="w-10 h-10 text-sky-400 mx-auto mb-3" />
          <p className="text-lg font-black font-display text-sky-700">All Clear</p>
          <p className="text-sm text-gray-400 mt-1">No renewals in the next 30 days.</p>
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
