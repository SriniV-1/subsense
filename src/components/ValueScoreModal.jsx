import { createPortal } from 'react-dom'
import { X, TrendingUp, Info } from 'lucide-react'
import clsx from 'clsx'

// ── Grade colour map ──────────────────────────────────────────────────────────

const GRADE_STYLE = {
  'Excellent':   { bar: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  'Good':        { bar: '#0ea5e9', text: 'text-sky-600',     bg: 'bg-sky-50 border-sky-200' },
  'Fair':        { bar: '#f59e0b', text: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  'Poor':        { bar: '#f97316', text: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  'Very Poor':   { bar: '#ef4444', text: 'text-rose-600',    bg: 'bg-rose-50 border-rose-200' },
}

// ── Calculation step ──────────────────────────────────────────────────────────

function Step({ n, label, value, highlight }) {
  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-xl', highlight ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50')}>
      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <p className={clsx('font-mono text-sm font-black mt-0.5', highlight ? 'text-violet-700' : 'text-gray-800')}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

/**
 * ValueScoreModal
 *
 * Props:
 *   sub          — { name, icon, totalMinutes, monthlyCost, valueScore, normScore, grade }
 *   portfolioStats — { avg, best, bestName, count }   (optional — omit when offline)
 *   onClose      — () => void
 */
export default function ValueScoreModal({ sub, portfolioStats, onClose }) {
  if (!sub) return null

  const hours     = sub.totalMinutes / 60
  const computed  = hours > 0 ? (hours / sub.monthlyCost).toFixed(4) : '0.0000'
  // grade may arrive as a string ('Excellent') or as an object {label, color} from enriched
  const grade     = (typeof sub.grade === 'object' ? sub.grade?.label : sub.grade) ?? 'N/A'
  const gs        = GRADE_STYLE[grade] ?? GRADE_STYLE['Poor']
  const normScore = sub.normScore ?? 0

  // Rank estimate: normScore 100 → #1, use portfolio count if available
  const rankLabel = portfolioStats
    ? `#${Math.max(1, Math.round(((100 - normScore) / 100) * portfolioStats.count))} of ${portfolioStats.count}`
    : `${normScore}/100`

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-black font-display text-gray-800 text-lg leading-tight">Value Score</h2>
                <p className="text-xs text-gray-400 mt-0.5">How efficiently are you using this?</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formula box */}
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.04))', border: '1px solid rgba(139,92,246,0.15)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">Formula</p>
            <p className="font-mono text-sm text-gray-600">
              Value Score{' '}
              <span className="text-gray-400">=</span>{' '}
              <span className="text-violet-700 font-black">Total Hours Used</span>{' '}
              <span className="text-gray-400">÷</span>{' '}
              <span className="text-pink-600 font-black">Monthly Cost</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              Higher = more hours per dollar · lower cost-per-hour is better
            </p>
          </div>

          {/* Subscription identity */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-3xl">{sub.icon}</span>
            <div>
              <p className="font-black font-display text-gray-800">{sub.name}</p>
              <p className="text-xs text-gray-400">${sub.monthlyCost}/mo</p>
            </div>
            <span className={clsx('ml-auto badge border', gs.bg, gs.text)}>{grade}</span>
          </div>

          {/* Step-by-step breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">Calculation Breakdown</p>
            <Step n="1" label="Total minutes used (last 30 days)"
              value={`${sub.totalMinutes.toLocaleString()} min`} />
            <Step n="2" label="Convert to hours"
              value={`${sub.totalMinutes.toLocaleString()} ÷ 60 = ${hours.toFixed(2)} hrs`} />
            <Step n="3" label="Divide by monthly cost"
              value={`${hours.toFixed(2)} hrs ÷ $${sub.monthlyCost} = ${computed}`}
              highlight />
          </div>

          {/* Score bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500 font-medium">Portfolio position</span>
              <span className={clsx('font-black font-mono', gs.text)}>{normScore}/100</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${normScore}%`, background: gs.bar }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0 — worst</span>
              <span>100 — best</span>
            </div>
          </div>

          {/* Portfolio context */}
          {portfolioStats && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'This Sub',      value: (sub.valueScore ?? computed), mono: true, color: gs.text },
                { label: 'Portfolio Avg', value: portfolioStats.avg.toFixed(3),  mono: true, color: 'text-gray-600' },
                { label: 'Best',          value: portfolioStats.best.toFixed(3), mono: true, color: 'text-emerald-600',
                  sub: portfolioStats.bestName },
              ].map(({ label, value, mono, color, sub: subLabel }) => (
                <div key={label} className="bg-gray-50 rounded-2xl px-3 py-2.5 text-center">
                  <p className={clsx('text-sm font-black', mono ? 'font-mono' : 'font-display', color)}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                  {subLabel && <p className="text-[9px] text-gray-400 truncate">{subLabel}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Rank */}
          <div className="flex items-center gap-2 bg-violet-50 rounded-2xl px-4 py-3 border border-violet-100">
            <Info className="w-4 h-4 text-violet-400 shrink-0" />
            <p className="text-xs text-violet-600 font-medium">
              {sub.name} ranks{' '}
              <span className="font-black">{rankLabel}</span>
              {' '}in your portfolio.{' '}
              {normScore >= 60
                ? 'This is a high-value subscription.'
                : normScore >= 30
                ? 'Room to improve — use it more or negotiate a lower rate.'
                : 'Low value — consider cancelling or replacing.'}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
