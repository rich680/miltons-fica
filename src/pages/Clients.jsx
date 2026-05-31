import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint.js'
import { apiFetch } from '../api.js'
import { Plus, Search, X, Edit2, Users, Trash2 } from 'lucide-react'
import Pagination from '../components/Pagination.jsx'

const TYPES = [
  'Individual SA',
  'Individual Foreign',
  'SA Company / CC',
  'SA Trust',
  'SA Professional Partnership (Drs, Engineers, Attorneys etc)',
  'SA Listed Company',
  'SA Partnership',
  'Foreign National / Company from USA, UK',
  'Principal (Power of Attorney)',
]

// Auto-extract DOB from a valid 13-digit SA ID number
// Passports (alphanumeric) and company registrations (contain /) are ignored
function parseIdDob(val) {
  if (!/^\d{13}$/.test(val)) return null
  const yy = parseInt(val.slice(0, 2), 10)
  const mm = val.slice(2, 4)
  const dd = val.slice(4, 6)
  const month = parseInt(mm, 10)
  const day   = parseInt(dd, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = (2000 + yy) <= new Date().getFullYear() ? 2000 + yy : 1900 + yy
  return `${year}-${mm}-${dd}`
}

const BLANK_FORM = { name: '', idNumber: '', type: 'Individual SA', agentId: '', dateOfBirth: '', placeOfBirth: '', nationality: '' }

const inputStyle = { width: '100%', padding: '0.6rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.85rem', color: '#374151' }

export default function Clients() {
  const { clients, parties, addClient, updateClient, deleteClient, currentUser } = useApp()
  const navigate = useNavigate()
  const { isMobile } = useBreakpoint()
  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [form, setForm]             = useState({ ...BLANK_FORM, agentId: currentUser?.id })
  const [editForm, setEditForm]     = useState(BLANK_FORM)
  const [users, setUsers]           = useState([])
  const [saving, setSaving]         = useState(false)
  const [page, setPage]             = useState(0)
  const [pageSize, setPageSize]     = useState(10)

  useEffect(() => {
    apiFetch('/api/users').then(setUsers).catch(() => {})
  }, [])

  // Reset to first page whenever search or page size changes
  useEffect(() => { setPage(0) }, [search, pageSize])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.idNumber || '').includes(search)
  )
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize)

  function handleAdd(e) {
    e.preventDefault()
    addClient({
      ...form,
      agentId: Number(form.agentId) || null,
    })
    setForm({ ...BLANK_FORM, agentId: currentUser?.id })
    setShowAdd(false)
  }

  function openEdit(c) {
    setEditClient(c)
    setEditForm({ name: c.name, idNumber: c.idNumber || '', type: c.type || 'Individual SA', agentId: c.agentId || '', dateOfBirth: c.dateOfBirth || '', placeOfBirth: c.placeOfBirth || '', nationality: c.nationality || '' })
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true)
    await updateClient(editClient.id, {
      name: editForm.name,
      idNumber: editForm.idNumber,
      type: editForm.type,
      agentId: Number(editForm.agentId) || null,
      dateOfBirth: editForm.dateOfBirth || null,
      placeOfBirth: editForm.placeOfBirth || '',
      nationality: editForm.nationality || '',
    })
    setSaving(false)
    setEditClient(null)
  }

  async function handleDelete(c) {
    const txCount = parties.filter(p => p.clientId === c.id).length
    if (txCount > 0) {
      alert(`Cannot delete ${c.name} — they are linked to ${txCount} transaction${txCount === 1 ? '' : 's'} as a party.\n\nRemove them from all transactions first, then delete.`)
      return
    }
    if (!window.confirm(`Delete ${c.name}?\n\nThis will permanently remove their identity record. This cannot be undone.`)) return
    await deleteClient(c.id)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D' }}>Client Registry</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 2 }}>Identity records — compliance lives on each transaction party</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: isMobile ? '100%' : 380 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID number"
          style={{ width: '100%', padding: '0.6rem 0.875rem 0.6rem 2rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: '#fff' }} />
      </div>

      {isMobile ? (
        /* ── Mobile card list ── */
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paginated.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', background: '#fff', borderRadius: 12 }}>No clients found</div>
            )}
            {paginated.map(c => {
              const agent = users.find(u => u.id === c.agentId)
              const txCount = parties.filter(p => p.clientId === c.id).length
              return (
                <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{c.idNumber || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEdit(c)} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '0.4rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={txCount > 0}
                        style={{ background: txCount > 0 ? '#f8fafc' : '#fef2f2', color: txCount > 0 ? '#cbd5e1' : '#dc2626', border: 'none', borderRadius: 6, padding: '0.4rem 0.5rem', cursor: txCount > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.78rem' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12 }}>{c.type}</span>
                    {agent && <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12 }}>Agent: {agent.name}</span>}
                    {txCount > 0
                      ? <button onClick={() => navigate('/transactions', { state: { filterClientId: c.id, filterClientName: c.name } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff7ed', color: '#c56003', padding: '2px 8px', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>
                          <Users size={11} /> {txCount} tx
                        </button>
                      : <span style={{ color: '#94a3b8' }}>No transactions</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #f1f5f9' }}>
            <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </div>
      ) : (
        /* ── Desktop table ── */
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                {['Name', 'ID / Reg No.', 'Type', 'Agent', 'Transactions', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(c => {
                const agent = users.find(u => u.id === c.agentId)
                const txCount = parties.filter(p => p.clientId === c.id).length
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.idNumber || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 200 }}>{c.type}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{agent?.name || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {txCount > 0
                        ? <button onClick={() => navigate('/transactions', { state: { filterClientId: c.id, filterClientName: c.name } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff7ed', color: '#c56003', padding: '2px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                            <Users size={12} /> {txCount} {txCount === 1 ? 'transaction' : 'transactions'}
                          </button>
                        : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None yet</span>
                      }
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => openEdit(c)} style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '0.35rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="Edit identity">
                          <Edit2 size={13} /> <span style={{ fontSize: '0.78rem' }}>Edit</span>
                        </button>
                        <button onClick={() => handleDelete(c)} disabled={txCount > 0}
                          style={{ background: txCount > 0 ? '#f8fafc' : '#fef2f2', color: txCount > 0 ? '#cbd5e1' : '#dc2626', border: 'none', borderRadius: 6, padding: '0.35rem 0.5rem', cursor: txCount > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                          title={txCount > 0 ? `Linked to ${txCount} transaction${txCount === 1 ? '' : 's'} — remove from all transactions first` : 'Delete client'}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No clients found</td></tr>
              )}
            </tbody>
          </table>
          <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </div>
      )}

      {/* Add Client Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '92%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Add New Client</h2>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>Identity details only — compliance is captured per transaction</p>
              </div>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Full Name / Entity Name *</label>
                <input required placeholder="e.g. John Smith" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>ID / Passport / Registration No.</label>
                <input placeholder="e.g. 8001015009087 or 2018/123456/07" value={form.idNumber} onChange={e => {
                  const val = e.target.value
                  const dob = parseIdDob(val)
                  setForm(f => ({ ...f, idNumber: val, ...(dob ? { dateOfBirth: dob } : {}) }))
                }} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({...f, dateOfBirth: e.target.value}))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Place of Birth</label>
                  <input placeholder="e.g. Johannesburg" value={form.placeOfBirth} onChange={e => setForm(f => ({...f, placeOfBirth: e.target.value}))} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nationality</label>
                <input placeholder="e.g. South African" value={form.nationality} onChange={e => setForm(f => ({...f, nationality: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Client Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Assigned Agent</label>
                <select value={form.agentId} onChange={e => setForm(f => ({...f, agentId: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">— Select agent —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ padding: '0.6rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ padding: '0.6rem 1.25rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Add Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Edit Client Identity</h2>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>{editClient.name}</p>
              </div>
              <button onClick={() => setEditClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Full Name / Entity Name *</label>
                <input required value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>ID / Passport / Registration No.</label>
                <input value={editForm.idNumber} onChange={e => {
                  const val = e.target.value
                  const dob = parseIdDob(val)
                  setEditForm(f => ({ ...f, idNumber: val, ...(dob ? { dateOfBirth: dob } : {}) }))
                }} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({...f, dateOfBirth: e.target.value}))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Place of Birth</label>
                  <input placeholder="e.g. Johannesburg" value={editForm.placeOfBirth} onChange={e => setEditForm(f => ({...f, placeOfBirth: e.target.value}))} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Nationality</label>
                <input placeholder="e.g. South African" value={editForm.nationality} onChange={e => setEditForm(f => ({...f, nationality: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Client Type</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({...f, type: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Assigned Agent</label>
                <select value={editForm.agentId} onChange={e => setEditForm(f => ({...f, agentId: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">— Select agent —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditClient(null)} style={{ padding: '0.6rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.25rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
