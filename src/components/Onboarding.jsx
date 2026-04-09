import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { calcCostPerHour, isDeadWeight, valueGrade, normalizeScores } from '../utils/calculations.js'
import clsx from 'clsx'

const STORAGE_KEY = 'subsense_onboarded'

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY)
}

export function markOnboarded() {
  localStorage.setItem(STORAGE_KEY, '1')
}

function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

export default function Onboarding({ subscriptions, profile, onDone }) {
  const [step, setStep] = useState(0)

  const stats = useMemo(() => {
    const scores = normalizeScores(subscriptions)
    const enriched = subscriptions.map((sub, i) => ({
      ...sub,
      normScore: scores[i],
      cph: calcCostPerHour(sub.monthlyCost, sub.totalMinutes),
      dead: isDeadWeight(sub.usageLogs),
      grade: valueGrade(scores[i]),
    }))
    const totalSpend   = enriched.reduce((s, e) => s + e.monthlyCost, 0)
    const deadWeight   = enriched.filter(e => e.dead)
    const reclaimable  = deadWeight.reduce((s, e) => s + e.monthlyCost, 0)
    const highCph      = enriched.filter(e => e.cph !== Infinity && e.cph > profile.alertThresholdCPH)
    const projection   = projectedValue(reclaimable)
    const totalHours   = enriched.reduce((s, e) => s + e.totalMinutes / 60, 0)
    const avgCph       = totalHours > 0 ? totalSpend / totalHours : 0
    const budgetPct    = Math.min(100, (totalSpend / profile.monthlyBudget) * 100).toFixed(0)
    return { totalSpend, deadWeight, reclaimable, highCph, projection, avgCph, budgetPct, enriched }
  }, [subscriptions, profile])

  const steps = [
    {
      label: 'Portfolio',
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black font-mono text-violet-700">${stats.totalSpend.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">monthly spend</p>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black font-mono text-violet-700">{subscriptions.length}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">subscriptions</p>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black font-mono text-violet-700">${stats.avgCph.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">avg cost / hour</p>
            </div>
            <div className={clsx(
              'border rounded-2xl p-4 text-center',
              parseInt(stats.budgetPct) >= 90 ? 'bg-rose-50 border-rose-100' : 'bg-violet-50 border-violet-100'
            )}>
              <p className={clsx(
                'text-3xl font-black font-mono',
                parseInt(stats.budgetPct) >= 90 ? 'text-rose-600' : 'text-violet-700'
              )}>{stats.budgetPct}%</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">of ${profile.monthlyBudget} budget</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Tracking {subscriptions.length} subscriptions totaling ${(stats.totalSpend * 12).toFixed(0)}/yr
          </p>
        </div>
      ),
    },
    {
      label: 'Usage Analysis',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black font-mono text-rose-600">{stats.deadWeight.length}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">dead weight</p>
              <p className="text-[10px] text-gray-400 mt-0.5">zero usage</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black font-mono text-amber-600">{stats.highCph.length}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">high cost/hr</p>
              <p className="text-[10px] text-gray-400 mt-0.5">above ${profile.alertThresholdCPH}/hr</p>
            </div>
          </div>

          {stats.deadWeight.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-gray-600 font-display">Dead Weight</p>
                <p className="text-xs font-mono font-bold text-rose-600">${stats.reclaimable.toFixed(2)}/mo</p>
              </div>
              <div className="space-y-1.5">
                {stats.deadWeight.slice(0, 4).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>{sub.icon}</span>
                      <span className="text-gray-700 font-medium">{sub.name}</span>
                    </span>
                    <span className="font-mono text-gray-500">${sub.monthlyCost}/mo</span>
                  </div>
                ))}
                {stats.deadWeight.length > 4 && (
                  <p className="text-[10px] text-gray-400">+{stats.deadWeight.length - 4} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Investment Potential',
      content: (
        <div className="space-y-4">
          {stats.reclaimable > 0 ? (
            <>
              <div
                className="rounded-2xl p-5 text-center"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(99,102,241,0.04))', border: '1px solid rgba(124,58,237,0.15)' }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-1">Reclaimable monthly</p>
                <p className="text-4xl font-black font-mono text-violet-700">${stats.reclaimable.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">from {stats.deadWeight.length} unused subscription{stats.deadWeight.length > 1 ? 's' : ''}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 5, 10].map(years => {
                  const pv    = projectedValue(stats.reclaimable, years)
                  const spent = stats.reclaimable * 12 * years
                  return (
                    <div key={years} className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">{years}yr</p>
                      <p className="text-base font-black font-mono text-emerald-600">+${Math.round(pv).toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-rose-400 mt-0.5">−${Math.round(spent).toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 text-center">10% avg annual return · compounded monthly</p>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-700 font-bold text-lg">No dead weight found</p>
              <p className="text-gray-400 text-sm mt-1">All subscriptions have active usage.</p>
            </div>
          )}
        </div>
      ),
    },
  ]

  function advance() {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      markOnboarded()
      onDone()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.7)', backdropFilter: 'blur(12px)' }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Gradient top bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

        <div className="p-6 space-y-5">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-violet shrink-0">
              <span className="text-white text-lg">✦</span>
            </div>
            <div>
              <h2 className="font-black font-display gradient-text text-xl leading-none">SubSense</h2>
              <p className="text-[11px] text-gray-400 mt-0.5 font-semibold uppercase tracking-widest">Value Analytics</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={clsx(
                  'flex items-center gap-1.5 text-[11px] font-semibold font-display transition-all duration-200',
                  i === step ? 'text-violet-600' : i < step ? 'text-emerald-500' : 'text-gray-300'
                )}>
                  <div className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-200',
                    i === step ? 'bg-violet-100 text-violet-600' : i < step ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  )}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {s.label}
                </div>
                {i < steps.length - 1 && (
                  <div className={clsx('flex-1 h-px w-4', i < step ? 'bg-emerald-200' : 'bg-gray-100')} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="min-h-[220px]">
            {steps[step].content}
          </div>

          {/* Next button */}
          <button
            onClick={advance}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            {step < steps.length - 1 ? (
              <>Next <ChevronRight className="w-4 h-4" /></>
            ) : (
              'Open Dashboard'
            )}
          </button>

          <p className="text-center text-[10px] text-gray-400">
            {step + 1} of {steps.length}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
