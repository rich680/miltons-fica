export const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getToken() {
  try { return JSON.parse(localStorage.getItem('mm_session'))?.token || null } catch { return null }
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
