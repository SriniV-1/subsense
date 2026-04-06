import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Flame, TrendingDown, TrendingUp, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  calcValueScore,
  calcCostPerHour,
  heatmapColor,
  shouldSnooze,
} from '../utils/calculations.js'
import clsx from 'clsx'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildHeatmapGrid(usageLogs) {
  // Arrange 30 logs into rows of 7 (weeks)
  const padded = [...usageLogs]
  // Pad to fill last row
  while (padded.length % 7 !== 0) {
    padded.unshift({ date: null, minutes: -1 })
  }
  const weeks = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }
  return weeks
}

function HeatmapTooltip({ day }) {
  if (!day || day.date === null) return null
  return (
    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-700 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none shadow-xl border border-slate-600">
      <p className="font-semibold text-slate-200">
        {format(parseISO(day.date), 'MMM d, yyyy')}
      </p>
      <p className="text-slate-400">{day.minutes} min</p>
    </div>
  )
}

function UsageHeatmap({ usageLogs }) {
  const [hovered, setHovered] = useState(null)
  const grid = useMemo(() => buildHeatmapGrid(usageLogs), [usageLogs])

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-500 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Heatmap cells */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((day, di) => (
            <div
              key={di}
              className="relative"
              onMouseEnter={() => day.date && setHovered(`${wi}-${di}`)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={clsx(
                  'heatmap-cell w-full aspect-square',
                  day.minutes === -1
                    ? 'opacity-0 pointer-events-none'
                    : heatmapColor(day.minutes)
                )}
              />
              {hovered === `${wi}-${di}` && <HeatmapTooltip day={day} />}
            </div>
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-slate-500">Less</span>
        {[0, 15, 45, 90, 150].map((m, i) => (
          <div key={i} className={clsx('w-4 h-4 rounded-sm', heatmapColor(m))} />
        ))}
        <span className="text-[10px] text-slate-500">More</span>
      </div>
    </div>
  )
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{payload[0]?.payload?.date}</p>
      <p className="text-violet-400 font-semibold">{payload[0]?.value} min</p>
    </div>
  )
}

export default function HeatmapModule({ subscriptions, profile }) {
  const [selectedId, setSelectedId] = useState(subscriptions[0]?.id)

  const selected = subscriptions.find((s) => s.id === selectedId)

  const cph = selected ? calcCostPerHour(selected.monthlyCost, selected.totalMinutes) : 0
  const valueScore = selected
    ? calcValueScore(selected.totalMinutes, selected.monthlyCost)
    : 0
  const snooze = selected
    ? shouldSnooze(selected.monthlyCost, selected.totalMinutes, profile.alertThresholdCPH)
    : false

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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-400" />
          Utilization Heatmap
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          30-day usage patterns — spot dead zones and binge spikes
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Subscription selector */}
        <div className="card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Select Subscription
          </h3>
          {subscriptions.map((sub) => {
            const subCph = calcCostPerHour(sub.monthlyCost, sub.totalMinutes)
            const subScore = calcValueScore(sub.totalMinutes, sub.monthlyCost)
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedId(sub.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150',
                  selectedId === sub.id
                    ? 'bg-violet-600/20 border border-violet-500/30'
                    : 'hover:bg-slate-800 border border-transparent'
                )}
              >
                <span className="text-lg">{sub.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{sub.name}</p>
                  <p className="text-xs text-slate-500">
                    Score: {subScore.toFixed(3)} · ${subCph === Infinity ? '∞' : subCph}/hr
                  </p>
                </div>
                {shouldSnooze(sub.monthlyCost, sub.totalMinutes, profile.alertThresholdCPH) && (
                  <span className="text-amber-500 shrink-0">⚠</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Heatmap + details */}
        <div className="xl:col-span-2 space-y-4">
          {selected && (
            <>
              {/* Snooze Alert */}
              {snooze && (
                <div className="alert-snooze flex items-start gap-3">
                  <span className="text-xl shrink-0">😴</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">
                      Snooze Suggestion
                    </p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      {selected.name} costs{' '}
                      <span className="font-mono font-bold">
                        ${cph === Infinity ? '∞' : cph}/hr
                      </span>{' '}
                      — above your ${profile.alertThresholdCPH}/hr threshold. Consider pausing
                      this subscription until you're using it more actively.
                    </p>
                  </div>
                </div>
              )}

              {/* Heatmap card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{selected.icon}</span>
                    <div>
                      <h3 className="font-semibold text-slate-200">{selected.name}</h3>
                      <p className="text-xs text-slate-500">{selected.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Chip label="Value Score" value={valueScore.toFixed(3)} color="violet" />
                    <Chip
                      label="Cost/hr"
                      value={`$${cph === Infinity ? '∞' : cph}`}
                      color={cph > profile.alertThresholdCPH ? 'red' : 'emerald'}
                    />
                    <Chip
                      label="Hours/mo"
                      value={(selected.totalMinutes / 60).toFixed(1)}
                      color="slate"
                    />
                  </div>
                </div>

                <UsageHeatmap usageLogs={selected.usageLogs} />
              </div>

              {/* 14-day trend */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300">14-Day Usage Trend</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Info className="w-3 h-3" />
                    Daily minutes
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <ReferenceLine
                      y={avgMinutes}
                      stroke="#8b5cf6"
                      strokeDasharray="4 2"
                      strokeOpacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#a78bfa' }}
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

function Chip({ label, value, color }) {
  const colors = {
    violet: 'bg-violet-500/10 text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    slate: 'bg-slate-700/60 text-slate-300',
    amber: 'bg-amber-500/10 text-amber-400',
  }
  return (
    <div className={clsx('px-2.5 py-1.5 rounded-lg text-center', colors[color])}>
      <p className="font-mono text-sm font-bold">{value}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{label}</p>
    </div>
  )
}
