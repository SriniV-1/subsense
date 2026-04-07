import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { snoozeAndSweep } from '../api/subscriptions.js'

// ── Mirror of SweepService.java mock prices ───────────────────────────────────
const MOCK_PRICES = {
  VOO:  498.72,
  SPY:  527.14,
  QQQ:  446.38,
  SCHB:  24.61,
}

const TICKERS = [
  { value: 'VOO',  label: 'VOO',  desc: 'Vanguard S&P 500',      poolName: 'Wealthfront S&P 500 Pool' },
  { value: 'SPY',  label: 'SPY',  desc: 'SPDR S&P 500',          poolName: 'SPDR S&P 500 Pool' },
  { value: 'QQQ',  label: 'QQQ',  desc: 'Invesco Nasdaq-100',    poolName: 'Invesco Nasdaq-100 Pool' },
  { value: 'SCHB', label: 'SCHB', desc: 'Schwab Broad Market',   poolName: 'Schwab Broad Market Pool' },
]

// 10-yr S&P projection: monthly contributions at 10% annual (≈ 0.8333%/mo)
function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

// Local mock trade — used when backend is offline
function mockTrade(amount, ticker) {
  const t = TICKERS.find(t => t.value === ticker) ?? TICKERS[0]
  const price = MOCK_PRICES[t.value]
  const shares = Math.round((amount / price) * 1_000_000) / 1_000_000
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return {
    tradeId: `TRD-${id}`,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ticker: t.value,
    fractionalShares: shares,
    amountInvested: Math.round(amount * 100) / 100,
    mockPricePerShare: price,
    poolName: t.poolName,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Counter({ to, decimals = 2, prefix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const duration = 1200
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setVal(parseFloat((ease * to).toFixed(decimals)))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to, decimals])
  return <>{prefix}{val.toFixed(decimals)}</>
}

function Spinner() {
  return (
    <div className="relative w-14 h-14 mx-auto">
      <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
      <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
      <div
        className="absolute inset-2 rounded-full border-t-2 border-emerald-400 animate-spin"
        style={{ animationDirection: 'reverse', animationDuration: '0.9s' }}
      />
    </div>
  )
}

function TradeRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-600 text-xs font-medium shrink-0">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function RoutingModal({ subscription, onClose, onInvest }) {
  const [ticker, setTicker]   = useState('VOO')
  const [phase, setPhase]     = useState('idle')
  const [trade, setTrade]     = useState(null)
  const [errMsg, setErrMsg]   = useState('')

  if (!subscription) return null
  const { id, name, monthlyCost, icon, accentColor: _accent } = subscription

  // Ensure readable contrast — Notion has white (#ffffff) accent
  const accent = (_accent === '#ffffff' || _accent === '#fff') ? '#818cf8' : (_accent ?? '#7c3aed')
  const projection = projectedValue(monthlyCost).toFixed(0)

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
    } catch {
      // Backend offline — run fully local mock so demo always works
      await new Promise(res => setTimeout(res, 1500))
      const local = mockTrade(monthlyCost, ticker)
      setTrade(local)
      setPhase('success')
      onInvest?.(subscription, local)
    }
  }

  const selectedTicker = TICKERS.find(t => t.value === ticker)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(6, 4, 16, 0.82)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0f0a1e 0%, #130d2a 60%, #0a1224 100%)',
          border: `1px solid ${accent}40`,
          boxShadow: `0 0 80px ${accent}28, 0 24px 64px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        {/* Corner glow */}
        <div
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)` }}
        />

        <div className="relative p-7">

          {/* ── IDLE ──────────────────────────────────────────────────────── */}
          {phase === 'idle' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0"
                    style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                      Logic Gate — Micro-Invest
                    </p>
                    <h2 className="text-white font-black text-lg leading-tight" style={{ fontFamily: 'Nunito, sans-serif' }}>
                      Route Saved Funds
                    </h2>
                  </div>
                </div>
                <button onClick={onClose} className="text-gray-700 hover:text-gray-400 transition-colors text-xl leading-none">
                  ✕
                </button>
              </div>

              {/* Amount + projection */}
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">
                    Snoozed from {name}
                  </p>
                  <span className="text-[10px] text-gray-600 font-mono">per month</span>
                </div>
                <p className="text-4xl font-black font-mono" style={{ color: accent }}>
                  ${monthlyCost.toFixed(2)}
                  <span className="text-base text-gray-600 font-normal">/mo</span>
                </p>
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
                  <span className="text-emerald-400 text-xs">↑</span>
                  <p className="text-gray-500 text-[11px]">
                    Projected{' '}
                    <span className="text-emerald-400 font-bold font-mono">${parseInt(projection).toLocaleString()}</span>
                    {' '}in 10 years at 10% avg return
                  </p>
                </div>
              </div>

              {/* Ticker picker */}
              <div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                  Select Index Pool
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TICKERS.map(t => {
                    const selected = ticker === t.value
                    const shares = (monthlyCost / MOCK_PRICES[t.value]).toFixed(4)
                    return (
                      <button
                        key={t.value}
                        onClick={() => setTicker(t.value)}
                        className="rounded-xl p-3 text-left transition-all duration-200 relative overflow-hidden"
                        style={selected ? {
                          background: `${accent}20`,
                          border: `1px solid ${accent}60`,
                          boxShadow: `0 0 16px ${accent}18`,
                        } : {
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        {selected && (
                          <div
                            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                            style={{ background: accent }}
                          />
                        )}
                        <p className={`font-mono font-black text-sm ${selected ? 'text-white' : 'text-gray-500'}`}>
                          {t.label}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{t.desc}</p>
                        <p className={`font-mono text-[10px] mt-1.5 font-semibold ${selected ? 'text-emerald-400' : 'text-gray-700'}`}>
                          ~{shares} shares
                        </p>
                        <p className="text-[9px] text-gray-700 font-mono">
                          ${MOCK_PRICES[t.value].toFixed(2)}/share
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Routing summary */}
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.14)' }}
              >
                <span className="text-base mt-0.5">⚡</span>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Route{' '}
                  <span className="text-white font-semibold font-mono">${monthlyCost.toFixed(2)}/mo</span>
                  {' '}→{' '}
                  <span className="font-semibold" style={{ color: accent }}>{selectedTicker?.desc}</span>
                  {' '}as fractional shares.
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={handleRoute}
                className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white transition-all duration-200 relative overflow-hidden group active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${accent}, #4f46e5)`,
                  boxShadow: `0 4px 24px ${accent}38`,
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Route Funds
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/10" />
              </button>

              <p className="text-center text-[10px] text-gray-700">
                Demo mode — no real funds are moved
              </p>
            </div>
          )}

          {/* ── LOADING ────────────────────────────────────────────────────── */}
          {phase === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-6">
              <Spinner />
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Executing fractional trade...</p>
                <p className="text-gray-600 text-xs mt-1">
                  Routing ${monthlyCost.toFixed(2)} → {ticker}
                </p>
              </div>
              <div className="w-full space-y-2.5">
                {['Authorizing sweep', 'Pricing fractional units', 'Executing order'].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-gray-600">
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                      style={{ background: accent, animationDelay: `${i * 0.4}s` }}
                    />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SUCCESS ────────────────────────────────────────────────────── */}
          {phase === 'success' && trade && (
            <div className="space-y-5">
              {/* Badge */}
              <div className="text-center pt-2">
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-3"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  ✓
                </div>
                <h2 className="text-white font-black text-xl" style={{ fontFamily: 'Nunito, sans-serif' }}>
                  Trade Confirmed
                </h2>
                <p className="text-gray-500 text-xs mt-1">{name} snoozed · funds routed</p>
              </div>

              {/* Trade receipt */}
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <TradeRow label="Trade ID" value={
                  <span className="font-mono text-emerald-400 text-xs">{trade.tradeId}</span>
                } />
                <TradeRow label="Ticker" value={
                  <span className="font-mono font-black text-white">{trade.ticker}</span>
                } />
                <TradeRow label="Fractional Shares" value={
                  <span className="font-mono font-black text-lg" style={{ color: accent }}>
                    <Counter to={trade.fractionalShares} decimals={6} />
                  </span>
                } />
                <TradeRow label="Amount Invested" value={
                  <span className="font-mono font-bold text-white">
                    $<Counter to={trade.amountInvested} decimals={2} />
                  </span>
                } />
                <TradeRow label="Price / Share" value={
                  <span className="font-mono text-gray-400 text-xs">
                    ${trade.mockPricePerShare?.toFixed(2)}
                  </span>
                } />
                <TradeRow label="Pool" value={
                  <span className="text-gray-300 text-xs text-right">{trade.poolName}</span>
                } />
                <div className="pt-1 border-t border-white/5">
                  <p className="text-[10px] text-gray-700 font-mono">{trade.timestamp}</p>
                </div>
              </div>

              {/* 10-yr projection callout */}
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}
              >
                <span className="text-lg">📈</span>
                <p className="text-gray-400 text-xs leading-relaxed">
                  At this rate, your{' '}
                  <span className="text-white font-semibold font-mono">${monthlyCost.toFixed(2)}/mo</span>
                  {' '}routing could grow to{' '}
                  <span className="text-emerald-400 font-bold font-mono">${parseInt(projection).toLocaleString()}</span>
                  {' '}in 10 years.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98]"
                style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)' }}
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
