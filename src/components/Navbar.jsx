import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Flame, ArrowLeftRight, Bell,
  Sparkles, FlaskConical, TrendingUp, Flag, CalendarDays,
} from 'lucide-react'
import { sentinelShouldAlert, isDeadWeight, shouldSnooze, isBingeAndAbandon, daysUntilRenewal } from '../utils/calculations.js'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',        color: 'text-violet-600',  bg: 'bg-violet-100' },
  { to: '/heatmap',     icon: Flame,           label: 'Utilization Map',  color: 'text-orange-500',  bg: 'bg-orange-100' },
  { to: '/swap',        icon: ArrowLeftRight,  label: 'Swap Calculator',  color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { to: '/sentinel',    icon: Bell,            label: 'AI Sentinel',      color: 'text-pink-600',    bg: 'bg-pink-100' },
  { to: '/flagged',     icon: Flag,            label: 'Flagged',          color: 'text-rose-600',    bg: 'bg-rose-100' },
  { to: '/calendar',    icon: CalendarDays,    label: 'Renewals',         color: 'text-sky-600',     bg: 'bg-sky-100' },
  { to: '/investments', icon: TrendingUp,      label: 'Investments',      color: 'text-indigo-600',  bg: 'bg-indigo-100' },
]

export default function Navbar({ devMode, setDevMode, subscriptions, sweptSubIds = new Set(), profile, investmentCount = 0 }) {
  const alertCount = subscriptions.filter((s) =>
    sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold)
  ).length

  // Exclude swept (snoozed+invested) subs from flagged badge — they're already handled
  const flaggedCount = subscriptions.filter((s) =>
    !sweptSubIds.has(s.id) && (
      sentinelShouldAlert(s.renewalDate, s.usageLogs, profile.sentinelDropThreshold) ||
      isDeadWeight(s.usageLogs) ||
      shouldSnooze(s.monthlyCost, s.totalMinutes, profile.alertThresholdCPH) ||
      isBingeAndAbandon(s.usageLogs)
    )
  ).length

  const urgentRenewalCount = subscriptions.filter((s) => {
    const days = daysUntilRenewal(s.renewalDate)
    return days >= 0 && days <= 2
  }).length

  // Active spend excludes snoozed+invested subscriptions
  const totalSpend   = subscriptions.filter(s => !sweptSubIds.has(s.id)).reduce((s, sub) => s + sub.monthlyCost, 0)
  const savedMonthly = subscriptions.filter(s =>  sweptSubIds.has(s.id)).reduce((s, sub) => s + sub.monthlyCost, 0)
  const budgetPct    = Math.min(100, (totalSpend / profile.monthlyBudget) * 100)

  return (
    <aside className="w-64 shrink-0 border-r border-violet-100 bg-white/80 backdrop-blur-sm flex flex-col h-full">

      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-violet-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-violet shrink-0 hover:scale-110 transition-transform duration-300 cursor-pointer">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black font-display gradient-text leading-none">SubSense</h1>
            <p className="text-[10px] text-violet-400 mt-0.5 font-semibold uppercase tracking-widest">Value Analytics</p>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-violet-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm animate-pulse-soft">
            {profile.avatarInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold font-display text-gray-800 truncate">{profile.name}</p>
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          </div>
        </div>

        {/* Budget meter */}
        <div className="bg-violet-50 rounded-2xl px-3 py-2.5 border border-violet-100">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold text-gray-500">Active Spend</span>
            <span className="text-xs font-bold font-mono text-violet-700">${totalSpend.toFixed(2)}</span>
          </div>
          <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${budgetPct}%`,
                background: budgetPct < 70
                  ? 'linear-gradient(90deg,#34d399,#6ee7b7)'
                  : budgetPct < 90
                  ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
                  : 'linear-gradient(90deg,#f87171,#ec4899)',
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">of ${profile.monthlyBudget} budget</p>
          {savedMonthly > 0 && (
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span>↓</span> saving ${savedMonthly.toFixed(2)}/mo snoozed
            </p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300 px-3 mb-3">Modules</p>
        {navItems.map(({ to, icon: Icon, label, color, bg }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold font-display transition-all duration-200',
                isActive
                  ? `${bg} ${color}`
                  : 'text-gray-500 hover:bg-violet-50 hover:text-violet-600 hover:translate-x-1'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx(
                  'w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200',
                  isActive ? `${bg} ${color}` : 'text-gray-400'
                )}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1">{label}</span>
                {label === 'AI Sentinel' && alertCount > 0 && (
                  <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                    {alertCount}
                  </span>
                )}
                {label === 'Flagged' && flaggedCount > 0 && (
                  <span className="bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                    {flaggedCount}
                  </span>
                )}
                {label === 'Renewals' && urgentRenewalCount > 0 && (
                  <span className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {urgentRenewalCount}
                  </span>
                )}
                {label === 'Investments' && investmentCount > 0 && (
                  <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {investmentCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Dev mode toggle */}
      <div className="px-4 pb-6 pt-3 border-t border-violet-100">
        <button
          onClick={() => setDevMode((v) => !v)}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-semibold font-display border transition-all duration-200',
            devMode
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'text-gray-400 border-gray-200 hover:border-violet-200 hover:text-violet-500 hover:bg-violet-50'
          )}
        >
          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Developer Mode</span>
          <div
            className="w-8 rounded-full relative transition-all duration-300 flex items-center px-0.5"
            style={{ height: '18px', background: devMode ? '#fbbf24' : '#e5e7eb' }}
          >
            <div className={clsx(
              'w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300',
              devMode ? 'translate-x-3.5' : 'translate-x-0'
            )} />
          </div>
        </button>
        {devMode && (
          <p className="text-[10px] text-amber-500 mt-2 px-1 leading-snug font-medium">
            Drop usage on Sentinel tab to trigger live alerts
          </p>
        )}
      </div>
    </aside>
  )
}
