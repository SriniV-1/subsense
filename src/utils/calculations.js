/**
 * calculations.js — Core analytics math for SubSense.
 */

import { differenceInDays, parseISO } from 'date-fns'

/**
 * Value Score = Usage Frequency (sessions) / Monthly Cost
 * Higher is better.
 */
export function calcValueScore(totalMinutes, monthlyCost) {
  if (monthlyCost <= 0) return 0
  const hours = totalMinutes / 60
  return parseFloat((hours / monthlyCost).toFixed(3))
}

/**
 * Cost-per-Hour = Monthly Cost / Total Hours Used
 * Lower is better. Returns Infinity when unused.
 */
export function calcCostPerHour(monthlyCost, totalMinutes) {
  if (totalMinutes <= 0) return Infinity
  const hours = totalMinutes / 60
  return parseFloat((monthlyCost / hours).toFixed(2))
}

/**
 * Return a 0-100 "utility score" (normalized across the entire portfolio).
 * Used for the radial gauge / card badges.
 */
export function normalizeScores(subscriptions) {
  const scores = subscriptions.map((s) => calcValueScore(s.totalMinutes, s.monthlyCost))
  const max = Math.max(...scores, 0.001)
  return scores.map((sc) => Math.round((sc / max) * 100))
}

/**
 * Is the subscription "dead weight"?
 * Dead weight = no usage in the last deadDays calendar days.
 */
export function isDeadWeight(usageLogs, deadDays = 30) {
  const recent = usageLogs.slice(-deadDays)
  return recent.every((l) => l.minutes === 0)
}

/**
 * Days until renewal (from today).
 */
export function daysUntilRenewal(renewalDate) {
  return differenceInDays(parseISO(renewalDate), new Date())
}

/**
 * Compute the usage-drop percentage comparing recent vs. historical window.
 * recentDays: how many trailing days count as "recent"
 * Returns 0-100+.
 */
export function usageDropPercent(usageLogs, recentDays = 7) {
  if (usageLogs.length < recentDays + 1) return 0
  const recent = usageLogs.slice(-recentDays)
  const historical = usageLogs.slice(0, usageLogs.length - recentDays)

  const recentAvg = recent.reduce((s, l) => s + l.minutes, 0) / recent.length
  const historicalAvg = historical.reduce((s, l) => s + l.minutes, 0) / historical.length

  if (historicalAvg === 0) return 0
  return Math.max(0, Math.round(((historicalAvg - recentAvg) / historicalAvg) * 100))
}

/**
 * Snooze alert: should we suggest pausing this subscription?
 * Returns true if cost-per-hour > threshold.
 */
export function shouldSnooze(monthlyCost, totalMinutes, thresholdCPH = 15) {
  const cph = calcCostPerHour(monthlyCost, totalMinutes)
  return cph > thresholdCPH
}

/**
 * Sentinel alert: should we fire 48-hr renewal warning?
 * Conditions: renewal within 48 hours AND usage drop > threshold%.
 */
export function sentinelShouldAlert(renewalDate, usageLogs, dropThreshold = 50) {
  const days = daysUntilRenewal(renewalDate)
  const drop = usageDropPercent(usageLogs)
  return days <= 2 && drop >= dropThreshold
}

/**
 * How many units of a swap item can the sub cost buy?
 */
export function calcSwapUnits(subCost, swapUnitCost) {
  return Math.floor(subCost / swapUnitCost)
}

/**
 * Total monthly spend for a portfolio.
 */
export function totalMonthlySpend(subscriptions) {
  return subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0)
}

/**
 * Heatmap color intensity class (Tailwind) based on minutes.
 */
export function heatmapColor(minutes) {
  if (minutes === 0) return 'bg-slate-800'
  if (minutes < 20) return 'bg-violet-950'
  if (minutes < 45) return 'bg-violet-800'
  if (minutes < 90) return 'bg-violet-600'
  if (minutes < 150) return 'bg-violet-500'
  return 'bg-violet-400'
}

/**
 * Grade label for a value score (0-100 normalized).
 */
export function valueGrade(normalizedScore) {
  if (normalizedScore >= 80) return { label: 'Excellent', color: 'text-emerald-400' }
  if (normalizedScore >= 60) return { label: 'Good', color: 'text-green-400' }
  if (normalizedScore >= 40) return { label: 'Fair', color: 'text-amber-400' }
  if (normalizedScore >= 20) return { label: 'Poor', color: 'text-orange-400' }
  return { label: 'Dead Weight', color: 'text-red-400' }
}
