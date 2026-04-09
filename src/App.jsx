import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import HeatmapModule from './components/HeatmapModule.jsx'
import SwapCalculator from './components/SwapCalculator.jsx'
import AISentinel from './components/AISentinel.jsx'
import InvestmentTracker from './components/InvestmentTracker.jsx'
import FlaggedView from './components/FlaggedView.jsx'
import RenewalCalendar from './components/RenewalCalendar.jsx'
import Onboarding, { shouldShowOnboarding } from './components/Onboarding.jsx'
import { fetchSubscriptions, fetchProfile } from './api/subscriptions.js'
import { subscriptions as mockSubs, userProfile as mockProfile } from './data/mockData.js'
import { dropRecentUsage } from './data/generateUsage.js'

export default function App() {
  const [subscriptions, setSubscriptions] = useState([])
  const [profile, setProfile]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [devMode, setDevMode]             = useState(false)
  const [droppedIds, setDroppedIds]       = useState([])

  // ── Centralized investment state (shared across Dashboard, Sentinel, Tracker) ──
  const [investments, setInvestments] = useState([])
  const [snoozedIds,  setSnoozedIds]  = useState(new Set())
  const [showOnboarding, setShowOnboarding] = useState(false)

  function addInvestment(sub, trade) {
    setInvestments(prev => {
      if (prev.some(inv => inv.subId === sub.id)) return prev   // idempotent
      return [...prev, {
        id:          trade.tradeId,
        subId:       sub.id,
        subName:     sub.name,
        subIcon:     sub.icon,
        monthlyCost: sub.monthlyCost,
        trade,
        routedAt:    new Date().toISOString(),
      }]
    })
  }

  function addSnooze(id) {
    setSnoozedIds(prev => new Set([...prev, id]))
  }

  // sweptSubIds = investment-backed snoozes only (drives InvestmentTracker)
  // inactiveIds = all removed from active spend (swept + snooze-only)
  const sweptSubIds = new Set(investments.map(inv => inv.subId))
  const inactiveIds = new Set([...sweptSubIds, ...snoozedIds])

  useEffect(() => {
    Promise.all([fetchSubscriptions(), fetchProfile()])
      .then(([subs, prof]) => {
        setSubscriptions(subs)
        setProfile(prof)
      })
      .catch(() => {
        setSubscriptions(mockSubs)
        setProfile(mockProfile)
      })
      .finally(() => {
        setLoading(false)
        setShowOnboarding(shouldShowOnboarding())
      })
  }, [])

  const displayedSubs = subscriptions.map((sub) => {
    if (devMode && droppedIds.includes(sub.id)) {
      const zeroed = dropRecentUsage(sub.usageLogs, 10)
      return { ...sub, usageLogs: zeroed, totalMinutes: 0 }
    }
    return sub
  })

  function toggleDrop(id) {
    setDroppedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (loading) return <LoadingScreen />

  if (showOnboarding && displayedSubs.length > 0 && profile) {
    return (
      <Onboarding
        subscriptions={displayedSubs}
        profile={profile}
        onDone={() => setShowOnboarding(false)}
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Navbar
        devMode={devMode}
        setDevMode={setDevMode}
        droppedIds={droppedIds}
        toggleDrop={toggleDrop}
        subscriptions={displayedSubs}
        sweptSubIds={inactiveIds}
        profile={profile}
        investmentCount={investments.length}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  subscriptions={displayedSubs}
                  profile={profile}
                  devMode={devMode}
                  sweptSubIds={inactiveIds}
                  investments={investments}
                  onInvest={addInvestment}
                  onSnooze={addSnooze}
                />
              }
            />
            <Route
              path="/heatmap"
              element={<HeatmapModule subscriptions={displayedSubs} profile={profile} />}
            />
            <Route
              path="/swap"
              element={<SwapCalculator subscriptions={displayedSubs} />}
            />
            <Route
              path="/sentinel"
              element={
                <AISentinel
                  subscriptions={displayedSubs}
                  profile={profile}
                  devMode={devMode}
                  droppedIds={droppedIds}
                  toggleDrop={toggleDrop}
                  sweptSubIds={inactiveIds}
                  onInvest={addInvestment}
                />
              }
            />
            <Route
              path="/investments"
              element={<InvestmentTracker investments={investments} subscriptions={displayedSubs} />}
            />
            <Route
              path="/flagged"
              element={
                <FlaggedView
                  subscriptions={displayedSubs}
                  profile={profile}
                  sweptSubIds={inactiveIds}
                  investments={investments}
                  onInvest={addInvestment}
                />
              }
            />
            <Route
              path="/calendar"
              element={
                <RenewalCalendar
                  subscriptions={displayedSubs}
                  sweptSubIds={inactiveIds}
                  profile={profile}
                  onInvest={addInvestment}
                />
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div
          className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 mx-auto mb-4 animate-bounce"
          style={{ boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}
        />
        <p className="text-violet-600 text-sm font-bold">Loading SubSense...</p>
        <p className="text-gray-400 text-xs mt-1">Crunching your subscription data</p>
      </div>
    </div>
  )
}
