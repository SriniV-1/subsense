/**
 * All API calls for subscriptions, dashboard, and swap options.
 */
import { api } from './client.js'

export const fetchSubscriptions  = ()    => api.get('/api/subscriptions')
export const fetchSubscription   = (id)  => api.get(`/api/subscriptions/${id}`)
export const fetchUsageLogs      = (id)  => api.get(`/api/subscriptions/${id}/usage`)
export const fetchDashboard      = ()    => api.get('/api/dashboard')
export const fetchProfile        = ()    => api.get('/api/profile')
export const fetchSwapOptions    = ()    => api.get('/api/swap-options')

export const snoozeSubscription  = (id)  => api.post(`/api/subscriptions/${id}/snooze`)
export const cancelSubscription  = (id)  => api.post(`/api/subscriptions/${id}/cancel`)
