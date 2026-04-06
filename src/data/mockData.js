/**
 * mockData.js — Synthetic subscription + usage data.
 * All usage logs are generated at module load time so they're consistent
 * within a session but "fresh" relative to today's date.
 */

import { addDays, format, subDays } from 'date-fns'
import {
  generateDailyUsage,
  generateBingePattern,
  generateGhostPattern,
  generateWeekendPattern,
} from './generateUsage.js'

// ─── Swap marketplace items ────────────────────────────────────────────────────
export const swapOptions = [
  { id: 'bus', name: 'Campus Bus Pass', unitCost: 5.0, icon: '🚌', category: 'Transport' },
  { id: 'coffee', name: 'Premium Coffee', unitCost: 6.5, icon: '☕', category: 'Food' },
  { id: 'audible', name: 'Audible Credit', unitCost: 14.95, icon: '🎧', category: 'Education' },
  { id: 'gym', name: 'Day Gym Pass', unitCost: 10.0, icon: '💪', category: 'Health' },
  { id: 'kindle', name: 'Kindle eBook', unitCost: 9.99, icon: '📚', category: 'Education' },
  { id: 'lunch', name: 'Campus Lunch', unitCost: 8.0, icon: '🥗', category: 'Food' },
]

// ─── Raw subscription catalog ──────────────────────────────────────────────────
const catalog = [
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'Entertainment',
    monthlyCost: 15.49,
    accentColor: '#E50914',
    bgGradient: 'from-red-900/30 to-slate-900',
    icon: '🎬',
    tier: 'Standard',
    renewalOffset: 3,       // days from today
    usagePattern: 'binge',
    avgMinutes: 95,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Music',
    monthlyCost: 10.99,
    accentColor: '#1DB954',
    bgGradient: 'from-green-900/30 to-slate-900',
    icon: '🎵',
    tier: 'Premium',
    renewalOffset: 7,
    usagePattern: 'daily',
    avgMinutes: 80,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    category: 'AI Tools',
    monthlyCost: 20.0,
    accentColor: '#10A37F',
    bgGradient: 'from-emerald-900/30 to-slate-900',
    icon: '🤖',
    tier: 'Plus',
    renewalOffset: 12,
    usagePattern: 'daily',
    avgMinutes: 55,
  },
  {
    id: 'disney',
    name: 'Disney+',
    category: 'Entertainment',
    monthlyCost: 13.99,
    accentColor: '#0063E5',
    bgGradient: 'from-blue-900/30 to-slate-900',
    icon: '✨',
    tier: 'Basic',
    renewalOffset: 1,       // renews TOMORROW — sentinel should fire
    usagePattern: 'ghost',
    avgMinutes: 0,
  },
  {
    id: 'github',
    name: 'GitHub Copilot',
    category: 'Dev Tools',
    monthlyCost: 10.0,
    accentColor: '#6e40c9',
    bgGradient: 'from-purple-900/30 to-slate-900',
    icon: '👾',
    tier: 'Individual',
    renewalOffset: 18,
    usagePattern: 'weekend',
    avgMinutes: 110,
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    monthlyCost: 8.0,
    accentColor: '#ffffff',
    bgGradient: 'from-slate-700/30 to-slate-900',
    icon: '📝',
    tier: 'Plus',
    renewalOffset: 22,
    usagePattern: 'daily',
    avgMinutes: 40,
  },
  {
    id: 'hulu',
    name: 'Hulu',
    category: 'Entertainment',
    monthlyCost: 17.99,
    accentColor: '#3DBB3D',
    bgGradient: 'from-lime-900/30 to-slate-900',
    icon: '📺',
    tier: 'No Ads',
    renewalOffset: 2,       // renews in 2 days — sentinel territory
    usagePattern: 'ghost',
    avgMinutes: 0,
  },
  {
    id: 'adobe',
    name: 'Adobe CC',
    category: 'Creative',
    monthlyCost: 54.99,
    accentColor: '#FF0000',
    bgGradient: 'from-orange-900/30 to-slate-900',
    icon: '🎨',
    tier: 'All Apps',
    renewalOffset: 30,
    usagePattern: 'weekend',
    avgMinutes: 70,
  },
]

// ─── Generate usage logs ───────────────────────────────────────────────────────
function buildLogs(sub) {
  switch (sub.usagePattern) {
    case 'binge':
      return generateBingePattern(30, sub.avgMinutes || 90)
    case 'ghost':
      return generateGhostPattern(30)
    case 'weekend':
      return generateWeekendPattern(30, sub.avgMinutes || 80)
    case 'daily':
    default:
      return generateDailyUsage(30, sub.avgMinutes || 45, 0.5, 0.15)
  }
}

// ─── Compose final subscription objects ──────────────────────────────────────
export const subscriptions = catalog.map((sub) => {
  const usageLogs = buildLogs(sub)
  const renewalDate = format(addDays(new Date(), sub.renewalOffset), 'yyyy-MM-dd')
  return {
    ...sub,
    usageLogs,
    renewalDate,
    // Pre-computed so components don't all recalc
    totalMinutes: usageLogs.reduce((s, l) => s + l.minutes, 0),
  }
})

// ─── Convenience lookup ───────────────────────────────────────────────────────
export const subscriptionMap = Object.fromEntries(subscriptions.map((s) => [s.id, s]))

// ─── User profile (mock) ──────────────────────────────────────────────────────
export const userProfile = {
  name: 'Alex Chen',
  email: 'alex@devsws.io',
  avatarInitials: 'AC',
  monthlyBudget: 150,
  alertThresholdCPH: 15,   // Cost-per-hour threshold ($15/hr)
  sentinelDropThreshold: 50, // % usage drop that triggers alert
}
