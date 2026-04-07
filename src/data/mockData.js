/**
 * mockData.js — 20-subscription catalog mirroring MockDataService.java.
 * Used as offline fallback when the Spring Boot backend is unavailable.
 */

import { addDays, format } from 'date-fns'
import {
  generateDailyUsage,
  generateBingePattern,
  generateGhostPattern,
  generateWeekendPattern,
  generateBingeAbandonPattern,
} from './generateUsage.js'

// ─── Swap marketplace items ────────────────────────────────────────────────────
export const swapOptions = [
  { id: 'bus',     name: 'Campus Bus Pass', unitCost: 5.00,  icon: '🚌', category: 'Transport' },
  { id: 'coffee',  name: 'Premium Coffee',  unitCost: 6.50,  icon: '☕', category: 'Food' },
  { id: 'audible', name: 'Audible Credit',  unitCost: 14.95, icon: '🎧', category: 'Education' },
  { id: 'gym',     name: 'Day Gym Pass',    unitCost: 10.00, icon: '💪', category: 'Health' },
  { id: 'kindle',  name: 'Kindle eBook',    unitCost: 9.99,  icon: '📚', category: 'Education' },
  { id: 'lunch',   name: 'Campus Lunch',    unitCost: 8.00,  icon: '🥗', category: 'Food' },
]

// ─── Subscription catalog (mirrors MockDataService.java) ───────────────────────
const catalog = [
  // Entertainment × 6 — heavy overlap alert
  { id: 'netflix',    name: 'Netflix',          category: 'Entertainment', monthlyCost: 15.49,
    accentColor: '#E50914', icon: '🎬', tier: 'Standard',    renewalOffset: 3,  usagePattern: 'binge',        avgMinutes: 95  },
  { id: 'disney',     name: 'Disney+',           category: 'Entertainment', monthlyCost: 13.99,
    accentColor: '#0063E5', icon: '✨', tier: 'Basic',        renewalOffset: 1,  usagePattern: 'ghost',        avgMinutes: 0   },
  { id: 'hulu',       name: 'Hulu',              category: 'Entertainment', monthlyCost: 17.99,
    accentColor: '#3DBB3D', icon: '📺', tier: 'No Ads',       renewalOffset: 2,  usagePattern: 'ghost',        avgMinutes: 0   },
  { id: 'prime',      name: 'Amazon Prime',      category: 'Entertainment', monthlyCost:  8.99,
    accentColor: '#FF9900', icon: '📦', tier: 'Video',         renewalOffset: 5,  usagePattern: 'daily',        avgMinutes: 60  },
  { id: 'appletv',    name: 'Apple TV+',         category: 'Entertainment', monthlyCost:  9.99,
    accentColor: '#555555', icon: '🍎', tier: 'Standard',      renewalOffset: 1,  usagePattern: 'ghost',        avgMinutes: 0   },
  { id: 'youtube',    name: 'YouTube Premium',   category: 'Entertainment', monthlyCost: 13.99,
    accentColor: '#FF0000', icon: '▶️', tier: 'Individual',    renewalOffset: 14, usagePattern: 'daily',        avgMinutes: 130 },

  // Music
  { id: 'spotify',    name: 'Spotify',           category: 'Music',         monthlyCost: 10.99,
    accentColor: '#1DB954', icon: '🎵', tier: 'Premium',       renewalOffset: 7,  usagePattern: 'daily',        avgMinutes: 80  },

  // AI Tools × 2 — overlap alert
  { id: 'chatgpt',    name: 'ChatGPT Plus',      category: 'AI Tools',      monthlyCost: 20.00,
    accentColor: '#10A37F', icon: '🤖', tier: 'Plus',          renewalOffset: 12, usagePattern: 'daily',        avgMinutes: 55  },
  { id: 'claudepro',  name: 'Claude Pro',        category: 'AI Tools',      monthlyCost: 20.00,
    accentColor: '#D97706', icon: '⚡', tier: 'Pro',           renewalOffset: 20, usagePattern: 'daily',        avgMinutes: 70  },

  // Dev Tools
  { id: 'github',     name: 'GitHub Copilot',    category: 'Dev Tools',     monthlyCost: 10.00,
    accentColor: '#6e40c9', icon: '👾', tier: 'Individual',    renewalOffset: 18, usagePattern: 'weekend',      avgMinutes: 110 },

  // Productivity × 2 — overlap alert
  { id: 'notion',     name: 'Notion',            category: 'Productivity',  monthlyCost:  8.00,
    accentColor: '#333333', icon: '📝', tier: 'Plus',          renewalOffset: 22, usagePattern: 'daily',        avgMinutes: 40  },
  { id: 'grammarly',  name: 'Grammarly',         category: 'Productivity',  monthlyCost: 12.00,
    accentColor: '#15C39A', icon: '✍️', tier: 'Premium',       renewalOffset: 9,  usagePattern: 'daily',        avgMinutes: 30  },

  // Creative × 2 — overlap alert
  { id: 'adobe',      name: 'Adobe CC',          category: 'Creative',      monthlyCost: 54.99,
    accentColor: '#FF0000', icon: '🎨', tier: 'All Apps',      renewalOffset: 30, usagePattern: 'weekend',      avgMinutes: 70  },
  { id: 'canva',      name: 'Canva Pro',         category: 'Creative',      monthlyCost: 12.99,
    accentColor: '#00C4CC', icon: '🖌️', tier: 'Pro',          renewalOffset: 28, usagePattern: 'weekend',      avgMinutes: 80  },

  // Professional — dead weight
  { id: 'linkedin',   name: 'LinkedIn Premium',  category: 'Professional',  monthlyCost: 39.99,
    accentColor: '#0077B5', icon: '💼', tier: 'Career',        renewalOffset: 8,  usagePattern: 'ghost',        avgMinutes: 0   },

  // Fitness — binge-abandon
  { id: 'peloton',    name: 'Peloton Digital',   category: 'Fitness',       monthlyCost: 12.99,
    accentColor: '#E62440', icon: '🚴', tier: 'App',           renewalOffset: 11, usagePattern: 'bingeAbandon', avgMinutes: 90  },

  // Wellness — dead weight + sentinel (renews in 2 days)
  { id: 'calm',       name: 'Calm',              category: 'Wellness',      monthlyCost:  9.99,
    accentColor: '#4A90D9', icon: '🧘', tier: 'Premium',       renewalOffset: 2,  usagePattern: 'ghost',        avgMinutes: 0   },

  // Storage — chronic low usage
  { id: 'dropbox',    name: 'Dropbox Plus',      category: 'Storage',       monthlyCost: 11.99,
    accentColor: '#0061FF', icon: '📁', tier: 'Plus',          renewalOffset: 17, usagePattern: 'daily',        avgMinutes: 4   },

  // Education — binge-abandon
  { id: 'duolingo',   name: 'Duolingo Plus',     category: 'Education',     monthlyCost:  6.99,
    accentColor: '#58CC02', icon: '🦜', tier: 'Plus',          renewalOffset: 25, usagePattern: 'bingeAbandon', avgMinutes: 45  },

  // Security — dead weight
  { id: 'expressvpn', name: 'ExpressVPN',        category: 'Security',      monthlyCost:  8.32,
    accentColor: '#DA1E28', icon: '🔒', tier: 'Annual/12',     renewalOffset: 6,  usagePattern: 'ghost',        avgMinutes: 0   },
]

// ─── Build usage logs per pattern ─────────────────────────────────────────────
function buildLogs(sub) {
  switch (sub.usagePattern) {
    case 'binge':        return generateBingePattern(30, sub.avgMinutes || 90)
    case 'ghost':        return generateGhostPattern(30)
    case 'weekend':      return generateWeekendPattern(30, sub.avgMinutes || 80)
    case 'bingeAbandon': return generateBingeAbandonPattern(30, sub.avgMinutes || 75)
    case 'daily':
    default:             return generateDailyUsage(30, sub.avgMinutes || 45, 0.5, 0.2)
  }
}

export const subscriptions = catalog.map((sub) => {
  const usageLogs   = buildLogs(sub)
  const renewalDate = format(addDays(new Date(), sub.renewalOffset), 'yyyy-MM-dd')
  return {
    ...sub,
    bgGradient: `from-slate-800/30 to-slate-900`,
    usageLogs,
    renewalDate,
    totalMinutes: usageLogs.reduce((s, l) => s + l.minutes, 0),
  }
})

export const subscriptionMap = Object.fromEntries(subscriptions.map((s) => [s.id, s]))

export const userProfile = {
  name:                 'Alex Chen',
  email:                'alex@devsws.io',
  avatarInitials:       'AC',
  monthlyBudget:        350,
  alertThresholdCPH:    15,
  sentinelDropThreshold: 50,
}
