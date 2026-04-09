import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingUp, Building2, Zap } from 'lucide-react'
import { snoozeAndSweep } from '../api/subscriptions.js'
import clsx from 'clsx'
import confetti from 'canvas-confetti'

// ── Index fund pools ──────────────────────────────────────────────────────────

const MOCK_PRICES = {
  VOO:  498.72,
  SPY:  527.14,
  QQQ:  446.38,
  SCHB:  24.61,
}

const TICKERS = [
  { value: 'VOO',  label: 'VOO',  desc: 'Vanguard S&P 500',    poolName: 'Wealthfront S&P 500 Pool' },
  { value: 'SPY',  label: 'SPY',  desc: 'SPDR S&P 500',        poolName: 'SPDR S&P 500 Pool' },
  { value: 'QQQ',  label: 'QQQ',  desc: 'Invesco Nasdaq-100',  poolName: 'Invesco Nasdaq-100 Pool' },
  { value: 'SCHB', label: 'SCHB', desc: 'Schwab Broad Market', poolName: 'Schwab Broad Market Pool' },
]

// ── Brokerage options ─────────────────────────────────────────────────────────

const BROKERAGES = [
  { id: 'fidelity',  name: 'Fidelity',      icon: '🏛️' },
  { id: 'robinhood', name: 'Robinhood',      icon: '🪶' },
  { id: 'schwab',    name: 'Charles Schwab', icon: '💼' },
  { id: 'vanguard',  name: 'Vanguard',       icon: '⛵' },
  { id: 'etrade',    name: 'E*TRADE',        icon: '📊' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

function mockTrade(amount, ticker) {
  const t = TICKERS.find(t => t.value === ticker) ?? TICKERS[0]
  const price  = MOCK_PRICES[t.value]
  const shares = Math.round((amount / price) * 1_000_000) / 1_000_000
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id     = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return {
    tradeId:          `TRD-${id}`,
    timestamp:        new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ticker:           t.value,
    fractionalShares: shares,
    amountInvested:   Math.round(amount * 100) / 100,
    mockPricePerShare: price,
    poolName:         t.poolName,
  }
}

function mockBrokerageDeposit(amount, brokerage) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id    = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return {
    tradeId:          `DEP-${id}`,
    timestamp:        new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ticker:           null,
    fractionalShares: null,
    amountInvested:   Math.round(amount * 100) / 100,
    mockPricePerShare: null,
    poolName:         `${brokerage.name} Cash Account`,
    brokerage:        brokerage.name,
  }
}

function Counter({ to, decimals = 2 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start    = performance.now()
    const duration = 1200
    const tick = (now) => {
      const t    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setVal(parseFloat((ease * to).toFixed(decimals)))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to, decimals])
  return <>{val.toFixed(decimals)}</>
}

function Spinner() {
  return (
    <div className="relative w-12 h-12 mx-auto">
      <div className="absolute inset-0 rounded-full border-2 border-violet-200" />
      <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
      <div
        className="absolute inset-2 rounded-full border-t-2 border-pink-400 animate-spin"
        style={{ animationDirection: 'reverse', animationDuration: '0.9s' }}
      />
    </div>
  )
}

function ReceiptRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 text-xs font-medium shrink-0">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function RoutingModal({ subscription, onClose, onInvest }) {
  const [tab,                setTab]                = useState('pools')      // 'pools' | 'brokerage'
  const [ticker,             setTicker]             = useState('VOO')
  const [selectedBrokerage,  setSelectedBrokerage]  = useState(null)
  const [connectedBrokerage, setConnectedBrokerage] = useState(null)
  const [phase,              setPhase]              = useState('idle')       // idle | connecting | loading | success
  const [trade,              setTrade]              = useState(null)

  if (!subscription) return null
  const { id, name, monthlyCost, icon } = subscription
  const projection    = projectedValue(monthlyCost).toFixed(0)
  const selectedTicker = TICKERS.find(t => t.value === ticker)

  function fireConfetti() {
    const end = Date.now() + 1800
    const colors = ['#7c3aed', '#a855f7', '#ec4899', '#10b981', '#6366f1']
    ;(function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }

  async function handleRoute() {
    setPhase('loading')
    try {
      const [result] = await Promise.all([
        snoozeAndSweep(id, ticker),
        new Promise(res => setTimeout(res, 1500)),
      ])
      const t = result?.trade ?? result
      setTrade(t)
      setPhase('success')
      onInvest?.(subscription, t)
      fireConfetti()
    } catch {
      await new Promise(res => setTimeout(res, 1500))
      const local = mockTrade(monthlyCost, ticker)
      setTrade(local)
      setPhase('success')
      onInvest?.(subscription, local)
      fireConfetti()
    }
  }

  async function handleBrokerageConnect() {
    setPhase('connecting')
    await new Promise(res => setTimeout(res, 1500))
    setConnectedBrokerage(selectedBrokerage)
    setPhase('idle')
  }

  async function handleBrokerageDeposit() {
    setPhase('loading')
    await new Promise(res => setTimeout(res, 1500))
    const t = mockBrokerageDeposit(monthlyCost, connectedBrokerage)
    setTrade(t)
    setPhase('success')
    onInvest?.(subscription, t)
    fireConfetti()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,10,30,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

        <div className="p-6 space-y-5">

          {/* Title */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  Micro-Invest
                </p>
                <h2 className="font-black font-display text-gray-800 text-lg leading-tight">Route Saved Funds</h2>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Amount pill */}
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.04))', border: '1px solid rgba(139,92,246,0.15)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
              Redirecting from {name}
            </p>
            <p className="text-4xl font-black font-mono text-violet-700">
              ${monthlyCost.toFixed(2)}
              <span className="text-base text-gray-400 font-normal">/mo</span>
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              ↑ ~<span className="text-emerald-600 font-bold font-mono">${parseInt(projection).toLocaleString()}</span>
              {' '}in 10 yrs at 10% avg return
            </p>
          </div>

          {/* ── LOADING ──────────────────────────────────────────────────────── */}
          {(phase === 'loading' || phase === 'connecting') && (
            <div className="py-8 flex flex-col items-center gap-5">
              <Spinner />
              <div className="text-center">
                <p className="text-gray-700 font-semibold text-sm">
                  {phase === 'connecting'
                    ? `Connecting to ${selectedBrokerage?.name}...`
                    : 'Executing trade...'}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {phase === 'connecting'
                    ? 'Verifying credentials securely'
                    : `Routing $${monthlyCost.toFixed(2)} → ${tab === 'pools' ? ticker : connectedBrokerage?.name}`}
                </p>
              </div>
              {phase === 'loading' && (
                <div className="w-full space-y-2.5">
                  {['Authorizing sweep', 'Pricing units', 'Executing order'].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-gray-400">
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0"
                        style={{ animationDelay: `${i * 0.4}s` }}
                      />
                      {step}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
          {phase === 'success' && trade && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl mb-3 bg-emerald-50 border border-emerald-200">
                  ✓
                </div>
                <h3 className="font-black font-display text-gray-800 text-lg">
                  {trade.brokerage ? 'Deposit Confirmed' : 'Trade Confirmed'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{name} snoozed · funds routed</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 border border-gray-100">
                <ReceiptRow label="Reference" value={
                  <span className="font-mono text-emerald-600 text-xs">{trade.tradeId}</span>
                } />
                {trade.brokerage ? (
                  <ReceiptRow label="Destination" value={
                    <span className="font-mono font-bold text-gray-800">{trade.poolName}</span>
                  } />
                ) : (
                  <ReceiptRow label="Ticker" value={
                    <span className="font-mono font-black text-gray-800">{trade.ticker}</span>
                  } />
                )}
                {trade.fractionalShares != null && (
                  <ReceiptRow label="Shares" value={
                    <span className="font-mono font-black text-violet-700 text-base">
                      <Counter to={trade.fractionalShares} decimals={6} />
                    </span>
                  } />
                )}
                <ReceiptRow label="Amount" value={
                  <span className="font-mono font-bold text-gray-800">
                    $<Counter to={trade.amountInvested} decimals={2} />
                  </span>
                } />
                {trade.mockPricePerShare != null && (
                  <ReceiptRow label="Price/Share" value={
                    <span className="font-mono text-gray-400 text-xs">${trade.mockPricePerShare.toFixed(2)}</span>
                  } />
                )}
                <div className="pt-1.5 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400 font-mono">{trade.timestamp}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
                <span className="text-lg">📈</span>
                <p className="text-xs text-emerald-600 leading-relaxed">
                  At this rate,{' '}
                  <span className="font-mono font-bold">${monthlyCost.toFixed(2)}/mo</span>
                  {' '}could grow to{' '}
                  <span className="font-mono font-black">${parseInt(projection).toLocaleString()}</span>
                  {' '}in 10 years.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          )}

          {/* ── IDLE ─────────────────────────────────────────────────────────── */}
          {phase === 'idle' && (
            <>
              {/* Tab switcher */}
              <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
                <button
                  onClick={() => setTab('pools')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold font-display transition-all duration-200',
                    tab === 'pools'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Index Pools
                </button>
                <button
                  onClick={() => setTab('brokerage')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold font-display transition-all duration-200',
                    tab === 'brokerage'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Brokerage
                </button>
              </div>

              {/* ── Index Pools ── */}
              {tab === 'pools' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {TICKERS.map(t => {
                      const selected = ticker === t.value
                      const shares   = (monthlyCost / MOCK_PRICES[t.value]).toFixed(4)
                      return (
                        <button
                          key={t.value}
                          onClick={() => setTicker(t.value)}
                          className={clsx(
                            'rounded-2xl p-3 text-left transition-all duration-200 border',
                            selected
                              ? 'bg-violet-50 border-violet-300'
                              : 'bg-gray-50 border-gray-100 hover:border-violet-200 hover:bg-violet-50/30'
                          )}
                        >
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mb-1.5" />}
                          <p className={clsx('font-mono font-black text-sm', selected ? 'text-violet-700' : 'text-gray-700')}>
                            {t.label}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                          <p className={clsx('font-mono text-[10px] mt-1.5 font-semibold', selected ? 'text-emerald-600' : 'text-gray-400')}>
                            ~{shares} shares
                          </p>
                          <p className="text-[9px] text-gray-400 font-mono">${MOCK_PRICES[t.value].toFixed(2)}/share</p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-start gap-2 bg-violet-50 rounded-2xl px-4 py-3 border border-violet-100">
                    <Zap className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-violet-600">
                      Route{' '}
                      <span className="font-mono font-bold">${monthlyCost.toFixed(2)}/mo</span>
                      {' '}→{' '}
                      <span className="font-semibold">{selectedTicker?.desc}</span>
                      {' '}as fractional shares.
                    </p>
                  </div>

                  <button
                    onClick={handleRoute}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                  >
                    Route Funds →
                  </button>
                  <p className="text-center text-[10px] text-gray-400">Demo mode — no real funds are moved</p>
                </div>
              )}

              {/* ── Brokerage ── */}
              {tab === 'brokerage' && (
                <div className="space-y-4">
                  {connectedBrokerage ? (
                    <>
                      <div className="flex items-center gap-3 bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
                        <span className="text-2xl">{connectedBrokerage.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold font-display text-emerald-700">
                            Connected: {connectedBrokerage.name}
                          </p>
                          <p className="text-[10px] text-emerald-500">Cash account ready to receive deposits</p>
                        </div>
                        <button
                          onClick={() => { setConnectedBrokerage(null); setSelectedBrokerage(null) }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
                        >
                          Disconnect
                        </button>
                      </div>

                      <div className="flex items-start gap-2 bg-violet-50 rounded-2xl px-4 py-3 border border-violet-100">
                        <Zap className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-violet-600">
                          Deposit{' '}
                          <span className="font-mono font-bold">${monthlyCost.toFixed(2)}/mo</span>
                          {' '}to your{' '}
                          <span className="font-semibold">{connectedBrokerage.name}</span>
                          {' '}cash account to invest as you see fit.
                        </p>
                      </div>

                      <button
                        onClick={handleBrokerageDeposit}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                      >
                        Deposit ${monthlyCost.toFixed(2)} →
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">
                        Select your brokerage
                      </p>
                      <div className="space-y-2">
                        {BROKERAGES.map(b => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBrokerage(b)}
                            className={clsx(
                              'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200',
                              selectedBrokerage?.id === b.id
                                ? 'bg-violet-50 border-violet-300'
                                : 'bg-gray-50 border-gray-100 hover:border-violet-200 hover:bg-violet-50/30'
                            )}
                          >
                            <span className="text-xl">{b.icon}</span>
                            <span className={clsx(
                              'flex-1 font-semibold font-display text-sm',
                              selectedBrokerage?.id === b.id ? 'text-violet-700' : 'text-gray-700'
                            )}>
                              {b.name}
                            </span>
                            {selectedBrokerage?.id === b.id && (
                              <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleBrokerageConnect}
                        disabled={!selectedBrokerage}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 transition-all hover:opacity-90 active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Connect {selectedBrokerage?.name ?? 'Account'} →
                      </button>
                    </>
                  )}
                  <p className="text-center text-[10px] text-gray-400">Demo mode — no real connection is made</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
