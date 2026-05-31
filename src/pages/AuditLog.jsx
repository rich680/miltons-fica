import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context.jsx'
import { ClipboardList, Search, Filter, Download, RefreshCw, User, Shield, FileText, Trash2, LogIn, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

// ── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  LOGIN:           { label: 'Login',              color: '#6366f1', bg: '#eef2ff', icon: LogIn },
  CLIENT_CREATED:  { label: 'Client Created',     color: '#16a34a', bg: '#f0fdf4', icon: User },
  CLIENT_UPDATED:  { label: 'Client Updated',     color: '#0891b2', bg: '#ecfeff', icon: User },
  CLIENT_DELETED:  { label: 'Client Deleted',     color: '#dc2626', bg: '#fef2f2', icon: Trash2 },
  TX_CREATED:      { label: 'Transaction Created',color: '#2563eb', bg: '#fff7ed', icon: FileText },
  TX_UPDATED:      { label: 'Transaction Updated',color: '#0891b2', bg: '#ecfeff', icon: FileText },
  TX_DELETED:      { label: 'Transaction Deleted',color: '#dc2626', bg: '#fef2f2', icon: Trash2 },
  PARTY_ADDED:     { label: 'Party Added',        color: '#0891b2', bg: '#ecfeff', icon: User },
  PARTY_REMOVED:   { label: 'Party Removed',      color: '#dc2626', bg: '#fef2f2', icon: Trash2 },
  FIC_SEARCH:      { label: 'FIC Search',         color: '#7c3aed', bg: '#f5f3ff', icon: Shield },
  UN_SEARCH:       { label: 'UN Search',          color: '#7c3aed', bg: '#f5f3ff', icon: Shield },
  SCREENING_SAVED: { label: 'Screening Saved',    color: '#059669', bg: '#ecfdf5', icon: CheckCircle2 },
  RISK_RATED:      { label: 'Risk Rated',         color: '#d97706', bg: '#fffbeb', icon: AlertTriangle },
  PEP_FLAGGED:     { label: 'PEP Flagged',        color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
  PEP_APPROVED:    { label: 'PEP Approved',       color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  PEP_REJECTED:    { label: 'PEP Rejected',       color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
  DOC_UPLOADED:    { label: 'Document Uploaded',  color: '#2563eb', bg: '#fff7ed', icon: Upload },
  DOC_VERIFIED:    { label: 'Document Verified',  color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  DOC_DELETED:     { label: 'Document Deleted',   color: '#dc2626', bg: '#fef2f2', icon: Trash2 },
  OTP_UPLOADED:    { label: 'OTP/Lease Uploaded', color: '#2563eb', bg: '#fff7ed', icon: Upload },
  OTP_VERIFIED:    { label: 'OTP/Lease Verified', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  OTP_DELETED:     { label: 'OTP/Lease Deleted',  color: '#dc2626', bg: '#fef2f2', icon: Trash2 },
  OTP_UPDATED:     { label: 'OTP/Lease Updated',  color: '#0891b2', bg: '#ecfeff', icon: Upload },
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, color: '#64748b', bg: '#f1f5f9', icon: ClipboardList }
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 20,
      background: meta.bg, color: meta.color,
      fontSize: '0.75rem', fontWeight: 700,
      border: `1px solid ${meta.color}30`,
    }}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

function formatDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Category groups for filter ────────────────────────────────────────────────
const ACTION_GROUPS = [
  { label: 'All actions', value: '' },
  { label: 'Logins', value: 'LOGIN' },
  { label: 'Clients', value: '__client' },
  { label: 'Transactions', value: '__tx' },
  { label: 'Parties', value: '__party' },
  { label: 'Screening (FIC/UN)', value: '__screen' },
  { label: 'Risk Rating', value: 'RISK_RATED' },
  { label: 'PEP', value: '__pep' },
  { label: 'Documents', value: '__doc' },
]

const GROUP_ACTIONS = {
  __client: ['CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED'],
  __tx:     ['TX_CREATED', 'TX_UPDATED', 'TX_DELETED'],
  __party:  ['PARTY_ADDED', 'PARTY_REMOVED'],
  __screen: ['FIC_SEARCH', 'UN_SEARCH', 'SCREENING_SAVED'],
  __pep:    ['PEP_FLAGGED', 'PEP_APPROVED', 'PEP_REJECTED'],
  __doc:    ['DOC_UPLOADED', 'DOC_VERIFIED', 'DOC_DELETED', 'OTP_UPLOADED', 'OTP_VERIFIED', 'OTP_DELETED', 'OTP_UPDATED'],
}

function matchesGroup(row, group) {
  if (!group) return true
  if (GROUP_ACTIONS[group]) return GROUP_ACTIONS[group].includes(row.action)
  return row.action === group
}

export default function AuditLog() {
  const { currentUser } = useApp()
  const isManager = currentUser?.role === 'manager'

  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  async function fetchLogs() {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (!isManager) { params.set('userId', currentUser?.id); params.set('role', 'agent') }
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo)   params.set('dateTo', dateTo)
      params.set('limit', '1000')
      const data = await fetch(`${API}/api/audit?${params}`).then(r => r.json())
      if (Array.isArray(data)) setLogs(data)
      else throw new Error(data.error || 'Failed to load')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, []) // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(row => {
      if (!matchesGroup(row, filterGroup)) return false
      if (q && !(
        (row.userName || '').toLowerCase().includes(q) ||
        (row.entityLabel || '').toLowerCase().includes(q) ||
        (row.detail || '').toLowerCase().includes(q) ||
        (ACTION_META[row.action]?.label || row.action).toLowerCase().includes(q)
      )) return false
      return true
    })
  }, [logs, search, filterGroup])

  function exportCSV() {
    const header = ['Date/Time', 'User', 'Action', 'Entity', 'Detail']
    const rows = filtered.map(r => [
      formatDT(r.createdAt),
      r.userName,
      ACTION_META[r.action]?.label || r.action,
      r.entityLabel || '',
      r.detail || '',
    ])
    const csv = [header, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit_log_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const card = { background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '1rem 1.25rem' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={22} color="#16a34a" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0D0D0D' }}>Audit Trail</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              {isManager ? 'All user activity' : 'Your activity'} — FICA compliance record
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchLogs} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button onClick={exportCSV} disabled={filtered.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e77204', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: '1rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="User, entity or detail…"
              style={{ width: '100%', paddingLeft: 30, padding: '0.5rem 0.75rem 0.5rem 30px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Category</label>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: '#fff' }}>
            {ACTION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }} />
        </div>
        <button onClick={fetchLogs} style={{ background: '#e77204', border: 'none', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} /> Apply
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total events', value: filtered.length },
          { label: 'FIC / UN searches', value: filtered.filter(r => r.action === 'FIC_SEARCH' || r.action === 'UN_SEARCH').length },
          { label: 'PEP actions', value: filtered.filter(r => r.action.startsWith('PEP_')).length },
          { label: 'Docs verified', value: filtered.filter(r => r.action === 'DOC_VERIFIED' || r.action === 'OTP_VERIFIED').length },
        ].map(s => (
          <div key={s.label} style={{ ...card, flex: 1, minWidth: 110, padding: '0.75rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0D0D0D' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {error && (
          <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: '0.9rem', borderBottom: '1px solid #fecaca' }}>
            ⚠ {error}
          </div>
        )}
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>Loading audit log…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <ClipboardList size={40} style={{ marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>{logs.length === 0 ? 'No audit entries yet' : 'No results match your filters'}</div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Events are logged automatically as you use the portal</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Date / Time', 'User', 'Action', 'Entity / Subject', 'Detail'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8rem' }}>
                      {formatDT(row.createdAt)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={12} color="#4f46e5" />
                        </div>
                        <span style={{ fontWeight: 600, color: '#1f1f1f', fontSize: '0.82rem' }}>{row.userName || 'System'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                      <ActionBadge action={row.action} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#374151', maxWidth: 260 }}>
                      <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.entityLabel || <span style={{ color: '#94a3b8' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.detail || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#94a3b8', background: '#f8fafc' }}>
              Showing {filtered.length} of {logs.length} entries{logs.length >= 1000 ? ' (limit 1000)' : ''}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
