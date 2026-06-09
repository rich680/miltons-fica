import React, { useState, useEffect } from 'react'
import { useApp } from '../context.jsx'
import { apiFetch } from '../api.js'
import { Plus, Trash2, UserCheck, Loader, Edit2, X } from 'lucide-react'

const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }

export default function Agents() {
  const { currentUser } = useApp()
  const [agents, setAgents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [editAgent, setEditAgent] = useState(null)
  const [form, setForm]           = useState({ name: '', email: '', password: '', role: 'agent' })
  const [editForm, setEditForm]   = useState({ name: '', email: '', role: 'agent', password: '' })

  useEffect(() => { fetchAgents() }, [])

  async function fetchAgents() {
    setLoading(true)
    try {
      const users = await apiFetch('/api/users')
      setAgents(users)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const created = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setAgents(prev => [...prev, created])
      setForm({ name: '', email: '', password: '', role: 'agent' })
      setShowAdd(false)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  function openEdit(agent) {
    setEditAgent(agent)
    setEditForm({ name: agent.name, email: agent.email, role: agent.role, password: '' })
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { name: editForm.name, email: editForm.email, role: editForm.role }
      if (editForm.password) payload.password = editForm.password
      const updated = await apiFetch(`/api/users/${editAgent.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setAgents(prev => prev.map(u => u.id === editAgent.id ? { ...u, ...updated } : u))
      setEditAgent(null)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (id === currentUser?.id) return alert('You cannot delete your own account.')
    if (!confirm('Remove this user? Their clients will remain.')) return
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' })
      setAgents(prev => prev.filter(u => u.id !== id))
    } catch (e) { setError(e.message) }
  }

  if (currentUser?.role !== 'manager') {
    return <div style={{ padding: '2rem', color: '#dc2626' }}>Access denied — managers only.</div>
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D' }}>Agent Management</h1>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
          <Plus size={16} /> Add Agent
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Add Agent inline form */}
      {showAdd && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', marginBottom: '1.5rem', border: '1.5px solid #e2e8f0' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>New Agent</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {[['name','Full Name','text'],['email','Email Address','email'],['password','Password','password']].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: key === 'password' ? '1 / -1' : undefined }}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} required style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Mobile Phone <span style={{ fontWeight: 400, color: '#e77204' }}>(required for MFA login — e.g. 0821234567)</span></label>
                <input type="tel" required value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} style={inputStyle} placeholder="0821234567" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: saving ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserCheck size={14} />}
                {saving ? 'Saving…' : 'Create Agent'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading…</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Name','Email','Role','Phone','Joined',''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#0D0D0D', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: u.role === 'manager' ? '#111111' : '#e2e8f0', color: u.role === 'manager' ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {u.name[0]}
                      </div>
                      {u.name}
                      {u.id === currentUser?.id && <span style={{ background: '#dbeafe', color: '#c56003', padding: '1px 7px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700 }}>You</span>}
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.875rem' }}>{u.email}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ background: u.role === 'manager' ? '#111111' : '#f1f5f9', color: u.role === 'manager' ? '#fff' : '#374151', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                    {u.phone
                      ? <span style={{ color: '#374151' }}>{u.phone}</span>
                      : <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.75rem', background: '#fef2f2', padding: '2px 8px', borderRadius: 10 }}>⚠ No phone</span>
                    }
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-ZA') : '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(u)} style={{ background: '#f1f5f9', border: 'none', color: '#374151', cursor: 'pointer', padding: '0.35rem 0.6rem', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u.id)} style={{ background: '#fef2f2', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.35rem 0.6rem', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="Remove">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agents.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No agents yet. Add one above.</div>
          )}
        </div>
      )}

      {/* Edit Agent Modal */}
      {editAgent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Edit Agent</h2>
              <button onClick={() => setEditAgent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Full Name</label>
                <input required value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Email Address</label>
                <input required type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({...f, role: e.target.value}))} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Mobile Phone <span style={{ fontWeight: 400, color: '#e77204' }}>(required for login)</span></label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} style={inputStyle} placeholder="0821234567" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>New Password <span style={{ fontWeight: 400, color: '#94a3b8' }}>(leave blank to keep current)</span></label>
                <input type="password" placeholder="••••••••" value={editForm.password} onChange={e => setEditForm(f => ({...f, password: e.target.value}))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditAgent(null)} style={{ padding: '0.6rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.25rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
