/**
 * Base fetch wrapper for the SubSense Spring Boot API.
 * Base URL is read from VITE_API_URL env var; falls back to localhost:8080.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  get:  (path)         => request(path),
  post: (path, body)   => request(path, { method: 'POST', body: JSON.stringify(body) }),
}
