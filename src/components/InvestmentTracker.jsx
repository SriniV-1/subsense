import { useMemo } from 'react'
import { TrendingUp, DollarSign, Layers, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
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

function buildChartData(monthlyAmount) {
  const r = 0.10 / 12
  const data = []
  for (let month = 0; month <= 120; month += 3) {
    const contributed = monthlyAmount * month
    const value = month === 0 ? 0 : monthlyAmount * ((Math.pow(1 + r, month) - 1) / r)
    data.push({
      month,
      label: month === 0 ? 'Now' : month % 12 === 0 ? `Yr ${month / 12}` : null,
      contributed: Math.round(contributed),
      value: Math.round(value),
    })
  }
  return data
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const contributed = payload.find(p => p.dataKey === 'contributed')
  const value       = payload.find(p => p.dataKey === 'value')
  const gain        = value && contributed ? value.value - contributed.value : 0
  return (
    <div className="bg-white border border-violet-100 rounded-2xl px-4 py-3 text-xs shadow-card-hover">
      <p className="font-bold font-display text-gray-700 mb-2">{label}</p>
      {contributed && (
        <p className="text-indigo-500 font-semibold">Contributed: <span className="font-mono font-black">${contributed.value.toLocaleString()}</span></p>
      )}
      {value && (
        <p className="text-emerald-600 font-semibold">Portfolio value: <span className="font-mono font-black">${value.value.toLocaleString()}</span></p>
      )}
      {gain > 0 && (
        <p className="text-violet-600 font-semibold mt-1">Gain: <span className="font-mono font-black">+${gain.toLocaleString()}</span></p>
      )}
    </div>
  )
}

function GrowthChart({ monthlyAmount }) {
  const data = useMemo(() => buildChartData(monthlyAmount), [monthlyAmount])
  const maxVal = data[data.length - 1]?.value ?? 0

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-bold font-display text-gray-800">Investment Value vs. Money In</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          ${monthlyAmount.toFixed(2)}/mo compounding at 10% annual return over 10 years
        </p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradContrib" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,181,253,0.25)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={v => v ?? ''}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="contributed"
            name="Contributed"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#gradContrib)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Portfolio Value"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#gradValue)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-indigo-500 rounded-full" />
          <span className="text-xs text-gray-500 font-medium">Money contributed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          <span className="text-xs text-gray-500 font-medium">Portfolio value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-2 bg-emerald-100 rounded-sm border border-emerald-200" />
          <span className="text-xs text-gray-500 font-medium">Compound gain</span>
        </div>
      </div>
    </div>
  )
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

  const totalSubscriptionSpend = subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0)

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

        <div className="card p-8 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-3xl bg-indigo-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="font-bold font-display text-gray-700 text-lg">No investments yet</p>
          <p className="text-gray-400 text-sm mt-1.5 max-w-sm leading-relaxed">
            Find a flagged subscription on the Dashboard or AI Sentinel and hit
            <span className="font-semibold text-violet-600"> ⚡ Snooze &amp; Invest</span> to route funds here.
          </p>
        </div>

        {/* What-if chart using full subscription spend */}
        <div>
          <p className="text-xs text-gray-400 font-medium px-1 mb-3">
            💡 What if you redirected your full ${totalSubscriptionSpend.toFixed(0)}/mo subscription spend?
          </p>
          <GrowthChart monthlyAmount={totalSubscriptionSpend} />
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

      {/* Growth chart */}
      <GrowthChart monthlyAmount={totalMonthly} />

      {/* Milestone snapshots */}
      <div className="card p-6">
        <h3 className="font-bold font-display text-gray-800 mb-1">Value Milestones</h3>
        <p className="text-xs text-gray-400 mb-4">Portfolio value vs. total contributed at each checkpoint</p>
        <div className="grid grid-cols-4 gap-3">
          {[1, 3, 5, 10].map(years => {
            const pv          = projectedValue(totalMonthly, years)
            const contributed = totalMonthly * 12 * years
            const gain        = pv - contributed
            return (
              <div key={years} className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-3 border border-violet-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">{years}yr</p>
                <p className="text-lg font-black font-mono text-emerald-600">${Math.round(pv).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">in: ${Math.round(contributed).toLocaleString()}</p>
                <p className="text-[10px] text-violet-600 font-semibold">+${Math.round(gain).toLocaleString()} gain</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
