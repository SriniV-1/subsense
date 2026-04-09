import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingUp, BedDouble } from 'lucide-react'
import confetti from 'canvas-confetti'
import clsx from 'clsx'

const TICKERS = ['VOO', 'SPY', 'QQQ', 'SCHB']
const MOCK_PRICES = { VOO: 498.72, SPY: 527.14, QQQ: 446.38, SCHB: 24.61 }

function mockTrade(amount, ticker) {
  const price  = MOCK_PRICES[ticker]
  const shares = Math.round((amount / price) * 1_000_000) / 1_000_000
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id     = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return {
    tradeId:           `TRD-${id}`,
    timestamp:         new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ticker,
    fractionalShares:  shares,
    amountInvested:    Math.round(amount * 100) / 100,
    mockPricePerShare: price,
    poolName:          `${ticker} Index Pool`,
  }
}

function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

export default function BatchActionModal({ subs, onSnooze, onInvest, onClose }) {
  // action per sub: 'snooze' | 'invest'
  const [actions, setActions] = useState(() =>
    Object.fromEntries(subs.map(s => [s.id, 'snooze']))
  )
  const [ticker, setTicker] = useState('VOO')
  const [done,   setDone]   = useState(false)

  const investSubs = subs.filter(s => actions[s.id] === 'invest')
  const snoozeSubs = subs.filter(s => actions[s.id] === 'snooze')
  const totalMonthly = subs.reduce((sum, s) => sum + s.monthlyCost, 0)
  const investMonthly = investSubs.reduce((sum, s) => sum + s.monthlyCost, 0)

  function setAll(action) {
    setActions(Object.fromEntries(subs.map(s => [s.id, action])))
  }

  function toggle(id) {
    setActions(prev => ({ ...prev, [id]: prev[id] === 'snooze' ? 'invest' : 'snooze' }))
  }

  function confirm() {
    snoozeSubs.forEach(s => onSnooze(s.id))
    investSubs.forEach(s => {
      const trade = mockTrade(s.monthlyCost, ticker)
      onInvest(s, trade)
    })
    // fire confetti
    const end = Date.now() + 1800
    const colors = ['#7c3aed', '#a855f7', '#ec4899', '#10b981', '#6366f1']
    ;(function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
    setDone(true)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-violet-500 to-pink-500 shrink-0" />

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Dead Weight</p>
              <h2 className="font-black font-display text-gray-800 text-lg leading-tight">
                {subs.length} Subscription{subs.length > 1 ? 's' : ''} · ${totalMonthly.toFixed(2)}/mo
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {done ? (
            /* ── Done state ── */
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl bg-emerald-50 border border-emerald-200">
                ✓
              </div>
              <p className="font-black font-display text-gray-800 text-lg">Done</p>
              <div className="text-sm text-gray-500 space-y-1">
                {snoozeSubs.length > 0 && (
                  <p>{snoozeSubs.length} snoozed · ${snoozeSubs.reduce((s, x) => s + x.monthlyCost, 0).toFixed(2)}/mo freed</p>
                )}
                {investSubs.length > 0 && (
                  <p>{investSubs.length} invested → {ticker} · ${investMonthly.toFixed(2)}/mo</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-2 w-full py-3 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Bulk toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAll('snooze')}
                  className={clsx(
                    'flex-1 py-2 rounded-xl text-xs font-bold font-display border transition-all duration-150 flex items-center justify-center gap-1.5',
                    snoozeSubs.length === subs.length
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-200 hover:text-emerald-600'
                  )}
                >
                  <BedDouble className="w-3.5 h-3.5" /> All Snooze
                </button>
                <button
                  onClick={() => setAll('invest')}
                  className={clsx(
                    'flex-1 py-2 rounded-xl text-xs font-bold font-display border transition-all duration-150 flex items-center justify-center gap-1.5',
                    investSubs.length === subs.length
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-600'
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> All Invest
                </button>
              </div>

              {/* Per-sub rows */}
              <div className="space-y-2">
                {subs.map(sub => {
                  const isInvest = actions[sub.id] === 'invest'
                  return (
                    <div
                      key={sub.id}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-2xl border transition-all duration-150',
                        isInvest
                          ? 'bg-violet-50 border-violet-200'
                          : 'bg-gray-50 border-gray-100'
                      )}
                    >
                      <span className="text-xl shrink-0">{sub.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold font-display text-gray-800 truncate">{sub.name}</p>
                        <p className="text-xs font-mono text-gray-400">${sub.monthlyCost}/mo</p>
                      </div>
                      {/* Toggle */}
                      <div
                        className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0 cursor-pointer"
                        onClick={() => toggle(sub.id)}
                      >
                        <div className={clsx(
                          'px-2.5 py-1.5 text-[10px] font-bold font-display transition-all duration-150',
                          !isInvest ? 'bg-emerald-500 text-white' : 'text-gray-400 bg-white hover:bg-gray-50'
                        )}>
                          Snooze
                        </div>
                        <div className={clsx(
                          'px-2.5 py-1.5 text-[10px] font-bold font-display transition-all duration-150',
                          isInvest ? 'bg-violet-500 text-white' : 'text-gray-400 bg-white hover:bg-gray-50'
                        )}>
                          Invest
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Ticker picker — only when any are set to invest */}
              {investSubs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">
                    Route {investSubs.length} investment{investSubs.length > 1 ? 's' : ''} to
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {TICKERS.map(t => (
                      <button
                        key={t}
                        onClick={() => setTicker(t)}
                        className={clsx(
                          'py-2 rounded-xl text-xs font-mono font-black border transition-all duration-150',
                          ticker === t
                            ? 'bg-violet-100 border-violet-300 text-violet-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-violet-200'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">
                    ${investMonthly.toFixed(2)}/mo → ~${Math.round(projectedValue(investMonthly)).toLocaleString()} in 10 yrs
                  </p>
                </div>
              )}

              {/* Summary + confirm */}
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs space-y-1.5">
                  {snoozeSubs.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Snoozed</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {snoozeSubs.length} · ${snoozeSubs.reduce((s, x) => s + x.monthlyCost, 0).toFixed(2)}/mo freed
                      </span>
                    </div>
                  )}
                  {investSubs.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invested → {ticker}</span>
                      <span className="font-mono font-bold text-violet-600">
                        {investSubs.length} · ${investMonthly.toFixed(2)}/mo
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                    <span className="text-gray-500 font-semibold">Total freed</span>
                    <span className="font-mono font-black text-gray-800">${totalMonthly.toFixed(2)}/mo</span>
                  </div>
                </div>

                <button
                  onClick={confirm}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                >
                  Confirm · ${totalMonthly.toFixed(2)}/mo freed
                </button>
                <p className="text-center text-[10px] text-gray-400">Demo mode — no real funds are moved</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
