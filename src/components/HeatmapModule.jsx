import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Flame, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  calcValueScore, calcCostPerHour, heatmapColor, shouldSnooze,
} from '../utils/calculations.js'
import clsx from 'clsx'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildHeatmapGrid(usageLogs) {
  const padded = [...usageLogs]
  while (padded.length % 7 !== 0) padded.unshift({ date: null, minutes: -1 })
  const weeks = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))
  return weeks
}

function HeatmapTooltip({ day }) {
  if (!day || day.date === null) return null
  return (
    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white text-xs rounded-2xl px-3 py-2 whitespace-nowrap pointer-events-none shadow-card-hover border border-violet-100">
      <p className="font-bold font-display text-gray-700">{format(parseISO(day.date), 'MMM d, yyyy')}</p>
      <p className="text-violet-500 font-mono font-semibold">{day.minutes} min</p>
    </div>
  )
}

function UsageHeatmap({ usageLogs }) {
  const [hovered, setHovered] = useState(null)
  const grid = useMemo(() => buildHeatmapGrid(usageLogs), [usageLogs])

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-bold">{d}</div>
        ))}
      </div>

      {/* Cells */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((day, di) => (
            <div
              key={di}
              className="relative"
              onMouseEnter={() => day.date && setHovered(`${wi}-${di}`)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className={clsx(
                'heatmap-cell w-full aspect-square',
                day.minutes === -1 ? 'opacity-0 pointer-events-none' : heatmapColor(day.minutes)
              )} />
              {hovered === `${wi}-${di}` && <HeatmapTooltip day={day} />}
            </div>
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-gray-400 font-semibold">Less</span>
        {[0, 15, 45, 90, 150].map((m, i) => (
          <div key={i} className={clsx('w-4 h-4 rounded-md', heatmapColor(m))} />
        ))}
        <span className="text-[10px] text-gray-400 font-semibold">More</span>
      </div>
    </div>
  )
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-violet-100 rounded-2xl px-3 py-2 text-xs shadow-card-hover">
      <p className="text-gray-400 font-medium">{payload[0]?.payload?.date}</p>
      <p className="text-violet-600 font-bold font-mono">{payload[0]?.value} min</p>
    </div>
  )
}

function Chip({ label, value, color }) {
  const colors = {
    violet:  'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red:     'bg-rose-100 text-rose-600',
    slate:   'bg-gray-100 text-gray-600',
    amber:   'bg-amber-100 text-amber-700',
  }
  return (
    <div className={clsx('chip px-3 py-2 rounded-2xl text-center border border-white shadow-sm', colors[color])}>
      <p className="font-mono text-sm font-black">{value}</p>
      <p className="text-[10px] font-semibold mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

export default function HeatmapModule({ subscriptions, profile }) {
  const [selectedId, setSelectedId] = useState(subscriptions[0]?.id)
  const selected = subscriptions.find((s) => s.id === selectedId)

  const cph        = selected ? calcCostPerHour(selected.monthlyCost, selected.totalMinutes) : 0
  const valueScore = selected ? calcValueScore(selected.totalMinutes, selected.monthlyCost) : 0
  const snooze     = selected ? shouldSnooze(selected.monthlyCost, selected.totalMinutes, profile.alertThresholdCPH) : false

  const trendData = selected
    ? selected.usageLogs.slice(-14).map((l) => ({
        date: l.date ? format(parseISO(l.date), 'MMM d') : '',
        minutes: l.minutes,
      }))
    : []

  const avgMinutes = selected
    ? selected.usageLogs.reduce((s, l) => s + l.minutes, 0) / selected.usageLogs.length
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stagger-child" style={{ animationDelay: '0.05s' }}>
        <h2 className="text-3xl font-black font-display gradient-text-warm flex items-center gap-2">
          <Flame className="w-7 h-7 text-orange-400" />
          Utilization Heatmap
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          30-day usage patterns — spot dead zones and binge spikes 🔥
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: subscription picker */}
        <div className="card p-4 space-y-1.5 stagger-child" style={{ animationDelay: '0.10s' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-3 px-1">
            Select Subscription
          </h3>
          {subscriptions.map((sub) => {
            const subCph   = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
            const subScore = calcValueScore(sub.totalMinutes, sub.monthlyCost)
            const active   = selectedId === sub.id
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedId(sub.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200',
                  active
                    ? 'bg-violet-100 border border-violet-200 shadow-sm'
                    : 'hover:bg-violet-50 border border-transparent hover:translate-x-1'
                )}
              >
                <span className={clsx('text-xl transition-transform duration-200', active && 'scale-125')}>
                  {sub.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-bold font-display truncate', active ? 'text-violet-700' : 'text-gray-700')}>
                    {sub.name}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {subScore.toFixed(3)} · ${subCph === Infinity ? '∞' : subCph}/hr
                  </p>
                </div>
                {shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH) && (
                  <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Right: heatmap + trend */}
        <div className="xl:col-span-2 space-y-4">
          {selected && (
            <>
              {/* Snooze alert */}
              {snooze && (
                <div className="alert-snooze flex items-start gap-3 stagger-child">
                  <span className="text-2xl animate-wiggle">😴</span>
                  <div>
                    <p className="text-sm font-bold font-display text-amber-700">Snooze Suggestion</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {selected.name} costs{' '}
                      <span className="font-mono font-black">
                        ${cph === Infinity ? '∞' : cph}/hr
                      </span>{' '}
                      — above your ${profile.alertThresholdCPH}/hr threshold.
                      Consider pausing this one for a while!
                    </p>
                  </div>
                </div>
              )}

              {/* Heatmap card */}
              <div className="card p-5 stagger-child" style={{ animationDelay: '0.15s' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selected.icon}</span>
                    <div>
                      <h3 className="font-bold font-display text-gray-800">{selected.name}</h3>
                      <p className="text-xs text-gray-400">{selected.category} · ${selected.monthlyCost}/mo</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Chip label="Value Score" value={valueScore.toFixed(3)} color="violet" />
                    <Chip
                      label="Cost/hr"
                      value={`$${cph === Infinity ? '∞' : cph}`}
                      color={cph > profile.alertThresholdCPH ? 'red' : 'emerald'}
                    />
                    <Chip label="Hours/mo" value={(selected.totalMinutes / 60).toFixed(1)} color="slate" />
                  </div>
                </div>
                <UsageHeatmap usageLogs={selected.usageLogs} />
              </div>

              {/* 14-day trend */}
              <div className="card p-5 stagger-child" style={{ animationDelay: '0.20s' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold font-display text-gray-700">14-Day Usage Trend</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                    <Info className="w-3.5 h-3.5" /> Daily minutes
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
                    <defs>
                      <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter' }}
                      axisLine={false} tickLine={false} width={28}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <ReferenceLine y={avgMinutes} stroke="#c4b5fd" strokeDasharray="4 2" strokeWidth={1.5} />
                    <Line
                      type="monotone" dataKey="minutes"
                      stroke="url(#line-grad)" strokeWidth={2.5}
                      dot={{ fill: '#a855f7', r: 3.5, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#ec4899', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
