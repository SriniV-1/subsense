import { useState, useMemo } from 'react'
import { ArrowLeftRight, Trash2, ShoppingBag, TrendingDown, CheckCircle2, Trophy } from 'lucide-react'
import { isDeadWeight, calcCostPerHour, calcValueScore, normalizeScores } from '../utils/calculations.js'
import { swapOptions } from '../data/mockData.js'
import clsx from 'clsx'

/** Count consecutive days from the end with zero minutes. */
function daysSinceLastUse(usageLogs) {
  for (let i = usageLogs.length - 1; i >= 0; i--) {
    if (usageLogs[i].minutes > 0) return usageLogs.length - 1 - i
  }
  return usageLogs.length
}

function DeadWeightCard({ sub, selected, setSelected }) {
  const cph = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const isSelected = selected?.id === sub.id
  const idleDays = daysSinceLastUse(sub.usageLogs)

  // Build a human-readable "could buy" teaser for the top swap option
  const topSwap = swapOptions[0]
  const topUnits = Math.floor(sub.monthlyCost / topSwap.unitCost)
  const secondSwap = swapOptions[1]
  const secondUnits = Math.floor(sub.monthlyCost / secondSwap.unitCost)

  return (
    <button
      onClick={() => setSelected(isSelected ? null : sub)}
      className={clsx(
        'w-full card p-4 text-left transition-all duration-200 hover:border-red-800/60',
        isSelected ? 'border-red-500/50 bg-red-950/20 shadow-[0_0_20px_-8px] shadow-red-500/30' : ''
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{sub.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-200">{sub.name}</p>
            <span className="badge bg-red-500/15 text-red-400">Dead Weight</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {sub.category} · {sub.tier}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-base font-bold text-red-400">${sub.monthlyCost}/mo</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ${cph === Infinity ? '∞' : cph}/hr · 0 hrs used
          </p>
        </div>
      </div>

      {/* Idle days + opportunity cost teaser */}
      <div className="mt-3 bg-red-950/20 rounded-xl px-3 py-2 border border-red-900/30">
        <p className="text-xs text-red-300/90">
          <span className="font-semibold">You haven't opened this app in {idleDays} day{idleDays !== 1 ? 's' : ''}.</span>{' '}
          That <span className="font-mono font-bold">${sub.monthlyCost}</span> could cover{' '}
          <span className="text-amber-300 font-medium">
            {topUnits} {topSwap.icon} {topSwap.name.toLowerCase()}
          </span>{' '}
          or{' '}
          <span className="text-amber-300 font-medium">
            {secondUnits} {secondSwap.icon} {secondSwap.name.toLowerCase()}s
          </span>.
        </p>
      </div>

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-red-900/40">
          <p className="text-xs text-red-400/80">
            Select a swap below to see what your ${sub.monthlyCost}/mo could buy instead.
          </p>
        </div>
      )}
    </button>
  )
}

function SwapOptionCard({ option, sub, onConfirm }) {
  const units = Math.floor(sub.monthlyCost / option.unitCost)
  const leftover = (sub.monthlyCost - units * option.unitCost).toFixed(2)

  return (
    <div className="card p-4 hover:border-emerald-800/50 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{option.icon}</span>
          <div>
            <p className="font-semibold text-slate-200 text-sm">{option.name}</p>
            <p className="text-xs text-slate-500">{option.category} · ${option.unitCost}/unit</p>
          </div>
        </div>
        <button
          onClick={() => onConfirm(option)}
          className="btn-primary text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Swap
        </button>
      </div>

      {/* Conversion visual */}
      <div className="bg-slate-800/60 rounded-xl p-3 mt-2">
        <p className="text-xs text-slate-400 mb-2">Your ${sub.monthlyCost}/mo {sub.name} could buy:</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Array.from({ length: Math.min(units, 12) }).map((_, i) => (
            <span key={i} className="text-lg animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
              {option.icon}
            </span>
          ))}
          {units > 12 && (
            <span className="text-xs text-slate-500 self-center">+{units - 12} more</span>
          )}
        </div>
        <p className="text-sm font-semibold text-emerald-400">
          {units}× {option.name}
        </p>
        {leftover > 0 && (
          <p className="text-xs text-slate-500 mt-0.5">+ ${leftover} left over</p>
        )}
      </div>
    </div>
  )
}

function ConfirmSwap({ sub, option, onClose }) {
  const units = Math.floor(sub.monthlyCost / option.unitCost)
  const annualSavings = sub.monthlyCost * 12

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card-glow max-w-md w-full p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">Swap Confirmed</h3>
            <p className="text-xs text-slate-400">This would free up ${sub.monthlyCost}/mo</p>
          </div>
        </div>

        {/* Visual swap */}
        <div className="flex items-center gap-4 bg-slate-800/60 rounded-xl p-4 mb-5">
          <div className="flex-1 text-center">
            <span className="text-3xl block">{sub.icon}</span>
            <p className="text-xs font-semibold text-slate-300 mt-1">{sub.name}</p>
            <p className="text-xs text-red-400 font-mono">${sub.monthlyCost}/mo</p>
          </div>
          <ArrowLeftRight className="w-5 h-5 text-violet-400 shrink-0" />
          <div className="flex-1 text-center">
            <span className="text-3xl block">{option.icon}</span>
            <p className="text-xs font-semibold text-slate-300 mt-1">{units}× {option.name}</p>
            <p className="text-xs text-emerald-400 font-mono">${(units * option.unitCost).toFixed(2)} value</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-emerald-400">${sub.monthlyCost}/mo</p>
            <p className="text-xs text-slate-500">Monthly savings</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-emerald-400">${annualSavings.toFixed(0)}/yr</p>
            <p className="text-xs text-slate-500">Annual savings</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-5 text-center">
          In a real app, this would initiate cancellation through {sub.name}'s API
          and redirect you to purchase {option.name}.
        </p>

        <button onClick={onClose} className="btn-primary w-full">
          Close
        </button>
      </div>
    </div>
  )
}

export default function SwapCalculator({ subscriptions }) {
  const [selectedSub, setSelectedSub] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const deadWeight = useMemo(
    () => subscriptions.filter((s) => isDeadWeight(s.usageLogs)),
    [subscriptions]
  )

  const lowValue = useMemo(
    () =>
      subscriptions.filter(
        (s) => !isDeadWeight(s.usageLogs) && calcCostPerHour(s.monthlyCost, s.totalMinutes) > 20
      ),
    [subscriptions]
  )

  const totalDeadSpend = deadWeight.reduce((s, sub) => s + sub.monthlyCost, 0)

  // Value Score ranking for all subs
  const normScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])
  const ranked = useMemo(
    () =>
      subscriptions
        .map((s, i) => ({
          ...s,
          valueScore: calcValueScore(s.totalMinutes, s.monthlyCost),
          normScore: normScores[i],
          cph: calcCostPerHour(s.monthlyCost, s.totalMinutes),
          dead: isDeadWeight(s.usageLogs),
        }))
        .sort((a, b) => b.valueScore - a.valueScore),
    [subscriptions, normScores]
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-cyan-400" />
          Subscription Swap Calculator
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Identify dead weight and convert wasted spend into real value
        </p>
      </div>

      {/* Dead spend banner */}
      {totalDeadSpend > 0 && (
        <div className="bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-900/40 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-200">
              You're burning{' '}
              <span className="text-red-400 font-mono">${totalDeadSpend.toFixed(2)}/mo</span> on
              unused subscriptions
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              That's{' '}
              <span className="text-amber-400 font-semibold">
                ${(totalDeadSpend * 12).toFixed(0)}/year
              </span>{' '}
              going to waste. Click a subscription below to find a swap.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">{deadWeight.length} subscriptions</p>
            <p className="text-xs text-slate-500">unused ≥ 30 days</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Dead weight list */}
        <div className="space-y-4">
          {/* Dead Weight */}
          {deadWeight.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-slate-300">Dead Weight</h3>
                <span className="badge bg-red-500/15 text-red-400">{deadWeight.length}</span>
              </div>
              <div className="space-y-2">
                {deadWeight.map((sub) => (
                  <DeadWeightCard
                    key={sub.id}
                    sub={sub}
                    selected={selectedSub}
                    setSelected={setSelectedSub}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Low Value (high CPH but some usage) */}
          {lowValue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">Low Value</h3>
                <span className="badge bg-amber-500/15 text-amber-400">{lowValue.length}</span>
              </div>
              <div className="space-y-2">
                {lowValue.map((sub) => (
                  <DeadWeightCard
                    key={sub.id}
                    sub={sub}
                    selected={selectedSub}
                    setSelected={setSelectedSub}
                  />
                ))}
              </div>
            </div>
          )}

          {deadWeight.length === 0 && lowValue.length === 0 && (
            <div className="card p-8 text-center">
              <span className="text-4xl">🏆</span>
              <p className="text-slate-300 font-medium mt-3">All subscriptions active!</p>
              <p className="text-slate-500 text-sm mt-1">No dead weight detected.</p>
            </div>
          )}
        </div>

        {/* Right: Swap options */}
        <div>
          {selectedSub ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-300">
                  Swap{' '}
                  <span className="text-emerald-400">
                    {selectedSub.name}
                  </span>{' '}
                  for...
                </h3>
              </div>
              <div className="space-y-3">
                {swapOptions.map((opt) => (
                  <SwapOptionCard
                    key={opt.id}
                    option={opt}
                    sub={selectedSub}
                    onConfirm={(o) => setConfirming({ sub: selectedSub, option: o })}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="card p-8 text-center h-full flex flex-col items-center justify-center min-h-[300px]">
              <ArrowLeftRight className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">Select a subscription</p>
              <p className="text-slate-600 text-sm mt-1">
                Click on a dead-weight sub to see swap options
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Value Score Leaderboard */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-300">Value Score Ranking</h3>
          <span className="text-xs text-slate-500 ml-auto">higher = better ROI</span>
        </div>
        <div className="space-y-2">
          {ranked.map((sub, idx) => (
            <div key={sub.id} className="flex items-center gap-3">
              <span className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                idx === 1 ? 'bg-slate-500/20 text-slate-300' :
                idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                'bg-slate-800 text-slate-500'
              )}>
                {idx + 1}
              </span>
              <span className="text-base shrink-0">{sub.icon}</span>
              <span className="flex-1 text-sm text-slate-300 truncate">{sub.name}</span>
              {/* Score bar */}
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-700',
                    sub.dead ? 'bg-red-600' : sub.normScore >= 60 ? 'bg-emerald-500' : sub.normScore >= 30 ? 'bg-amber-500' : 'bg-red-600'
                  )}
                  style={{ width: `${sub.normScore}%` }}
                />
              </div>
              <span className={clsx('font-mono text-xs font-bold w-14 text-right shrink-0',
                sub.dead ? 'text-red-400' : sub.normScore >= 60 ? 'text-emerald-400' : sub.normScore >= 30 ? 'text-amber-400' : 'text-red-400'
              )}>
                {sub.valueScore.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-500 w-16 text-right shrink-0">
                ${sub.cph === Infinity ? '∞' : sub.cph}/hr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <ConfirmSwap
          sub={confirming.sub}
          option={confirming.option}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
