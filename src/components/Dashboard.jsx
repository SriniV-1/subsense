import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import RoutingModal from './RoutingModal.jsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Zap, X, ExternalLink,
} from 'lucide-react'
import {
  calcValueScore, calcCostPerHour, normalizeScores,
  shouldSnooze, isDeadWeight, totalMonthlySpend, valueGrade,
  daysUntilRenewal,
} from '../utils/calculations.js'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

const BAR_COLORS = ['#a855f7','#ec4899','#f97316','#10b981','#0ea5e9','#f59e0b','#6366f1','#14b8a6']

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

function SubscriptionDetailModal({ sub, onClose, onSnoozeInvest, swept }) {
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
              { label: 'Monthly Cost',  value: `$${sub.monthlyCost}/mo`,                    color: 'text-gray-800' },
              { label: 'Value Score',   value: sub.valueScore.toFixed(4),                    color: 'text-violet-600' },
              { label: 'Cost / Hour',   value: sub.cph === Infinity ? '$∞/hr' : `$${sub.cph}/hr`,
                color: sub.cph > 15 ? 'text-rose-500' : 'text-emerald-600' },
              { label: 'Hours / Month', value: `${(sub.totalMinutes / 60).toFixed(1)} hrs`,  color: 'text-gray-700' },
              { label: 'Renews In',     value: days === 0 ? 'Today!' : `${days} days`,
                color: days <= 2 ? 'text-rose-500' : days <= 7 ? 'text-amber-500' : 'text-gray-700' },
              { label: 'Grade',         value: sub.grade?.label ?? 'N/A',
                color: sub.dead ? 'text-rose-500' : sub.snooze ? 'text-amber-500' : 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-violet-50/60 rounded-2xl px-4 py-3">
                <p className={clsx('font-mono text-base font-black', color)}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{label}</p>
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
              {(sub.snooze || sub.dead) ? '⚡ Snooze & Invest' : '↗ Invest'} ${sub.monthlyCost.toFixed(2)}
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

export default function Dashboard({ subscriptions, profile, sweptSubIds = new Set(), investments = [], onInvest }) {
  const normalizedScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])
  const [sweepTarget, setSweepTarget] = useState(null)
  const [detailSub,   setDetailSub]   = useState(null)
  const [kpiDetail,   setKpiDetail]   = useState(null)

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

  const flagged     = enriched.filter(s => s.snooze || s.dead)
  const unswept     = flagged.filter(s => !sweptSubIds.has(s.id))
  const reclaimable = unswept.reduce((sum, s) => sum + s.monthlyCost, 0)

  const spend      = totalMonthlySpend(subscriptions)
  const totalHours = subscriptions.reduce((s, sub) => s + sub.totalMinutes / 60, 0)
  const avgCPH     = spend / (totalHours || 1)
  const snoozeCount = enriched.filter(s => s.snooze).length
  const deadCount   = enriched.filter(s => s.dead).length

  const chartData = [...enriched]
    .sort((a, b) => b.valueScore - a.valueScore)
    .map(s => ({ name: s.name, valueScore: s.valueScore, cph: s.cph === Infinity ? 99 : s.cph, id: s.id }))

  function openDetailById(id) {
    const sub = enriched.find(s => s.id === id)
    if (sub) setDetailSub(sub)
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
          label="Monthly Spend"
          value={<AnimatedNumber value={spend} prefix="$" decimals={2} />}
          sub={`Budget: $${profile.monthlyBudget}`}
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

      {/* Value Score chart — bars are clickable */}
      <div className="card p-6 stagger-child" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h3 className="font-bold font-display text-gray-800">Value Score Ranking</h3>
          <span className="text-[10px] text-gray-400 ml-auto font-medium">click a bar to inspect</span>
        </div>
        <p className="text-xs text-gray-400 mb-5 font-medium">Hours used ÷ monthly cost — higher is better</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData} layout="vertical" margin={{ left: 0, right: 24 }}
            onClick={(data) => data?.activePayload?.[0] && openDetailById(data.activePayload[0].payload.id)}
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
        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">
          All Subscriptions — click to inspect
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enriched.map((sub, i) => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              index={i}
              swept={sweptSubIds.has(sub.id)}
              investment={investmentMap[sub.id]}
              onSnoozeInvest={setSweepTarget}
              onOpenDetail={setDetailSub}
            />
          ))}
        </div>
      </div>

      {/* Routing modal */}
      {sweepTarget && (
        <RoutingModal
          subscription={sweepTarget}
          onClose={() => setSweepTarget(null)}
          onInvest={onInvest}
        />
      )}

      {/* Subscription detail modal */}
      {detailSub && (
        <SubscriptionDetailModal
          sub={detailSub}
          onClose={() => setDetailSub(null)}
          onSnoozeInvest={(sub) => { setDetailSub(null); setSweepTarget(sub) }}
          swept={sweptSubIds.has(detailSub.id)}
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
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, gradient, pct, delay, onClick }) {
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
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
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

function SubscriptionCard({ sub, index, swept, investment, onSnoozeInvest, onOpenDetail }) {
  const [hovered, setHovered] = useState(false)
  const flagged   = sub.snooze || sub.dead
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
        <Metric label="Value Score" value={sub.valueScore.toFixed(3)} color="text-violet-600" />
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

function Metric({ label, value, color }) {
  return (
    <div className="bg-violet-50/70 rounded-xl px-2 py-2 text-center hover:bg-violet-50 transition-colors">
      <p className={clsx('font-mono text-xs font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight font-medium">{label}</p>
    </div>
  )
}
