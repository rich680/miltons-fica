import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context.jsx'
import { DOC_LIST } from '../store.js'
import { useBreakpoint } from '../hooks/useBreakpoint.js'
import Pagination from '../components/Pagination.jsx'
import { Plus, X, Edit2, ArrowLeft, Users, CheckCircle2, Trash2, ChevronDown, ChevronUp, Search, AlertTriangle, UserPlus, Upload, Download, ShieldCheck, FileText } from 'lucide-react'

const TX_TYPES    = ['Residential Purchase', 'Commercial Purchase', 'Rental', 'Off-plan / Development']
const TX_STATUSES = ['In Progress', 'Completed', 'Cancelled', 'On Hold']
const PARTY_ROLES = ['Buyer', 'Co-Buyer', 'Seller', 'Co-Seller', 'Landlord', 'Tenant', 'Power of Attorney', 'Trustee', 'Executor']
const CLIENT_TYPES = ['Individual SA', 'Individual Foreign', 'SA Company / CC', 'Foreign Company', 'Trust', 'Partnership', 'Government Entity']
const RESCREEN_MONTHS = 12

const inp = { width: '100%', padding: '0.6rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', background: '#fff' }
const lbl = { display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.85rem', color: '#374151' }

const ROLE_COLORS = {
  'Buyer': '#c56003', 'Co-Buyer': '#2563eb',
  'Seller': '#be185d', 'Co-Seller': '#db2777',
  'Landlord': '#15803d', 'Tenant': '#16a34a',
  'Power of Attorney': '#b45309', 'Trustee': '#d97706',
  'Executor': '#7e22ce',
}

const TX_STATUS_MAP = {
  'In Progress': { bg: '#fff7ed', color: '#c56003' },
  'Completed':   { bg: '#f0fdf4', color: '#15803d' },
  'Cancelled':   { bg: '#fef2f2', color: '#dc2626' },
  'On Hold':     { bg: '#fffbeb', color: '#d97706' },
}

function monthsAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44))
}

function lastScreeningForClient(clientId, allParties) {
  const screened = allParties.filter(p => p.clientId === clientId && p.screeningDate)
  if (!screened.length) return null
  screened.sort((a, b) => new Date(b.screeningDate) - new Date(a.screeningDate))
  return screened[0]
}

// Normalise a doc slot — supports legacy boolean true as well as the new object format
function normaliseDoc(val) {
  if (!val) return null
  if (val === true) return { status: 'uploaded', filename: 'Document on file', data: null, uploadedAt: null, verifiedAt: null }
  return val
}

function docStatusColor(val) {
  const d = normaliseDoc(val)
  if (!d) return { bg: '#f8fafc', border: '#e2e8f0', dot: '#cbd5e1', label: 'Not uploaded', labelColor: '#94a3b8' }
  if (d.status === 'verified') return { bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', label: 'Verified', labelColor: '#166534' }
  return { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', label: 'Uploaded', labelColor: '#92400e' }
}

function StatusBadge({ status }) {
  const map = { clear: ['#f0fdf4','#16a34a'], flagged: ['#fef2f2','#dc2626'], pending: ['#fffbeb','#d97706'] }
  const [bg, color] = map[status] || ['#f1f5f9','#64748b']
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {status || 'pending'}
    </span>
  )
}

function TxModal({ title, fv, setFv, onSubmit, onClose, saving }) {
  const set = k => e => setFv(p => ({ ...p, [k]: e.target.value }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={lbl}>Property Address</label>
            <input value={fv.property} onChange={set('property')} style={inp} placeholder="e.g. 12 Oak Street, Sandton" />
          </div>
          <div>
            <label style={lbl}>Transaction Type</label>
            <select value={fv.type} onChange={set('type')} style={inp}>
              {TX_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Value (ZAR)</label>
            <input type="number" value={fv.value} onChange={set('value')} style={inp} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select value={fv.status} onChange={set('status')} style={inp}>
              {TX_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={fv.notes || ''} onChange={set('notes')} style={{ ...inp, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} placeholder="Compliance or transaction notes…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={onSubmit} disabled={saving} style={{ flex: 2, padding: '0.65rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddPartyModal({ clients, allParties, existingClientIds, onAdd, onClose, saving }) {
  const [query, setQuery]           = useState('')
  const [selected, setSelected]     = useState(null)
  const [role, setRole]             = useState(PARTY_ROLES[0])
  const [mode, setMode]             = useState('search')
  const [showResults, setShowResults] = useState(false)
  const [newClient, setNewClient]   = useState({ name: '', idNumber: '', type: CLIENT_TYPES[0] })

  const available = useMemo(() =>
    clients.filter(c => !existingClientIds.includes(c.id)),
    [clients, existingClientIds]
  )

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return available.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.idNumber || '').toLowerCase().includes(q)
    ).slice(0, 6)
  }, [query, available])

  const rescreenWarning = useMemo(() => {
    if (!selected) return null
    const last = lastScreeningForClient(selected.id, allParties)
    if (!last) return null
    const months = monthsAgo(last.screeningDate)
    if (months === null || months < RESCREEN_MONTHS) return null
    return { months, txId: last.transactionId }
  }, [selected, allParties])

  function selectClient(c) {
    setSelected(c)
    setQuery(c.name)
    setShowResults(false)
    setMode('search')
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setShowResults(false)
  }

  function handleAdd() {
    if (mode === 'create') {
      onAdd(null, role, newClient)
    } else {
      if (!selected) return
      onAdd(selected.id, role, null)
    }
  }

  const canSubmit = mode === 'create'
    ? newClient.name.trim().length > 0
    : selected !== null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Add Party</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'search' && (
            <div>
              <label style={lbl}>Search client by name or ID number</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(null); setShowResults(true) }}
                  onFocus={() => setShowResults(true)}
                  style={{ ...inp, paddingLeft: '2rem' }}
                  placeholder="Type name or ID…"
                  autoFocus
                />
                {query && (
                  <button onClick={clearSelection} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {showResults && query.trim() && (
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {results.length > 0 ? (
                    results.map(c => (
                      <div
                        key={c.id}
                        onClick={() => selectClient(c)}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0D0D0D' }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 1 }}>{c.type} · {c.idNumber || 'No ID on file'}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.75rem 0.875rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                      No match for "{query}"
                    </div>
                  )}
                  <div
                    onClick={() => { setMode('create'); setNewClient(f => ({ ...f, name: query })); setShowResults(false) }}
                    style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #e2e8f0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <UserPlus size={14} color="#c56003" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c56003' }}>Create new client "{query}"</span>
                  </div>
                </div>
              )}

              {selected && (
                <div style={{ marginTop: 8, padding: '0.625rem 0.875rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#166534' }}>{selected.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 1 }}>{selected.type} · {selected.idNumber || 'No ID on file'}</div>
                  </div>
                  <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 2 }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {rescreenWarning && (
                <div style={{ marginTop: 8, padding: '0.625rem 0.875rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                    <strong>Re-screening recommended</strong> — last screened {rescreenWarning.months} months ago. A fresh screening should be completed for this transaction.
                  </div>
                </div>
              )}

              {!query && (
                <button
                  onClick={() => setMode('create')}
                  style={{ marginTop: 8, width: '100%', padding: '0.55rem', background: 'none', border: '1.5px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <UserPlus size={14} /> Create new client instead
                </button>
              )}
            </div>
          )}

          {mode === 'create' && (
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0D0D0D' }}>New Client Details</span>
                <button onClick={() => setMode('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Search size={12} /> Search instead
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ ...lbl, fontSize: '0.8rem' }}>Full Name *</label>
                  <input
                    value={newClient.name}
                    onChange={e => setNewClient(f => ({ ...f, name: e.target.value }))}
                    style={inp}
                    placeholder="e.g. John Smith"
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: '0.8rem' }}>ID / Passport / Registration No.</label>
                  <input
                    value={newClient.idNumber}
                    onChange={e => setNewClient(f => ({ ...f, idNumber: e.target.value }))}
                    style={inp}
                    placeholder="e.g. 8001015009087"
                  />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: '0.8rem' }}>Client Type</label>
                  <select value={newClient.type} onChange={e => setNewClient(f => ({ ...f, type: e.target.value }))} style={inp}>
                    {CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Role in Transaction</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
              {PARTY_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!canSubmit || saving}
            style={{ flex: 2, padding: '0.65rem', background: !canSubmit ? '#cbd5e1' : '#111111', color: '#fff', border: 'none', borderRadius: 8, cursor: !canSubmit ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {saving ? 'Adding…' : mode === 'create' ? 'Create & Add Party' : 'Add Party'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DocRow({ docName, docValue, onUpload, onVerify, onDelete, uploading }) {
  const fileRef = useRef(null)
  const d = normaliseDoc(docValue)
  const col = docStatusColor(docValue)

  const MAX_BYTES = 20 * 1024 * 1024 // 20 MB hard limit

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      alert(`File too large (${(file.size/1024/1024).toFixed(1)} MB). Maximum is 20 MB.`)
      e.target.value = ''
      return
    }
    e.target.value = ''
    onUpload(docName, file)
  }

  function handleDownload() {
    if (!d) return
    const href = d.url || d.data
    if (!href) return
    const a = document.createElement('a')
    a.href = href
    a.target = '_blank'
    a.download = d.filename || docName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.625rem 0.875rem', background: col.bg, borderRadius: 8, border: `1.5px solid ${col.border}` }}>
      {/* Status dot + name */}
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{docName}</div>
        {d && (
          <div style={{ fontSize: '0.72rem', color: col.labelColor, marginTop: 1 }}>
            {d.status === 'verified' ? `Verified${d.verifiedAt ? ' · ' + d.verifiedAt : ''}` : `Uploaded${d.uploadedAt ? ' · ' + d.uploadedAt : ''}`}
            {d.filename && d.filename !== 'Document on file' ? ` · ${d.filename}` : ''}
          </div>
        )}
        {!d && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>Not uploaded</div>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {d && (d.url || d.data) && (
          <button
            onClick={handleDownload}
            title="Download"
            style={{ background: '#fff7ed', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#c56003', display: 'flex', alignItems: 'center' }}
          >
            <Download size={13} />
          </button>
        )}
        {d && d.status === 'uploaded' && (
          <button
            onClick={() => onVerify(docName)}
            title="Mark as verified"
            style={{ background: '#f0fdf4', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <CheckCircle2 size={12} /> Verify
          </button>
        )}
        {d && d.status === 'verified' && (
          <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Verified
          </span>
        )}
        {d && (
          <button
            onClick={() => { if (window.confirm(`Remove "${docName}"?`)) onDelete(docName) }}
            title="Delete document"
            style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={12} />
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={d ? 'Replace document' : 'Upload document'}
          style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: uploading ? 'not-allowed' : 'pointer', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Upload size={12} /> {d ? 'Replace' : 'Upload'}
        </button>
      </div>
    </div>
  )
}


function OtpLeaseCard({ tx, onUpload, onVerify, onDelete, uploading }) {
  const fileRef = useRef(null)
  const d = normaliseDoc(tx.otpLease)
  const col = docStatusColor(tx.otpLease)
  const docName = 'Signed OTP / Lease'

  const MAX_BYTES = 20 * 1024 * 1024

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      alert(`File too large (${(file.size/1024/1024).toFixed(1)} MB). Maximum is 20 MB.`)
      e.target.value = ''
      return
    }
    e.target.value = ''
    onUpload(file)
  }

  function handleDownload() {
    if (!d) return
    const href = d.url || d.data
    if (!href) return
    const a = document.createElement('a')
    a.href = href
    a.target = '_blank'
    a.download = d.filename || docName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={{ background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0D0D0D' }}>Signed OTP / Lease</div>
        {d ? (
          <div style={{ fontSize: '0.72rem', color: col.labelColor, marginTop: 1 }}>
            {d.status === 'verified' ? `Verified${d.verifiedAt ? ' · ' + d.verifiedAt : ''}` : `Uploaded${d.uploadedAt ? ' · ' + d.uploadedAt : ''}`}
            {d.filename && d.filename !== 'Document on file' ? ` · ${d.filename}` : ''}
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>Transaction document — upload once for all parties</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        {d && (d.url || d.data) && (
          <button onClick={handleDownload} title="Download" style={{ background: '#fff7ed', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#c56003', display: 'flex', alignItems: 'center' }}>
            <Download size={13} />
          </button>
        )}
        {d && d.status === 'uploaded' && (
          <button onClick={onVerify} title="Mark as verified" style={{ background: '#f0fdf4', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Verify
          </button>
        )}
        {d && d.status === 'verified' && (
          <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Verified
          </span>
        )}
        {d && (
          <button onClick={() => { if (window.confirm('Remove OTP/Lease document?')) onDelete() }} title="Delete" style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={12} />
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} title={d ? 'Replace document' : 'Upload'} style={{ background: '#111111', border: 'none', borderRadius: 6, padding: '0.3rem 0.75rem', cursor: uploading ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Upload size={12} /> {d ? 'Replace' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

function PartyNotesTab({ party, onPatchNotes }) {
  const { currentUser } = useApp()
  const [localNotes, setLocalNotes] = React.useState(party.notes || '')
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  // keep local state in sync if party prop changes (e.g. after refetch)
  React.useEffect(() => { setLocalNotes(party.notes || '') }, [party.notes])

  async function handleBlur() {
    if (localNotes === (party.notes || '')) return   // no change
    setSaving(true)
    await onPatchNotes(party.id, localNotes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '0.875rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Party Notes</span>
        {saving && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Saving…</span>}
        {!saving && saved && <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>Saved ✓</span>}
      </div>
      <textarea
        value={localNotes}
        onChange={e => setLocalNotes(e.target.value)}
        onBlur={handleBlur}
        rows={5}
        placeholder="Compliance notes, source of funds detail, PEP context…"
        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#0D0D0D' }}
      />
      <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0' }}>Auto-saves when you click away</p>
    </div>
  )
}

function PartyCard({ party, allParties, onRemove, onPatchDoc, onPartyUpdated, onPatchNotes }) {
  const { currentUser } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('compliance')
  const [uploading, setUploading] = useState(false)
  const docs = party.docs || {}

  // Source of Funds Declaration is only required for PEP-designated parties
  const isPep = party.pepStatus === 'flagged' ||
    (party.riskCriteria?.pepStatus && party.riskCriteria.pepStatus !== 'Not a PEP') ||
    party.pepAuthStatus != null
  const partyDocList = DOC_LIST.filter(d => d !== 'Source of Funds Declaration' || isPep)

  const docsUploaded = partyDocList.filter(d => normaliseDoc(docs[d])).length
  const anyFlagged = party.ficStatus === 'flagged' || party.unStatus === 'flagged' || party.pepStatus === 'flagged' || party.adverseMediaStatus === 'flagged'
  const allClear   = party.ficStatus === 'clear' && party.unStatus === 'clear' && party.pepStatus === 'clear' && party.adverseMediaStatus === 'clear'
  const roleColor  = ROLE_COLORS[party.role] || '#64748b'
  const overallStatus = anyFlagged ? 'flagged' : allClear ? 'clear' : 'pending'

  const lastScreened = useMemo(() => lastScreeningForClient(party.clientId, allParties), [party.clientId, allParties])
  const rescreenMonths = lastScreened ? monthsAgo(lastScreened.screeningDate) : null
  const showRescreenBadge = rescreenMonths !== null && rescreenMonths >= RESCREEN_MONTHS

  // Doc summary badge color
  const docsVerified = partyDocList.filter(d => { const n = normaliseDoc(docs[d]); return n && n.status === 'verified' }).length
  const docBadgeColor = docsVerified === partyDocList.length ? '#16a34a' : docsUploaded > 0 ? '#d97706' : '#94a3b8'
  const docBadgeLabel = docsVerified === partyDocList.length
    ? `${docsVerified}/${partyDocList.length} verified`
    : docsUploaded > 0
      ? `${docsUploaded}/${partyDocList.length} uploaded`
      : `0/${partyDocList.length} docs`

  async function handleUpload(docName, file) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('docName', docName)
      if (currentUser?.id)   form.append('actorId',   currentUser.id)
      if (currentUser?.name) form.append('actorName', currentUser.name)
      const API = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${API}/api/parties/${party.id}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      onPartyUpdated(updated)
    } catch (err) {
      console.error('upload error:', err.message)
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleVerify(docName) {
    const existing = normaliseDoc(docs[docName]) || {}
    const updated = await onPatchDoc(party.id, docName, { ...existing, status: 'verified', verifiedAt: new Date().toISOString().slice(0, 10) })
    if (updated) onPartyUpdated(updated)
  }

  async function handleDelete(docName) {
    setUploading(true)
    try {
      // Fire-and-forget R2 cleanup — don't block UI on it
      const existing = normaliseDoc(docs[docName])
      if (existing?.key) {
        const API = import.meta.env.VITE_API_URL || ''
        fetch(`${API}/api/parties/${party.id}/doc-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: existing.key }),
        }).catch(e => console.warn('R2 cleanup failed:', e.message))
      }
      // Always clear the doc slot in the DB regardless
      const updated = await onPatchDoc(party.id, docName, null)
      if (updated) onPartyUpdated(updated)
    } catch (err) {
      console.error('handleDelete error:', err.message)
      alert('Delete failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${anyFlagged ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* ── Card header ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.875rem 1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>{party.clientName}</span>
            <span style={{ background: roleColor + '18', color: roleColor, padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>{party.role}</span>
            {showRescreenBadge && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>
                <AlertTriangle size={10} /> Re-screen {rescreenMonths}m
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{party.clientType} · {party.clientIdNumber || '—'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={overallStatus} />
          <span style={{ fontSize: '0.75rem', color: docBadgeColor, fontWeight: 600 }}>{docBadgeLabel}</span>
          <button onClick={() => setExpanded(e => !e)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onRemove(party.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }} title="Remove party">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────── */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>

          {/* Re-screening banner */}
          {showRescreenBadge && (
            <div style={{ margin: '0.875rem 1rem 0', padding: '0.5rem 0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.78rem', color: '#92400e' }}>
              <AlertTriangle size={13} color="#d97706" style={{ flexShrink: 0 }} />
              Last screened {rescreenMonths} months ago — re-screening recommended for this transaction.
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, padding: '0.75rem 1rem 0', borderBottom: '1px solid #e2e8f0' }}>
            {[
              { id: 'compliance', label: 'Compliance', icon: <ShieldCheck size={13} /> },
              { id: 'documents',  label: `Documents (${docsUploaded}/${partyDocList.length})`, icon: <FileText size={13} /> },
              { id: 'notes',      label: 'Notes', icon: <FileText size={13} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '0.5rem 1rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? '#111111' : '#64748b',
                  borderBottom: activeTab === tab.id ? '2px solid #111111' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── Compliance tab ──────────────────────────────── */}
          {activeTab === 'compliance' && (
            <div style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: '1rem' }}>
                {[['FIC', party.ficStatus], ['UN Sanctions', party.unStatus], ['PEP', party.pepStatus], ['Adverse Media', party.adverseMediaStatus]].map(([label, status]) => {
                  const dot = status === 'clear' ? '#22c55e' : status === 'flagged' ? '#ef4444' : '#f59e0b'
                  return (
                    <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 3 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{status || 'pending'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {party.riskRating && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Risk:{' '}
                  <span style={{
                    background: party.riskRating === 'High' ? '#fef2f2' : party.riskRating === 'Medium' ? '#fffbeb' : '#f0fdf4',
                    color: party.riskRating === 'High' ? '#dc2626' : party.riskRating === 'Medium' ? '#d97706' : '#16a34a',
                    padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700
                  }}>{party.riskRating}</span>
                  {party.riskScore && <span style={{ marginLeft: 6, fontWeight: 600 }}>{party.riskScore}/100</span>}
                </div>
              )}

              {(party.ficScreenshot || party.unScreenshot) && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Screening Evidence</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {party.ficScreenshot && (
                      <button
                        onClick={() => { const a = document.createElement('a'); a.href = party.ficScreenshot; a.download = `FIC_${(party.clientName||'client').replace(/[^a-zA-Z0-9]/g,'_')}.png`; a.click() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.75rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Download size={12} /> FIC Screenshot
                      </button>
                    )}
                    {party.unScreenshot && (
                      <button
                        onClick={() => { const a = document.createElement('a'); a.href = party.unScreenshot; a.download = `UN_${(party.clientName||'client').replace(/[^a-zA-Z0-9]/g,'_')}.png`; a.click() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.75rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Download size={12} /> UN Screenshot
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Documents tab ───────────────────────────────── */}
          {activeTab === 'documents' && (
            <div style={{ padding: '0.875rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Required Documents</span>
                {docsVerified === partyDocList.length && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                    <CheckCircle2 size={11} /> All verified
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {partyDocList.map(docName => (
                  <DocRow
                    key={docName}
                    docName={docName}
                    docValue={docs[docName]}
                    onUpload={handleUpload}
                    onVerify={handleVerify}
                    onDelete={handleDelete}
                    uploading={uploading}
                  />
                ))}
              </div>
            </div>
          )}
          {activeTab === 'notes' && (
            <PartyNotesTab party={party} onPatchNotes={onPatchNotes} />
          )}
        </div>
      )}
    </div>
  )
}

const BLANK_TX = { type: TX_TYPES[0], property: '', value: '', status: 'In Progress', notes: '' }

export default function Transactions() {
  const { isMobile } = useBreakpoint()
  const { currentUser, clients, transactions, parties, addClient, addTransaction, updateTransaction, deleteTransaction, patchTxOtp, addParty, updateParty, patchPartyNotes, patchDoc, syncParty, deleteParty } = useApp()
  const [selectedTxId, setSelectedTxId] = useState(null)
  const [showAdd,       setShowAdd]      = useState(false)
  const [editTx,        setEditTx]       = useState(null)
  const [addForm,       setAddForm]      = useState({ ...BLANK_TX })
  const [editForm,      setEditForm]     = useState({ ...BLANK_TX })
  const [showPartyAdd,  setShowPartyAdd] = useState(false)
  const [saving,        setSaving]       = useState(false)
  const [txSearch,      setTxSearch]     = useState('')
  const [clientFilter,  setClientFilter] = useState(null) // { id, name }
  const [txPage,        setTxPage]      = useState(0)
  const [txPageSize,    setTxPageSize]  = useState(10)

  // Read router state when navigating from Clients page
  const location = useLocation()
  useEffect(() => {
    if (location.state?.filterClientId) {
      setClientFilter({ id: location.state.filterClientId, name: location.state.filterClientName })
      // Clear router state so back-navigation doesn't re-apply filter
      window.history.replaceState({}, '')
    }
  }, [])

  const tx        = selectedTxId ? transactions.find(t => t.id === selectedTxId) : null
  const txParties = tx ? parties.filter(p => p.transactionId === tx.id) : []
  // Reset to page 1 when search or filter changes
  useEffect(() => { setTxPage(0) }, [txSearch, clientFilter])

  const filteredTxList = (() => {
    let list = transactions
    if (txSearch.trim()) list = list.filter(t => (t.property||'').toLowerCase().includes(txSearch.toLowerCase()))
    if (clientFilter) list = list.filter(t => parties.some(p => p.transactionId === t.id && p.clientId === clientFilter.id))
    return list
  })()
  const paginatedTxList = filteredTxList.slice(txPage * txPageSize, (txPage + 1) * txPageSize)

  async function handleAddTx() {
    setSaving(true)
    try {
      await addTransaction(addForm)
      setShowAdd(false)
      setAddForm({ ...BLANK_TX })
    } finally {
      setSaving(false)
    }
  }

  async function handleEditTx() {
    if (!editTx) return
    setSaving(true)
    try {
      await updateTransaction(editTx.id, editForm)
      setEditTx(null)
    } finally {
      setSaving(false)
    }
  }

  function openEdit(t, e) {
    if (e) e.stopPropagation()
    setSaving(false)
    setEditForm({ type: t.type, property: t.property || '', value: t.value ?? 0, status: t.status || 'In Progress', notes: t.notes || '' })
    setEditTx(t)
  }

  function handleQuickAddParty(txId, e) {
    if (e) e.stopPropagation()
    setSelectedTxId(txId)
    setShowPartyAdd(true)
  }

  async function handleAddParty(clientId, role, newClientData) {
    setSaving(true)
    try {
      let resolvedClientId = clientId
      if (!clientId && newClientData) {
        const created = await addClient(newClientData)
        if (!created) throw new Error('Failed to create client')
        resolvedClientId = created.id
      }
      if (!resolvedClientId) return
      await addParty({ transactionId: tx.id, clientId: resolvedClientId, role })
      setShowPartyAdd(false)
    } catch (err) {
      console.error('handleAddParty:', err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveParty(partyId) {
    if (!window.confirm('Remove this party from the transaction?')) return
    await deleteParty(partyId)
  }

  async function handleDeleteTx(t, e) {
    e.stopPropagation()
    const partyCount = parties.filter(p => p.transactionId === t.id).length
    const msg = partyCount > 0
      ? `Delete "${t.property || 'this transaction'}" and its ${partyCount} ${partyCount === 1 ? 'party' : 'parties'}? This cannot be undone.`
      : `Delete "${t.property || 'this transaction'}"? This cannot be undone.`
    if (!window.confirm(msg)) return
    await deleteTransaction(t.id, t.property || t.type)
  }

  if (tx) {
    const anyFlagged = txParties.some(p => p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged')
    const allClear   = txParties.length > 0 && txParties.every(p => p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear')
    const cs = TX_STATUS_MAP[tx.status] || TX_STATUS_MAP['In Progress']
    const existingClientIds = txParties.map(p => p.clientId)

    async function handleOtpUpload(file) {
      try {
        const form = new FormData()
        form.append('file', file)
        if (currentUser?.id)   form.append('actorId',   currentUser.id)
        if (currentUser?.name) form.append('actorName', currentUser.name)
        const API = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${API}/api/transactions/${tx.id}/upload-otp`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(await res.text())
        const updated = await res.json()
        updateTransaction(tx.id, updated)
      } catch (err) { alert('Upload failed: ' + err.message) }
    }

    async function handleOtpVerify() {
      const existing = normaliseDoc(tx.otpLease) || {}
      await patchTxOtp(tx.id, { ...existing, status: 'verified', verifiedAt: new Date().toISOString().slice(0, 10) })
    }

    async function handleOtpDelete() {
      const existing = normaliseDoc(tx.otpLease)
      if (existing?.key) {
        const API = import.meta.env.VITE_API_URL || ''
        fetch(`${API}/api/parties/0/doc-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: existing.key }),
        }).catch(e => console.warn('R2 cleanup:', e.message))
      }
      await patchTxOtp(tx.id, null)
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedTxId(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151', flexShrink: 0 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>{tx.property || '(No address)'}</h1>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>{tx.type} · R {Number(tx.value || 0).toLocaleString('en-ZA')}</div>
          </div>
          <span style={{ background: cs.bg, color: cs.color, padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem' }}>{tx.status}</span>
          <button onClick={e => openEdit(tx, e)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#374151', flexShrink: 0 }}>
            <Edit2 size={14} /> Edit
          </button>
          <button onClick={async () => {
            if (!window.confirm(`Delete "${tx.property || 'this transaction'}" and all its parties? This cannot be undone.`)) return
            await deleteTransaction(tx.id)
            setSelectedTxId(null)
          }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: 'none', borderRadius: 8, padding: '0.5rem 0.875rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#dc2626', flexShrink: 0 }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>

        <OtpLeaseCard
          tx={tx}
          onUpload={handleOtpUpload}
          onVerify={handleOtpVerify}
          onDelete={handleOtpDelete}
          uploading={false}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
              Parties{' '}
              <span style={{ background: '#fff7ed', color: '#c56003', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, marginLeft: 4 }}>{txParties.length}</span>
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
              Compliance: <StatusBadge status={anyFlagged ? 'flagged' : allClear ? 'clear' : 'pending'} />
            </div>
          </div>
          <button onClick={() => setShowPartyAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            <Plus size={15} /> Add Party
          </button>
        </div>

        {txParties.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', border: '1.5px dashed #e2e8f0' }}>
            <Users size={36} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <p style={{ color: '#94a3b8', margin: '0 0 14px' }}>No parties added yet.</p>
            <button onClick={() => setShowPartyAdd(true)} style={{ background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              Add first party
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {txParties.map(p => (
              <PartyCard key={p.id} party={p} allParties={parties} onRemove={handleRemoveParty} onPatchDoc={patchDoc} onPartyUpdated={syncParty} onPatchNotes={patchPartyNotes} />
            ))}
          </div>
        )}

        {editTx && <TxModal title="Edit Transaction" fv={editForm} setFv={setEditForm} onSubmit={handleEditTx} onClose={() => setEditTx(null)} saving={saving} />}
        {showPartyAdd && (
          <AddPartyModal
            clients={clients}
            allParties={parties}
            existingClientIds={existingClientIds}
            onAdd={handleAddParty}
            onClose={() => setShowPartyAdd(false)}
            saving={saving}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.75rem' : 0 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D' }}>Transactions</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 2 }}>Manage property transactions and their parties. {isMobile ? 'Tap to open.' : 'Click a row to open.'}</p>
        </div>
        <button onClick={() => { setAddForm({ ...BLANK_TX }); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600, alignSelf: isMobile ? 'stretch' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start' }}>
          <Plus size={16} /> New Transaction
        </button>
      </div>

      {/* Client filter banner */}
      {clientFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.5rem 0.875rem', fontSize: '0.82rem', color: '#c56003', fontWeight: 600, marginBottom: '0.75rem' }}>
          <Users size={13} />
          Showing transactions for: <span style={{ fontWeight: 700 }}>{clientFilter.name}</span>
          <button onClick={() => setClientFilter(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#c56003', display: 'flex', alignItems: 'center', padding: 0 }} title="Clear filter">
            <X size={15} />
          </button>
        </div>
      )}
      {/* Search bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? '100%' : 380 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            value={txSearch}
            onChange={e => setTxSearch(e.target.value)}
            placeholder="Search by property address…"
            style={{ width: '100%', padding: '0.55rem 0.875rem 0.55rem 2rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
          />
          {txSearch && (
            <button onClick={() => setTxSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {(txSearch || clientFilter) && (
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {filteredTxList.length} result{filteredTxList.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isMobile ? (
        <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTxList.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {txSearch ? `No transactions match "${txSearch}"` : 'No transactions yet — tap "New Transaction" to start.'}
            </div>
          ) : paginatedTxList.map(t => {
            const tParties   = parties.filter(p => p.transactionId === t.id)
            const anyFlagged = tParties.some(p => p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged')
            const allClear   = tParties.length > 0 && tParties.every(p => p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear')
            const cs = TX_STATUS_MAP[t.status] || TX_STATUS_MAP['In Progress']
            return (
              <div key={t.id} onClick={() => setSelectedTxId(t.id)} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '1rem', cursor: 'pointer', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D', flex: 1, marginRight: 8 }}>{t.property || '—'}</div>
                  <span style={{ background: cs.bg, color: cs.color, padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.status || 'In Progress'}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>{t.type}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ background: '#fff7ed', color: '#c56003', padding: '2px 8px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700 }}>{tParties.length} {tParties.length === 1 ? 'party' : 'parties'}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D' }}>R {Number(t.value || 0).toLocaleString('en-ZA')}</span>
                  {tParties.length > 0 && <StatusBadge status={anyFlagged ? 'flagged' : allClear ? 'clear' : 'pending'} />}
                </div>
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                  <button onClick={e => openEdit(t, e)} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '0.45rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.8rem' }}>
                    <Edit2 size={13} /> Edit
                  </button>
                  <button onClick={e => handleQuickAddParty(t.id, e)} style={{ flex: 1, background: '#fff7ed', color: '#c56003', border: 'none', borderRadius: 6, padding: '0.45rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                    <UserPlus size={13} /> Add Party
                  </button>
                  <button onClick={e => handleDeleteTx(t, e)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '0.45rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #f1f5f9' }}>
          <Pagination total={filteredTxList.length} page={txPage} pageSize={txPageSize} onPage={setTxPage} onPageSize={setTxPageSize} noun="transactions" />
        </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Property', 'Type', 'Parties', 'Value', 'Compliance', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.8rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTxList.map(t => {
                const tParties   = parties.filter(p => p.transactionId === t.id)
                const anyFlagged = tParties.some(p => p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged')
                const allClear   = tParties.length > 0 && tParties.every(p => p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear')
                const cs = TX_STATUS_MAP[t.status] || TX_STATUS_MAP['In Progress']
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTxId(t.id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.property || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{t.type}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: '#fff7ed', color: '#c56003', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700 }}>{tParties.length}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>R {Number(t.value || 0).toLocaleString('en-ZA')}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {tParties.length === 0
                        ? <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No parties</span>
                        : <StatusBadge status={anyFlagged ? 'flagged' : allClear ? 'clear' : 'pending'} />
                      }
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: cs.bg, color: cs.color, padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>{t.status || 'In Progress'}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>{t.createdAt}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={e => openEdit(t, e)} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '0.35rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={e => handleQuickAddParty(t.id, e)} style={{ background: '#fff7ed', color: '#c56003', border: 'none', borderRadius: 6, padding: '0.35rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }} title="Add Party">
                          <UserPlus size={13} /> Add Party
                        </button>
                        <button onClick={e => handleDeleteTx(t, e)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '0.35rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete transaction">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredTxList.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    {txSearch ? `No transactions match "${txSearch}"` : 'No transactions yet — click "New Transaction" to start.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination total={filteredTxList.length} page={txPage} pageSize={txPageSize} onPage={setTxPage} onPageSize={setTxPageSize} noun="transactions" />
        </div>
      )}

      {showAdd && <TxModal title="Add Transaction" fv={addForm} setFv={setAddForm} onSubmit={handleAddTx} onClose={() => setShowAdd(false)} saving={saving} />}
      {editTx  && <TxModal title="Edit Transaction" fv={editForm} setFv={setEditForm} onSubmit={handleEditTx} onClose={() => setEditTx(null)} saving={saving} />}
    </div>
  )
}
