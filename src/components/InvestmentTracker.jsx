import { useMemo } from 'react'
import { TrendingUp, DollarSign, Layers, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

const TICKER_COLORS = {
  VOO:  '#7c3aed',
  SPY:  '#0ea5e9',
  QQQ:  '#f97316',
  SCHB: '#10b981',
}

const TICKER_LABELS = {
  VOO:  'Vanguard S&P 500',
  SPY:  'SPDR S&P 500',
  QQQ:  'Invesco Nasdaq-100',
  SCHB: 'Schwab Broad Market',
}

function projectedValue(monthlyAmount, years = 10) {
  const r = 0.10 / 12
  const n = years * 12
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r)
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className={clsx('w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-sm', color)}>
        {icon}
      </div>
      <p className="text-2xl font-black font-mono text-gray-800">{value}</p>
      <p className="text-xs font-semibold font-display text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function InvestmentTracker({ investments, subscriptions }) {
  const totalInvested   = investments.reduce((s, inv) => s + inv.trade.amountInvested, 0)
  const totalMonthly    = investments.reduce((s, inv) => s + inv.monthlyCost, 0)
  const projected10yr   = projectedValue(totalMonthly)

  const tickerTotals = useMemo(() => {
    const map = {}
    investments.forEach(inv => {
      const t = inv.trade.ticker
      if (!t) return  // brokerage cash deposit — no ticker position
      map[t] = (map[t] || 0) + inv.trade.amountInvested
    })
    return Object.entries(map).map(([ticker, amount]) => ({ ticker, amount }))
  }, [investments])

  if (investments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-black font-display gradient-text flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-500" />
            Investment Portfolio
          </h2>
          <p className="text-gray-500 text-sm mt-1 font-medium">
            Track funds routed from snoozed subscriptions
          </p>
        </div>

        <div className="card p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-100 flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="font-bold font-display text-gray-700 text-lg">No investments yet</p>
          <p className="text-gray-400 text-sm mt-2 max-w-sm leading-relaxed">
            Go to the Dashboard or AI Sentinel, find a flagged subscription, and hit
            <span className="font-semibold text-violet-600"> ⚡ Snooze &amp; Invest</span> to route funds here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h2 className="text-3xl font-black font-display gradient-text flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-indigo-500" />
          Investment Portfolio
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          {investments.length} subscription{investments.length > 1 ? 's' : ''} snoozed · funds routed
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Total Invested"
          value={`$${totalInvested.toFixed(2)}`}
          sub="one-time sweep amount"
          color="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-white" />}
          label="Monthly Saved"
          value={`$${totalMonthly.toFixed(2)}/mo`}
          sub="recurring from snoozed subs"
          color="bg-gradient-to-br from-indigo-500 to-blue-600"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          label="10yr Projection"
          value={`$${Math.round(projected10yr).toLocaleString()}`}
          sub="at 10% annual avg return"
          color="bg-gradient-to-br from-emerald-400 to-teal-500"
        />
        <StatCard
          icon={<Layers className="w-5 h-5 text-white" />}
          label="Positions"
          value={tickerTotals.length}
          sub={`across ${tickerTotals.length} index pool${tickerTotals.length > 1 ? 's' : ''}`}
          color="bg-gradient-to-br from-amber-400 to-orange-500"
        />
      </div>

      {/* Ticker allocation */}
      {tickerTotals.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold font-display text-gray-800 mb-4">Portfolio Allocation</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
            {tickerTotals.map(({ ticker, amount }) => (
              <div
                key={ticker}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700"
                style={{
                  width: `${(amount / totalInvested) * 100}%`,
                  background: TICKER_COLORS[ticker] ?? '#6366f1',
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {tickerTotals.map(({ ticker, amount }) => (
              <div key={ticker} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: TICKER_COLORS[ticker] ?? '#6366f1' }}
                />
                <div>
                  <p className="text-xs font-bold font-mono text-gray-800">{ticker}</p>
                  <p className="text-[10px] text-gray-400">{TICKER_LABELS[ticker]}</p>
                  <p className="text-[10px] font-mono font-semibold text-gray-600">
                    ${amount.toFixed(2)} · {((amount / totalInvested) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade history */}
      <div className="card p-6">
        <h3 className="font-bold font-display text-gray-800 mb-4">Trade History</h3>
        <div className="space-y-3">
          {[...investments].reverse().map((inv, i) => (
            <div
              key={inv.id}
              className="flex items-center gap-4 p-4 rounded-2xl transition-colors hover:bg-violet-50/50"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `${TICKER_COLORS[inv.trade.ticker] ?? '#6366f1'}15` }}
              >
                {inv.subIcon}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold font-display text-gray-800">{inv.subName}</p>
                  {inv.trade.ticker ? (
                    <span
                      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full text-white"
                      style={{ background: TICKER_COLORS[inv.trade.ticker] ?? '#6366f1' }}
                    >
                      {inv.trade.ticker}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full text-white bg-indigo-400">
                      {inv.trade.brokerage ?? 'Deposit'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {inv.trade.tradeId} · {inv.trade.poolName}
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  {format(parseISO(inv.routedAt), 'MMM d, yyyy · h:mm a')}
                </p>
              </div>

              {/* Amounts */}
              <div className="text-right shrink-0">
                <p className="text-sm font-black font-mono text-gray-800">
                  ${inv.trade.amountInvested.toFixed(2)}
                </p>
                {inv.trade.fractionalShares != null ? (
                  <>
                    <p className="text-[11px] font-mono text-violet-600">
                      {inv.trade.fractionalShares.toFixed(6)} shares
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      @${inv.trade.mockPricePerShare?.toFixed(2)}/sh
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-indigo-500 font-semibold">Cash deposit</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 10yr growth table */}
      <div className="card p-6">
        <h3 className="font-bold font-display text-gray-800 mb-1">Projected Growth</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly routing at 10% avg annual return</p>
        <div className="grid grid-cols-4 gap-3">
          {[1, 3, 5, 10].map(years => {
            const pv = projectedValue(totalMonthly, years)
            const multiple = totalMonthly > 0 ? pv / (totalMonthly * 12 * years) : 1
            return (
              <div key={years} className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-3 text-center border border-violet-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">{years}yr</p>
                <p className="text-lg font-black font-mono text-gray-800">${Math.round(pv).toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{multiple.toFixed(1)}× return</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
