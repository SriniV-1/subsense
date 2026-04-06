import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import HeatmapModule from './components/HeatmapModule.jsx'
import SwapCalculator from './components/SwapCalculator.jsx'
import AISentinel from './components/AISentinel.jsx'
import { fetchSubscriptions, fetchProfile } from './api/subscriptions.js'
import { dropRecentUsage } from './data/generateUsage.js'

export default function App() {
  const [subscriptions, setSubscriptions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [devMode, setDevMode] = useState(false)
  const [droppedIds, setDroppedIds] = useState([])

  useEffect(() => {
    Promise.all([fetchSubscriptions(), fetchProfile()])
      .then(([subs, prof]) => {
        setSubscriptions(subs)
        setProfile(prof)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Dev mode: zero out recent usage to trigger sentinel alerts
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
  if (error)   return <ErrorScreen message={error} />

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Navbar
        devMode={devMode}
        setDevMode={setDevMode}
        droppedIds={droppedIds}
        toggleDrop={toggleDrop}
        subscriptions={displayedSubs}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={<Dashboard subscriptions={displayedSubs} profile={profile} devMode={devMode} />}
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
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-400 text-sm">Loading SubSense...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="card p-8 max-w-md text-center">
        <p className="text-2xl mb-3">⚠️</p>
        <p className="text-slate-200 font-semibold mb-2">Could not reach the API</p>
        <p className="text-slate-500 text-sm font-mono">{message}</p>
        <p className="text-slate-600 text-xs mt-4">
          Make sure the Spring Boot backend is running on port 8080.
        </p>
      </div>
    </div>
  )
}
