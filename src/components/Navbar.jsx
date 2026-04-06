import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Flame,
  ArrowLeftRight,
  Bell,
  Zap,
  ChevronDown,
  FlaskConical,
} from 'lucide-react'
import { userProfile } from '../data/mockData.js'
import { sentinelShouldAlert } from '../utils/calculations.js'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/heatmap', icon: Flame, label: 'Utilization Map' },
  { to: '/swap', icon: ArrowLeftRight, label: 'Swap Calculator' },
  { to: '/sentinel', icon: Bell, label: 'AI Sentinel' },
]

export default function Navbar({ devMode, setDevMode, subscriptions }) {
  const alertCount = subscriptions.filter((s) =>
    sentinelShouldAlert(s.renewalDate, s.usageLogs, userProfile.sentinelDropThreshold)
  ).length

  const totalSpend = subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0)

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 leading-none">SubSense</h1>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Value Analytics</p>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {userProfile.avatarInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{userProfile.name}</p>
            <p className="text-xs text-slate-500 truncate">{userProfile.email}</p>
          </div>
        </div>

        {/* Spend summary */}
        <div className="mt-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Monthly Spend</span>
            <span className="text-xs font-mono font-semibold text-slate-200">
              ${totalSpend.toFixed(2)}
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalSpend / userProfile.monthlyBudget) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Budget: ${userProfile.monthlyBudget}/mo
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 px-3 mb-2">Modules</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(isActive ? 'nav-item-active' : 'nav-item-inactive')
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {label === 'AI Sentinel' && alertCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Dev Mode Toggle */}
      <div className="px-4 pb-6 pt-3 border-t border-slate-800">
        <button
          onClick={() => setDevMode((v) => !v)}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200',
            devMode
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          )}
        >
          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Developer Mode</span>
          <div
            className={clsx(
              'w-7 h-4 rounded-full transition-colors duration-200 relative',
              devMode ? 'bg-amber-500' : 'bg-slate-700'
            )}
          >
            <div
              className={clsx(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200',
                devMode ? 'translate-x-3.5' : 'translate-x-0.5'
              )}
            />
          </div>
        </button>
        {devMode && (
          <p className="text-[10px] text-amber-600 mt-1.5 px-1 leading-snug">
            Drop usage on AI Sentinel tab to trigger live alerts
          </p>
        )}
      </div>
    </aside>
  )
}
