import React, { useEffect, useState } from 'react'
import { useApp } from '../context.jsx'
import { ShieldAlert, CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PEP_CATEGORIES = [
  'Heads of State, Heads of Government and Cabinet Ministers',
  'Influential Functionaries in Government',
  'Senior Judges',
  'Senior Political Party Functionaries',
  'Senior and/or Influential Officials, Functionaries and Military Leaders',
  'Member of Ruling Families',
  'Senior and/or Influential Representatives of Religious Organisations',
]

function StatusBadge({ status }) {
  const cfg = {
    pending:  { bg: '#fff7ed', color: '#c2410c', label: 'Pending Auth',  icon: <Clock size={12} /> },
    approved: { bg: '#f0fdf4', color: '#16a34a', label: 'Approved',      icon: <CheckCircle2 size={12} /> },
    rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected',      icon: <XCircle size={12} /> },
  }
  const s = cfg[status] || cfg.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>
      {s.icon} {s.label}
    </span>
  )
}

function PepFormDetail({ pepForm }) {
  if (!pepForm) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No PEP form data.</p>
  return (
    <div style={{ fontSize: '0.85rem' }}>
      <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8 }}>PEP Categories</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#111111' }}>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#fff', fontWeight: 600 }}>Category</th>
            <th style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, width: 60, textAlign: 'center' }}>YES</th>
            <th style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, width: 60, textAlign: 'center' }}>NO</th>
          </tr>
        </thead>
        <tbody>
          {PEP_CATEGORIES.map((cat, i) => {
            const val = pepForm.categories?.[cat]
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: val === true ? '#fef2f2' : val === false ? '#f0fdf4' : '#fff' }}>
                <td style={{ padding: '6px 10px', color: '#374151' }}>{cat}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: val === true ? '#dc2626' : '#d1d5db', fontWeight: 700 }}>{val === true ? '✓' : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: val === false ? '#16a34a' : '#d1d5db', fontWeight: 700 }}>{val === false ? '✓' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {pepForm.sourceOfFunds && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Source of Funds / Income</div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.875rem', color: '#374151', lineHeight: 1.6 }}>
            {pepForm.sourceOfFunds}
          </div>
        </div>
      )}

      {pepForm.transactionDetails && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Transaction Details</div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.875rem', color: '#374151', lineHeight: 1.6 }}>
            {pepForm.transactionDetails}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
        {pepForm.representative && <span><strong>Representative:</strong> {pepForm.representative}</span>}
        {pepForm.date && <span><strong>Date:</strong> {pepForm.date}</span>}
      </div>
    </div>
  )
}

function PartyRow({ party, currentUser, onDecision, onDismiss }) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)

  async function decide(action) {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/parties/${party.id}/pep-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note, managerId: currentUser.id }),
      })
      if (!res.ok) throw new Error('Request failed')
      const updated = await res.json()
      onDecision(updated)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden' }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldAlert size={20} color="#ea580c" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#0D0D0D', fontSize: '0.95rem' }}>
            {party.clientName || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unnamed client</span>}
            {party.role && <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem', marginLeft: 8 }}>— {party.role}</span>}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
            {party.transactionProperty || 'No property'} &nbsp;·&nbsp; {party.clientType || 'Unknown type'} &nbsp;·&nbsp; ID: {party.clientIdNumber || <span style={{ color: '#f59e0b' }}>not on record — edit client</span>}
          </div>
        </div>
        <StatusBadge status={party.pepAuthStatus} />
        {(!party.pepAuthStatus || party.pepAuthStatus === 'pending') && onDismiss && (
          <button
            onClick={e => { e.stopPropagation(); onDismiss(party.id) }}
            title="Remove PEP flag"
            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#dc2626' }}>
            <Trash2 size={14} />
          </button>
        )}
        <span style={{ color: '#94a3b8' }}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '1.25rem' }}>
          <PepFormDetail pepForm={party.pepForm} />

          {/* Auth decision panel — only for pending */}
          {party.pepAuthStatus === 'pending' && (
            <div style={{ marginTop: '1.25rem', background: '#f8fafc', borderRadius: 10, padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#111111', marginBottom: '0.75rem' }}>Manager Decision</div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note (optional for approval, recommended for rejection)…"
                rows={3}
                style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '0.875rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => decide('approve')}
                  disabled={saving}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.65rem', background: saving ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                  <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Approve Screening'}
                </button>
                <button
                  onClick={() => decide('reject')}
                  disabled={saving}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.65rem', background: saving ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                  <XCircle size={16} /> {saving ? 'Saving…' : 'Reject Screening'}
                </button>
              </div>
            </div>
          )}

          {/* Already decided */}
          {party.pepAuthStatus && party.pepAuthStatus !== 'pending' && (
            <div style={{ marginTop: '1.25rem', background: party.pepAuthStatus === 'approved' ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '1rem 1.25rem', border: `1px solid ${party.pepAuthStatus === 'approved' ? '#bbf7d0' : '#fecaca'}` }}>
              <div style={{ fontWeight: 700, color: party.pepAuthStatus === 'approved' ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                {party.pepAuthStatus === 'approved' ? '✓ Screening Approved' : '✗ Screening Rejected'}
              </div>
              {party.pepAuthNote && <div style={{ color: '#374151', fontSize: '0.85rem' }}>{party.pepAuthNote}</div>}
              {party.pepAuthAt && (
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>
                  {new Date(party.pepAuthAt).toLocaleString('en-ZA')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PepAuthorisations() {
  const { currentUser, parties, updateParty } = useApp()
  const [pendingList, setPendingList] = useState([])
  const [history, setHistory]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('pending')

  useEffect(() => {
    loadPending()
    // Initialise history once from parties already in context
    const decided = parties.filter(p => p.pepAuthStatus && p.pepAuthStatus !== 'pending')
    setHistory(decided.sort((a, b) => (b.pepAuthAt || '').localeCompare(a.pepAuthAt || '')))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPending() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/pep-pending`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPendingList(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleDecision(updated) {
    // Move from pending → history using only local state (no context sync needed)
    setPendingList(prev => prev.filter(p => p.id !== updated.id))
    setHistory(prev => [updated, ...prev.filter(p => p.id !== updated.id)])
    // Also persist to context so other pages see the new status
    updateParty(updated.id, {
      pepAuthStatus: updated.pepAuthStatus,
      pepAuthNote:   updated.pepAuthNote,
      pepAuthAt:     updated.pepAuthAt,
      pepAuthBy:     updated.pepAuthBy,
    })
  }

  async function handleDismiss(partyId) {
    if (!window.confirm('Remove this party from the PEP queue? This will delete the party record — you can re-add them to the transaction if needed.')) return
    try {
      const res = await fetch(`${API}/api/parties/${partyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Request failed')
      // Reload the full pending list to clear any other stale/orphaned entries
      await loadPending()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (currentUser?.role !== 'manager') {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#dc2626" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: '#0D0D0D', fontWeight: 700 }}>Access Restricted</h2>
        <p style={{ color: '#64748b' }}>Only managers can access the PEP Authorisation queue.</p>
      </div>
    )
  }

  const tabStyle = (t) => ({
    padding: '0.5rem 1.25rem',
    border: 'none',
    borderBottom: `3px solid ${tab === t ? '#111111' : 'transparent'}`,
    background: 'none',
    cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500,
    color: tab === t ? '#111111' : '#64748b',
    fontSize: '0.9rem',
  })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fff7ed', border: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="#ea580c" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0D0D0D', margin: 0 }}>PEP Authorisations</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>Review and authorise flagged PEP parties on transactions</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendingList.some(p => !p.clientName) && (
            <button onClick={async () => {
              if (!window.confirm('Delete all unnamed/orphaned entries from the PEP queue?')) return
              const res = await fetch(`${API}/api/pep-pending/stale`, { method: 'DELETE' })
              const data = await res.json()
              const total = (data.deleted_parties || 0) + (data.cleared_clients || 0)
              alert(`Cleared ${total} stale ${total === 1 ? 'entry' : 'entries'} (${data.deleted_parties} parties, ${data.cleared_clients} client records).`)
              loadPending()
            }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
              <Trash2 size={14} /> Purge stale
            </button>
          )}
          <button onClick={loadPending} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Pending Auth', value: pendingList.length, bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
          { label: 'Approved',     value: history.filter(p => p.pepAuthStatus === 'approved').length, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
          { label: 'Rejected',     value: history.filter(p => p.pepAuthStatus === 'rejected').length, bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
        ].map(({ label, value, bg, color, border }) => (
          <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '0.875rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color, fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
        <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
          Pending {pendingList.length > 0 && <span style={{ marginLeft: 4, background: '#ea580c', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem' }}>{pendingList.length}</span>}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>History</button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>Loading…</div>
      ) : tab === 'pending' ? (
        pendingList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <CheckCircle2 size={40} color="#16a34a" style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 600 }}>No pending PEP authorisations</div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>All flagged parties have been reviewed.</div>
          </div>
        ) : (
          pendingList.map(p => (
            <PartyRow key={p.id} party={p} currentUser={currentUser} onDecision={handleDecision} onDismiss={handleDismiss} />
          ))
        )
      ) : (
        history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <Clock size={36} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 600 }}>No authorisation history yet</div>
          </div>
        ) : (
          history.map(p => (
            <PartyRow key={p.id} party={p} currentUser={currentUser} onDecision={handleDecision} onDismiss={handleDismiss} />
          ))
        )
      )}
    </div>
  )
}
