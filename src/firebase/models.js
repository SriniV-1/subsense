/**
 * firebase/models.js
 * Firestore data models + CRUD helpers for SubSense.
 *
 * Collections
 * ───────────
 * users/{userId}                    — profile + settings
 * users/{userId}/subscriptions/{id} — one doc per subscription
 * users/{userId}/usageLogs/{id}     — daily usage entries (sub-collection per day)
 *
 * Drop these helpers anywhere you need Firestore access and pass the `db`
 * instance imported from ./config.js
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'

// ─── Data shape reference (mirrors mockData.js) ───────────────────────────────

/**
 * @typedef {Object} UserProfile
 * @property {string}  uid
 * @property {string}  name
 * @property {string}  email
 * @property {string}  avatarInitials
 * @property {number}  monthlyBudget
 * @property {number}  alertThresholdCPH     — cost-per-hour snooze trigger ($)
 * @property {number}  sentinelDropThreshold — usage-drop % for AI alert
 * @property {Timestamp} createdAt
 * @property {Timestamp} updatedAt
 */

/**
 * @typedef {Object} Subscription
 * @property {string}    id             — auto or human-readable slug
 * @property {string}    name
 * @property {string}    category       — e.g. "Entertainment"
 * @property {number}    monthlyCost    — USD
 * @property {string}    accentColor    — hex
 * @property {string}    icon           — emoji
 * @property {string}    tier           — e.g. "Premium"
 * @property {string}    renewalDate    — ISO date string "yyyy-MM-dd"
 * @property {string}    usagePattern   — "daily" | "binge" | "ghost" | "weekend"
 * @property {boolean}   isSnoozed
 * @property {boolean}   isCancelled
 * @property {Timestamp} createdAt
 * @property {Timestamp} updatedAt
 */

/**
 * @typedef {Object} UsageLog
 * @property {string}    subscriptionId
 * @property {string}    date           — "yyyy-MM-dd"
 * @property {number}    minutes        — session duration
 * @property {number}    sessions       — number of logins that day
 * @property {Timestamp} createdAt
 */

// ─── User helpers ──────────────────────────────────────────────────────────────

export async function getUser(db, uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function upsertUser(db, uid, profile) {
  const ref = doc(db, 'users', uid)
  await setDoc(
    ref,
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true }
  )
}

// ─── Subscription helpers ──────────────────────────────────────────────────────

export function subsCollection(db, uid) {
  return collection(db, 'users', uid, 'subscriptions')
}

export async function getSubscriptions(db, uid) {
  const snap = await getDocs(subsCollection(db, uid))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getSubscription(db, uid, subId) {
  const snap = await getDoc(doc(db, 'users', uid, 'subscriptions', subId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function addSubscription(db, uid, subscription) {
  const ref = await addDoc(subsCollection(db, uid), {
    ...subscription,
    isSnoozed: false,
    isCancelled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateSubscription(db, uid, subId, partial) {
  await updateDoc(doc(db, 'users', uid, 'subscriptions', subId), {
    ...partial,
    updatedAt: serverTimestamp(),
  })
}

export async function snoozeSubscription(db, uid, subId) {
  await updateSubscription(db, uid, subId, { isSnoozed: true })
}

export async function cancelSubscription(db, uid, subId) {
  await updateSubscription(db, uid, subId, { isCancelled: true })
}

export async function deleteSubscription(db, uid, subId) {
  await deleteDoc(doc(db, 'users', uid, 'subscriptions', subId))
}

// ─── Usage log helpers ─────────────────────────────────────────────────────────

export function logsCollection(db, uid, subId) {
  return collection(db, 'users', uid, 'subscriptions', subId, 'usageLogs')
}

/**
 * Fetch the last N days of usage logs for a subscription.
 */
export async function getRecentLogs(db, uid, subId, days = 30) {
  const q = query(
    logsCollection(db, uid, subId),
    orderBy('date', 'desc'),
    limit(days)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()
}

/**
 * Write or overwrite a usage log entry for a specific date.
 * Uses the date string as the doc ID so upserts are idempotent.
 */
export async function upsertUsageLog(db, uid, subId, { date, minutes, sessions }) {
  const ref = doc(db, 'users', uid, 'subscriptions', subId, 'usageLogs', date)
  await setDoc(ref, {
    subscriptionId: subId,
    date,
    minutes: minutes ?? 0,
    sessions: sessions ?? 0,
    createdAt: serverTimestamp(),
  })
}

/**
 * Seed Firestore with synthetic data from mockData.js.
 * Call once from a dev utility — not in production flow.
 *
 * Usage:
 *   import { db } from './config'
 *   import { subscriptions } from '../data/mockData'
 *   import { seedSubscriptions } from './models'
 *   await seedSubscriptions(db, 'YOUR_UID', subscriptions)
 */
export async function seedSubscriptions(db, uid, subscriptions) {
  for (const sub of subscriptions) {
    const { usageLogs, totalMinutes, normScore, valueScore, cph, snooze, dead, grade, ...subData } = sub
    const subId = await addSubscription(db, uid, subData)
    for (const log of usageLogs) {
      await upsertUsageLog(db, uid, subId, { date: log.date, minutes: log.minutes, sessions: log.sessions ?? 0 })
    }
  }
  console.info(`[SubSense] Seeded ${subscriptions.length} subscriptions to Firestore.`)
}
