/**
 * Synthetic usage log generator.
 * Creates realistic usage patterns with spikes, dips, and dead zones.
 */

import { subDays, format } from 'date-fns'

/**
 * Generate N days of daily usage logs.
 * @param {number} days         - How many days back to generate
 * @param {number} avgMinutes   - Average daily usage in minutes
 * @param {number} variance     - 0-1, how wildly usage swings
 * @param {number} skipChance   - 0-1, probability of a zero-usage day
 */
export function generateDailyUsage(days = 30, avgMinutes = 45, variance = 0.5, skipChance = 0.2) {
  const logs = []
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const skip = Math.random() < skipChance
    if (skip) {
      logs.push({ date, minutes: 0 })
    } else {
      // Box-Muller-ish approximation for Gaussian noise
      const u = Math.random() + Math.random() + Math.random() - 1.5
      const minutes = Math.max(0, Math.round(avgMinutes + u * avgMinutes * variance))
      logs.push({ date, minutes })
    }
  }
  return logs
}

/**
 * Simulate a binge-watch pattern — lots of use early, drops off.
 */
export function generateBingePattern(days = 30, peakMinutes = 120) {
  const logs = []
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    // Decay function: heavy use in days 20-30, taper toward today
    const decayFactor = Math.pow(i / days, 0.8)
    const minutes = Math.random() < 0.3
      ? 0
      : Math.round(peakMinutes * decayFactor * (0.7 + Math.random() * 0.6))
    logs.push({ date, minutes })
  }
  return logs
}

/**
 * Simulate a "ghost" subscription — almost never used.
 */
export function generateGhostPattern(days = 30) {
  const logs = []
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const active = Math.random() < 0.05  // only 5% chance of use
    logs.push({ date, minutes: active ? Math.round(10 + Math.random() * 20) : 0 })
  }
  return logs
}

/**
 * Simulate a "weekend warrior" pattern — only active on weekends.
 */
export function generateWeekendPattern(days = 30, avgMinutes = 90) {
  const logs = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(new Date(), i)
    const date = format(d, 'yyyy-MM-dd')
    const dow = d.getDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    if (isWeekend) {
      const minutes = Math.round(avgMinutes * (0.6 + Math.random() * 0.8))
      logs.push({ date, minutes })
    } else {
      logs.push({ date, minutes: 0 })
    }
  }
  return logs
}

/**
 * For the AI Sentinel dev-mode: zero out the last N days.
 */
export function dropRecentUsage(logs, zeroDays = 10) {
  return logs.map((entry, idx) => {
    if (idx >= logs.length - zeroDays) return { ...entry, minutes: 0 }
    return entry
  })
}

/** Compute total minutes from logs. */
export function totalMinutes(logs) {
  return logs.reduce((sum, l) => sum + l.minutes, 0)
}

/** Compute average daily minutes. */
export function avgDailyMinutes(logs) {
  if (logs.length === 0) return 0
  return totalMinutes(logs) / logs.length
}

/** Recent vs historical drop percentage (0-100). */
export function usageDropPercent(logs, recentDays = 7) {
  const recent = logs.slice(-recentDays)
  const historical = logs.slice(0, logs.length - recentDays)
  const recentAvg = avgDailyMinutes(recent)
  const historicalAvg = avgDailyMinutes(historical)
  if (historicalAvg === 0) return 0
  return Math.max(0, Math.round(((historicalAvg - recentAvg) / historicalAvg) * 100))
}
