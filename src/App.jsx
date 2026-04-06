import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import HeatmapModule from './components/HeatmapModule.jsx'
import SwapCalculator from './components/SwapCalculator.jsx'
import AISentinel from './components/AISentinel.jsx'
import { subscriptions as initialSubs, userProfile } from './data/mockData.js'
import { dropRecentUsage } from './data/generateUsage.js'

export default function App() {
  const [devMode, setDevMode] = useState(false)
  const [droppedIds, setDroppedIds] = useState([])

  // Dev mode: allow zeroing out recent usage to trigger sentinel
  const subscriptions = initialSubs.map((sub) => {
    if (devMode && droppedIds.includes(sub.id)) {
      return { ...sub, usageLogs: dropRecentUsage(sub.usageLogs, 10), totalMinutes: 0 }
    }
    return sub
  })

  function toggleDrop(id) {
    setDroppedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Navbar
        devMode={devMode}
        setDevMode={setDevMode}
        droppedIds={droppedIds}
        toggleDrop={toggleDrop}
        subscriptions={subscriptions}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  subscriptions={subscriptions}
                  profile={userProfile}
                  devMode={devMode}
                />
              }
            />
            <Route
              path="/heatmap"
              element={
                <HeatmapModule subscriptions={subscriptions} profile={userProfile} />
              }
            />
            <Route
              path="/swap"
              element={<SwapCalculator subscriptions={subscriptions} />}
            />
            <Route
              path="/sentinel"
              element={
                <AISentinel
                  subscriptions={subscriptions}
                  profile={userProfile}
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
