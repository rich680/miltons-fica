import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API, apiFetch } from './api.js'

const AppContext = createContext(null)

const SESSION_KEY   = 'mm_session'
const TRUST_KEY     = 'mm_mfa_trust'

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export function AppProvider({ children }) {
  const [session, setSession]           = useState(loadSession)   // { token, user }
  const [clients, setClients]           = useState([])
  const [transactions, setTransactions] = useState([])
  const [parties, setParties]           = useState([])
  const [staffOverdue, setStaffOverdue] = useState(0)
  const [loading, setLoading]           = useState(false)

  const currentUser = session?.user || null

  const loadData = useCallback(async (user) => {
    if (!user) { setClients([]); setTransactions([]); setParties([]); return }
    setLoading(true)
    try {
      const params = `userId=${user.id}&role=${user.role}`
      const [cls, txs, pts, staffList] = await Promise.all([
        apiFetch(`/api/clients?${params}`),
        apiFetch(`/api/transactions?${params}`),
        apiFetch(`/api/parties?userId=${user.id}&role=${user.role}`),
        apiFetch('/api/agency-staff').catch(() => []),
      ])
      setClients(cls)
      setTransactions(txs)
      setParties(pts)
      const currentYear = new Date().getFullYear()
      const due = (staffList || []).filter(s => {
        if (s.status === 'archived') return false
        const lastYear = s.screenings?.[0]?.year
        return lastYear !== currentYear
      }).length
      setStaffOverdue(due)
    } catch (err) {
      console.warn('Could not load data from API:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData(currentUser) }, [currentUser, loadData])

  // ── Auth ───────────────────────────────────────────────────────────────────
  // Step 1: submit credentials → returns { mfa_required, challengeId, phone }
  //         or { token, user } if trust token is valid
  async function login(email, password) {
    const trustToken = localStorage.getItem(TRUST_KEY)
    const body = { email, password }
    if (trustToken) body.trustToken = trustToken
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data.token) {
      // Trust token bypassed MFA — full session
      _establishSession(data)
    }
    return data  // caller checks data.mfa_required
  }

  // Step 2: submit OTP → returns { token, user, trustToken? }
  async function verifyOTP(challengeId, code, trustDevice) {
    const data = await apiFetch('/api/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code, trustDevice }),
    })
    if (data.trustToken) {
      localStorage.setItem(TRUST_KEY, data.trustToken)
    }
    _establishSession(data)
    return data
  }

  function _establishSession(data) {
    const s = { token: data.token, user: data.user }
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }

  async function logout() {
    try {
      await apiFetch('/api/logout', { method: 'POST' })
    } catch { /* ignore */ }
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
    // Trust token intentionally kept — persists across logouts for 8h device trust
    setClients([]); setTransactions([]); setParties([]); setStaffOverdue(0)
  }

  // ── Actor helpers ──────────────────────────────────────────────────────────
  function actor() {
    return { actorId: currentUser?.id ?? null, actorName: currentUser?.name ?? null }
  }
  function actorQuery() {
    const u = currentUser
    if (!u) return ''
    return `actorId=${encodeURIComponent(u.id)}&actorName=${encodeURIComponent(u.name)}`
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  async function addClient(client) {
    try {
      const created = await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ ...client, agentId: currentUser?.id, ...actor() }),
      })
      setClients(prev => [created, ...prev])
      return created
    } catch (err) { console.error('addClient:', err.message) }
  }

  async function updateClient(id, updates) {
    try {
      const updated = await apiFetch(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, ...actor() }),
      })
      setClients(prev => prev.map(c => c.id === id ? updated : c))
    } catch (err) { console.error('updateClient:', err.message) }
  }

  async function deleteClient(id, clientName) {
    try {
      const q = actorQuery() + (clientName ? `&clientName=${encodeURIComponent(clientName)}` : '')
      await apiFetch(`/api/clients/${id}?${q}`, { method: 'DELETE' })
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (err) { console.error('deleteClient:', err.message) }
  }

  // ── Transactions ───────────────────────────────────────────────────────────
  async function addTransaction(tx) {
    try {
      const created = await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ ...tx, ...actor() }),
      })
      setTransactions(prev => [created, ...prev])
    } catch (err) { console.error('addTransaction:', err.message) }
  }

  async function updateTransaction(id, updates) {
    try {
      const updated = await apiFetch(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, ...actor() }),
      })
      setTransactions(prev => prev.map(t => t.id === id ? updated : t))
    } catch (err) { console.error('updateTransaction:', err.message) }
  }

  async function deleteTransaction(id, label) {
    try {
      const q = actorQuery() + (label ? `&label=${encodeURIComponent(label)}` : '')
      await apiFetch(`/api/transactions/${id}?${q}`, { method: 'DELETE' })
      setTransactions(prev => prev.filter(t => t.id !== id))
      setParties(prev => prev.filter(p => p.transactionId !== id))
    } catch (err) { console.error('deleteTransaction:', err.message) }
  }

  // ── Parties ────────────────────────────────────────────────────────────────
  async function addParty(data) {
    try {
      const created = await apiFetch('/api/parties', {
        method: 'POST',
        body: JSON.stringify({ ...data, ...actor() }),
      })
      setParties(prev => [created, ...prev])
      return created
    } catch (err) {
      console.error('addParty:', err.message)
      throw err
    }
  }

  async function updateParty(id, updates) {
    try {
      const updated = await apiFetch(`/api/parties/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, ...actor() }),
      })
      setParties(prev => prev.map(p => p.id === id ? updated : p))
      return updated
    } catch (err) { console.error('updateParty:', err.message) }
  }

  async function patchPartyNotes(id, notes) {
    try {
      await apiFetch(`/api/parties/${id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes, ...actor() }),
      })
      setParties(prev => prev.map(p => p.id === id ? { ...p, notes } : p))
    } catch (err) { console.error('patchPartyNotes:', err.message) }
  }

  async function patchDoc(partyId, docName, docData) {
    try {
      const updated = await apiFetch(`/api/parties/${partyId}/doc`, {
        method: 'PATCH',
        body: JSON.stringify({ docName, docData, ...actor() }),
      })
      setParties(prev => prev.map(p => p.id === partyId ? updated : p))
      return updated
    } catch (err) { console.error('patchDoc:', err.message) }
  }

  async function patchTxOtp(txId, docData) {
    try {
      const updated = await apiFetch(`/api/transactions/${txId}/otp`, {
        method: 'PATCH',
        body: JSON.stringify({ docData, ...actor() }),
      })
      setTransactions(prev => prev.map(t => t.id === txId ? updated : t))
      return updated
    } catch (err) { console.error('patchTxOtp:', err.message) }
  }

  function syncParty(updated) {
    setParties(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  async function deleteParty(id, label) {
    try {
      const q = actorQuery() + (label ? `&label=${encodeURIComponent(label)}` : '')
      await apiFetch(`/api/parties/${id}?${q}`, { method: 'DELETE' })
      setParties(prev => prev.filter(p => p.id !== id))
    } catch (err) { console.error('deleteParty:', err.message) }
  }

  return (
    <AppContext.Provider value={{
      currentUser, login, verifyOTP, logout, loading,
      clients, addClient, updateClient, deleteClient,
      transactions, addTransaction, updateTransaction, deleteTransaction, patchTxOtp,
      parties, addParty, updateParty, patchPartyNotes, patchDoc, syncParty, deleteParty,
      actor,
      staffOverdue,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
