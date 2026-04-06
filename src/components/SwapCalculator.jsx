import { useState, useMemo } from 'react'
import { ArrowLeftRight, Trash2, ShoppingBag, TrendingDown, CheckCircle2, Trophy } from 'lucide-react'
import {
  isDeadWeight, calcCostPerHour, calcValueScore, normalizeScores,
} from '../utils/calculations.js'
import { swapOptions } from '../data/mockData.js'
import clsx from 'clsx'

function daysSinceLastUse(usageLogs) {
  for (let i = usageLogs.length - 1; i >= 0; i--) {
    if (usageLogs[i].minutes > 0) return usageLogs.length - 1 - i
  }
  return usageLogs.length
}

function DeadWeightCard({ sub, selected, setSelected }) {
  const isSelected = selected?.id === sub.id
  const cph        = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
  const idleDays   = daysSinceLastUse(sub.usageLogs)
  const topSwap    = swapOptions[0]
  const topUnits   = Math.floor(sub.monthlyCost / topSwap.unitCost)
  const secondSwap = swapOptions[1]
  const secondUnits= Math.floor(sub.monthlyCost / secondSwap.unitCost)

  return (
    <button
      onClick={() => setSelected(isSelected ? null : sub)}
      className={clsx(
        'w-full card p-4 text-left transition-all duration-300',
        isSelected
          ? 'border-rose-300 shadow-rose'
          : 'hover:border-rose-200'
      )}
    >
      <div className="flex items-center gap-3">
        <span className={clsx('text-2xl transition-transform duration-300', isSelected && 'scale-125 -rotate-6')}>
          {sub.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold font-display text-gray-800">{sub.name}</p>
            <span className="badge badge-rose">Dead Weight</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{sub.category} · {sub.tier}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-base font-black text-rose-500">${sub.monthlyCost}/mo</p>
          <p className="text-[11px] text-gray-400 mt-0.5">${cph === Infinity ? '∞' : cph}/hr</p>
        </div>
      </div>

      {/* Opportunity cost message */}
      <div className="mt-3 bg-rose-50 rounded-2xl px-3 py-2.5 border border-rose-100">
        <p className="text-xs text-rose-600">
          <span className="font-bold">You haven't opened this app in {idleDays} day{idleDays !== 1 ? 's' : ''}.</span>{' '}
          That <span className="font-mono font-black">${sub.monthlyCost}</span> could cover{' '}
          <span className="font-semibold text-rose-700">{topUnits} {topSwap.icon} {topSwap.name.toLowerCase()}</span>{' '}
          or{' '}
          <span className="font-semibold text-rose-700">{secondUnits} {secondSwap.icon} {secondSwap.name.toLowerCase()}s</span>.
        </p>
      </div>
    </button>
  )
}

function SwapOptionCard({ option, sub, onConfirm }) {
  const [hovered, setHovered] = useState(false)
  const units    = Math.floor(sub.monthlyCost / option.unitCost)
  const leftover = (sub.monthlyCost - units * option.unitCost).toFixed(2)

  const categoryColor = {
    Transport: 'bg-sky-100 text-sky-700',
    Food:      'bg-orange-100 text-orange-700',
    Education: 'bg-violet-100 text-violet-700',
    Health:    'bg-emerald-100 text-emerald-700',
  }[option.category] ?? 'bg-gray-100 text-gray-600'

  return (
    <div
      className={clsx(
        'card p-4 transition-all duration-300 cursor-pointer',
        hovered && 'border-emerald-200 shadow-emerald'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="text-2xl transition-transform duration-300"
            style={{ transform: hovered ? 'scale(1.25) rotate(-8deg)' : 'scale(1)' }}
          >
            {option.icon}
          </span>
          <div>
            <p className="font-bold font-display text-gray-800 text-sm">{option.name}</p>
            <span className={clsx('badge text-[10px] mt-0.5', categoryColor)}>{option.category}</span>
          </div>
        </div>
        <button
          onClick={() => onConfirm(option)}
          className={clsx(
            'btn-primary text-xs py-1.5 px-3 transition-all duration-200',
            hovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
          )}
        >
          Swap
        </button>
      </div>

      {/* Conversion visual */}
      <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
        <p className="text-xs text-gray-500 mb-2 font-medium">
          Your ${sub.monthlyCost}/mo {sub.name} could buy:
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Array.from({ length: Math.min(units, 12) }).map((_, i) => (
            <span
              key={i}
              className="text-lg"
              style={{
                animation: `bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`,
              }}
            >
              {option.icon}
            </span>
          ))}
          {units > 12 && <span className="text-xs text-gray-400 self-center font-semibold">+{units - 12} more</span>}
        </div>
        <p className="text-sm font-black font-display text-emerald-600">
          {units}× {option.name}
        </p>
        {leftover > 0 && <p className="text-xs text-gray-400 mt-0.5 font-medium">+ ${leftover} left over</p>}
      </div>
    </div>
  )
}

function ConfirmSwap({ sub, option, onClose }) {
  const units        = Math.floor(sub.monthlyCost / option.unitCost)
  const annualSavings= sub.monthlyCost * 12

  return (
    <div className="fixed inset-0 bg-violet-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card-glow max-w-md w-full p-6 animate-spring-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-emerald">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-black font-display text-gray-800 text-lg">Swap Confirmed! 🎉</h3>
            <p className="text-xs text-gray-400">This frees up ${sub.monthlyCost}/mo</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-violet-50 rounded-2xl p-4 mb-5 border border-violet-100">
          <div className="flex-1 text-center">
            <span className="text-3xl block">{sub.icon}</span>
            <p className="text-xs font-bold font-display text-gray-700 mt-1">{sub.name}</p>
            <p className="text-xs text-rose-500 font-mono font-bold">${sub.monthlyCost}/mo</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowLeftRight className="w-5 h-5 text-violet-400" />
            <span className="text-[10px] text-gray-400 font-semibold">becomes</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-3xl block">{option.icon}</span>
            <p className="text-xs font-bold font-display text-gray-700 mt-1">{units}× {option.name}</p>
            <p className="text-xs text-emerald-600 font-mono font-bold">${(units * option.unitCost).toFixed(2)} value</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { val: `$${sub.monthlyCost}/mo`, label: 'Monthly savings' },
            { val: `$${annualSavings.toFixed(0)}/yr`, label: 'Annual savings' },
          ].map(({ val, label }) => (
            <div key={label} className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
              <p className="text-lg font-black font-mono text-emerald-600">{val}</p>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-5 text-center leading-relaxed">
          In a real app this would initiate cancellation via {sub.name}'s API ✨
        </p>
        <button onClick={onClose} className="btn-primary w-full">Close</button>
      </div>
    </div>
  )
}

export default function SwapCalculator({ subscriptions }) {
  const [selectedSub, setSelectedSub] = useState(null)
  const [confirming,  setConfirming]  = useState(null)

  const deadWeight = useMemo(
    () => subscriptions.filter((s) => isDeadWeight(s.usageLogs)),
    [subscriptions]
  )
  const lowValue = useMemo(
    () => subscriptions.filter(
      (s) => !isDeadWeight(s.usageLogs) && calcCostPerHour(s.monthlyCost, s.totalMinutes) > 20
    ),
    [subscriptions]
  )
  const totalDeadSpend = deadWeight.reduce((s, sub) => s + sub.monthlyCost, 0)

  // Value Score ranking
  const normScores = useMemo(() => normalizeScores(subscriptions), [subscriptions])
  const ranked = useMemo(
    () => subscriptions
      .map((s, i) => ({
        ...s,
        valueScore: calcValueScore(s.totalMinutes, s.monthlyCost),
        normScore:  normScores[i],
        cph:        calcCostPerHour(s.monthlyCost, s.totalMinutes),
        dead:       isDeadWeight(s.usageLogs),
      }))
      .sort((a, b) => b.valueScore - a.valueScore),
    [subscriptions, normScores]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child">
        <h2 className="text-3xl font-black font-display gradient-text flex items-center gap-2">
          <ArrowLeftRight className="w-7 h-7 text-emerald-500" />
          Swap Calculator
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Convert dead weight into things you actually care about 💸
        </p>
      </div>

      {/* Dead spend banner */}
      {totalDeadSpend > 0 && (
        <div className="card stagger-child p-5 border-rose-200 bg-gradient-to-r from-rose-50 to-white" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shrink-0 shadow-rose">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold font-display text-gray-800">
                You're burning{' '}
                <span className="text-rose-500 font-mono">${totalDeadSpend.toFixed(2)}/mo</span>{' '}
                on unused subscriptions 🔥
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                That's{' '}
                <span className="text-amber-600 font-bold">${(totalDeadSpend * 12).toFixed(0)}/year</span>{' '}
                going to waste. Pick one below to swap it out.
              </p>
            </div>
            <div className="text-right shrink-0 text-xs text-gray-400 font-medium">
              <p>{deadWeight.length} subscriptions</p>
              <p>unused ≥ 30 days</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: dead weight list */}
        <div className="space-y-4">
          {deadWeight.length > 0 && (
            <div className="stagger-child" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold font-display text-gray-700">Dead Weight</h3>
                <span className="badge badge-rose">{deadWeight.length}</span>
              </div>
              <div className="space-y-3">
                {deadWeight.map((sub) => (
                  <DeadWeightCard key={sub.id} sub={sub} selected={selectedSub} setSelected={setSelectedSub} />
                ))}
              </div>
            </div>
          )}

          {lowValue.length > 0 && (
            <div className="stagger-child" style={{ animationDelay: '0.20s' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold font-display text-gray-700">Low Value</h3>
                <span className="badge badge-amber">{lowValue.length}</span>
              </div>
              <div className="space-y-3">
                {lowValue.map((sub) => (
                  <DeadWeightCard key={sub.id} sub={sub} selected={selectedSub} setSelected={setSelectedSub} />
                ))}
              </div>
            </div>
          )}

          {deadWeight.length === 0 && lowValue.length === 0 && (
            <div className="card p-10 text-center stagger-child">
              <span className="text-5xl block mb-3">🏆</span>
              <p className="font-bold font-display text-gray-700">All subscriptions active!</p>
              <p className="text-gray-400 text-sm mt-1">No dead weight detected. Nice work!</p>
            </div>
          )}
        </div>

        {/* Right: swap options */}
        <div className="stagger-child" style={{ animationDelay: '0.25s' }}>
          {selectedSub ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold font-display text-gray-700">
                  Swap <span className="text-emerald-600">{selectedSub.name}</span> for...
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
            <div className="card p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
              <span className="text-5xl block mb-3">👆</span>
              <p className="font-bold font-display text-gray-600">Select a subscription</p>
              <p className="text-gray-400 text-sm mt-1">Click a dead-weight sub to see swap options</p>
            </div>
          )}
        </div>
      </div>

      {/* Value Score Leaderboard */}
      <div className="card p-5 stagger-child" style={{ animationDelay: '0.30s' }}>
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold font-display text-gray-800">Value Score Ranking</h3>
          <span className="text-xs text-gray-400 ml-auto font-medium">higher = better ROI</span>
        </div>
        <div className="space-y-3">
          {ranked.map((sub, idx) => (
            <div key={sub.id} className="flex items-center gap-3 group">
              <span className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-transform duration-200 group-hover:scale-110',
                idx === 0 ? 'bg-amber-100 text-amber-600' :
                idx === 1 ? 'bg-gray-100 text-gray-500' :
                idx === 2 ? 'bg-orange-100 text-orange-500' :
                'bg-violet-50 text-violet-400'
              )}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </span>
              <span className="text-xl shrink-0 transition-transform duration-200 group-hover:scale-110">{sub.icon}</span>
              <span className="flex-1 text-sm font-semibold font-display text-gray-700 truncate">{sub.name}</span>
              <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-700',
                    sub.dead ? 'bg-rose-400' :
                    sub.normScore >= 60 ? 'bg-emerald-400' :
                    sub.normScore >= 30 ? 'bg-amber-400' : 'bg-rose-400'
                  )}
                  style={{ width: `${sub.normScore}%` }}
                />
              </div>
              <span className={clsx('font-mono text-xs font-black w-14 text-right shrink-0',
                sub.dead ? 'text-rose-500' :
                sub.normScore >= 60 ? 'text-emerald-600' :
                sub.normScore >= 30 ? 'text-amber-600' : 'text-rose-500'
              )}>
                {sub.valueScore.toFixed(3)}
              </span>
              <span className="text-[10px] text-gray-400 w-16 text-right shrink-0 font-medium">
                ${sub.cph === Infinity ? '∞' : sub.cph}/hr
              </span>
            </div>
          ))}
        </div>
      </div>

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
