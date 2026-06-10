import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../context.jsx'
import { apiFetch } from '../api.js'
import {
  Users, Plus, Edit2, ShieldCheck, ShieldAlert, Upload, Download,
  ChevronDown, ChevronUp, X, Save, AlertTriangle, CheckCircle, Clock,
  ExternalLink
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Parse DOB from first 6 digits of SA ID number (YYMMDD → YYYY-MM-DD)
function dobFromId(idNum) {
  if (!idNum || idNum.replace(/\s/g, '').length < 6) return ''
  const clean = idNum.replace(/\s/g, '')
  const yy = parseInt(clean.slice(0, 2), 10)
  const mm = clean.slice(2, 4)
  const dd = clean.slice(4, 6)
  if (isNaN(yy) || isNaN(parseInt(mm)) || isNaN(parseInt(dd))) return ''
  const currentYY = new Date().getFullYear() % 100
  const yyyy = yy <= currentYY ? 2000 + yy : 1900 + yy
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  if (isNaN(d.getTime())) return ''
  return `${yyyy}-${mm}-${dd}`
}

function actor(currentUser) {
  return { actorId: currentUser?.id, actorName: currentUser?.name }
}

function StatusPill({ status }) {
  const map = {
    clear:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Clear' },
    flagged: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Flagged' },
    pending: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Pending' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function OverallStatus({ screenings }) {
  if (!screenings || screenings.length === 0) return <StatusPill status="pending" />
  const latest = screenings[0]
  if (latest.tfs_status === 'flagged' || latest.un_status === 'flagged') return <StatusPill status="flagged" />
  if (latest.tfs_status === 'clear' && latest.un_status === 'clear') return <StatusPill status="clear" />
  return <StatusPill status="pending" />
}

function getLastScreenedYear(screenings) {
  if (!screenings || screenings.length === 0) return null
  return screenings[0].year
}

const currentYear = new Date().getFullYear()

function isDueThisYear(member) {
  return getLastScreenedYear(member.screenings) !== currentYear
}

function ScreenshotDownloadBtn({ screeningId, tfsKey, unKey }) {
  const [loading, setLoading] = useState(false)
  async function download(type) {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/agency-staff/screening/${screeningId}/urls`)
      const url = type === 'tfs' ? data.tfsUrl : data.unUrl
      if (url) window.open(url, '_blank')
      else alert('Screenshot not available')
    } catch { alert('Could not retrieve screenshot') }
    finally { setLoading(false) }
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {tfsKey && (
        <button onClick={() => download('tfs')} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: '#fff8f0', border: '1px solid #bae6fd', borderRadius: 5, cursor: 'pointer', fontSize: '0.7rem', color: '#c56003', fontWeight: 600 }}>
          <Download size={11} /> TFS
        </button>
      )}
      {unKey && (
        <button onClick={() => download('un')} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: '#fff8f0', border: '1px solid #bae6fd', borderRadius: 5, cursor: 'pointer', fontSize: '0.7rem', color: '#c56003', fontWeight: 600 }}>
          <Download size={11} /> UN
        </button>
      )}
    </div>
  )
}

export default function AgencyStaff() {
  const { currentUser } = useApp()
  const isManager = currentUser?.role === 'manager'

  const [staff, setStaff]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [screenTarget, setScreenTarget] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [autoScreening, setAutoScreening] = useState(null) // staffId currently being auto-screened
  const [screenResult, setScreenResult]   = useState(null) // result to show after auto-screen
  const [search, setSearch]       = useState('')

  // Add/Edit form
  const BLANK = { name: '', idNumber: '', role: '', startDate: '', dob: '' }
  const [form, setForm]           = useState(BLANK)

  // Screening form
  const BLANK_SCREEN = { tfsStatus: 'pending', unStatus: 'pending', notes: '', tfsScreenshot: null, unScreenshot: null }
  const [screenForm, setScreenForm] = useState(BLANK_SCREEN)

  const fileRef = useRef(null)
  const uploadTargetRef = useRef(null)  // ref so handleUpload always sees current target
  const [uploadTarget, setUploadTarget] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/api/agency-staff')
      setStaff(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMember) {
        const updated = await apiFetch(`/api/agency-staff/${editMember.id}`, {
          method: 'PUT', body: JSON.stringify({ ...form, ...actor(currentUser) })
        })
        setStaff(prev => prev.map(s => s.id === editMember.id ? { ...s, ...updated } : s))
        setEditMember(null)
      } else {
        const created = await apiFetch('/api/agency-staff', {
          method: 'POST', body: JSON.stringify({ ...form, ...actor(currentUser) })
        })
        setStaff(prev => [created, ...prev])
        setShowAdd(false)
      }
      setForm(BLANK)
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleArchive(member) {
    if (!window.confirm(`Archive ${member.name}? They will no longer appear in active staff.`)) return
    const updated = await apiFetch(`/api/agency-staff/${member.id}`, {
      method: 'PUT', body: JSON.stringify({ status: 'archived', ...actor(currentUser) })
    })
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, ...updated } : s))
  }

  async function handleScreen(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await apiFetch(`/api/agency-staff/${screenTarget.id}/screen`, {
        method: 'POST', body: JSON.stringify({ ...screenForm, ...actor(currentUser) })
      })
      setStaff(prev => prev.map(s => {
        if (s.id !== screenTarget.id) return s
        const existing = (s.screenings || []).filter(ss => ss.year !== result.year)
        return { ...s, screenings: [result, ...existing] }
      }))
      setScreenTarget(null)
      setScreenForm(BLANK_SCREEN)
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleAutoScreen(member) {
    setAutoScreening(member.id)
    setScreenResult(null)
    try {
      const result = await apiFetch(`/api/agency-staff/${member.id}/auto-screen`, {
        method: 'POST', body: JSON.stringify({ ...actor(currentUser) })
      })
      setStaff(prev => prev.map(s => {
        if (s.id !== member.id) return s
        const existing = (s.screenings || []).filter(ss => ss.year !== result.year)
        return { ...s, screenings: [result, ...existing] }
      }))
      setScreenResult({ member, result })
      setExpanded(member.id)
    } catch (err) { alert('Auto-screen failed: ' + err.message) }
    finally { setAutoScreening(null) }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    const target = uploadTargetRef.current
    if (!file || !target) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('actorId', currentUser?.id || '')
    fd.append('actorName', currentUser?.name || '')
    try {
      const res = await fetch(`${API}/api/agency-staff/${target.id}/upload-id`, { method: 'POST', body: fd })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Upload failed') }
      const data = await res.json()
      setStaff(prev => prev.map(s => s.id === target.id ? { ...s, idDocUrl: data.key } : s))
    } catch (err) { alert('Upload failed: ' + err.message) }
    finally {
      fileRef.current.value = ''
      uploadTargetRef.current = null
      setUploadTarget(null)
    }
  }

  async function openDocUrl(memberId) {
    try {
      const data = await apiFetch(`/api/agency-staff/${memberId}/doc-url`)
      if (data.url) window.open(data.url, '_blank')
    } catch {}
  }

  const filtered = staff.filter(s =>
    s.status !== 'archived' &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     (s.role||'').toLowerCase().includes(search.toLowerCase()))
  )
  const overdue = staff.filter(s => s.status === 'active' && isDueThisYear(s)).length

  const statuses = ['clear','flagged','pending']

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0D0D0D', margin: 0 }}>Agency Staff</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.85rem' }}>
            Annual TFS &amp; UN screening records for all agency staff
          </p>
        </div>
        {isManager && (
          <button onClick={() => { setShowAdd(true); setEditMember(null); setForm(BLANK) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem',
              background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
            <Plus size={15} /> Add Staff Member
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Active', value: staff.filter(s=>s.status!=='archived').length, bg:'#f8fafc', color:'#0D0D0D', border:'#e2e8f0' },
          { label: `Screened ${currentYear}`, value: staff.filter(s=>s.status!=='archived'&&!isDueThisYear(s)).length, bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0' },
          { label: 'Due / Overdue', value: overdue, bg: overdue>0?'#fef2f2':'#f8fafc', color: overdue>0?'#dc2626':'#94a3b8', border: overdue>0?'#fecaca':'#e2e8f0' },
          { label: 'Flagged', value: staff.filter(s=>{ const l=s.screenings?.[0]; return l&&(l.tfs_status==='flagged'||l.un_status==='flagged')}).length, bg:'#fef2f2', color:'#dc2626', border:'#fecaca' },
        ].map(({label,value,bg,color,border}) => (
          <div key={label} style={{ flex: '1 1 120px', background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or role…"
        style={{ width: '100%', padding: '0.6rem 0.9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem', outline: 'none', boxSizing: 'border-box' }} />

      {/* Staff list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No staff members found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(member => {
            const due = isDueThisYear(member)
            const isOpen = expanded === member.id
            const latest = member.screenings?.[0]
            const flagged = latest && (latest.tfs_status === 'flagged' || latest.un_status === 'flagged')
            return (
              <div key={member.id} style={{ background: '#fff', border: `1.5px solid ${flagged ? '#fca5a5' : due ? '#fcd34d' : '#e2e8f0'}`, borderRadius: 10, overflow: 'hidden' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.9rem 1rem', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>{member.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                      {member.role || 'No role'}{member.idNumber ? ` · ${member.idNumber}` : ''}
                      {member.userEmail ? <span style={{ color: '#94a3b8' }}> · {member.userEmail}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: 2 }}>TFS</div>
                      <StatusPill status={latest?.tfs_status || 'pending'} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: 2 }}>UN</div>
                      <StatusPill status={latest?.un_status || 'pending'} />
                    </div>
                    {due
                      ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 99 }}>
                          Due {currentYear}
                        </span>
                      : <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 99 }}>
                          Screened {getLastScreenedYear(member.screenings)}
                        </span>
                    }
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isManager && (
                      <button onClick={() => handleAutoScreen(member)}
                        disabled={autoScreening === member.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem',
                          background: autoScreening === member.id ? '#94a3b8' : '#111111',
                          color: '#fff', border: 'none', borderRadius: 6, cursor: autoScreening === member.id ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        <ShieldCheck size={13} /> {autoScreening === member.id ? 'Screening…' : 'Auto Screen'}
                      </button>
                    )}
                    {isManager && (
                      <button onClick={() => {
                          const curYear = new Date().getFullYear()
                          const existing = (member.screenings || []).find(s => s.year === curYear)
                          setScreenForm(existing ? {
                            tfsStatus: existing.tfs_status || 'pending',
                            unStatus: existing.un_status || 'pending',
                            notes: existing.notes || '',
                            tfsScreenshot: existing.tfs_screenshot || null,
                            unScreenshot: existing.un_screenshot || null,
                          } : BLANK_SCREEN)
                          setScreenTarget(member)
                        }} title="Record manually"
                        style={{ padding: '0.35rem 0.6rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#374151', fontSize: '0.72rem' }}>
                        Manual
                      </button>
                    )}
                    {isManager && (
                      <button onClick={() => { setEditMember(member); setForm({ name: member.name, idNumber: member.idNumber||'', role: member.role||'', startDate: member.startDate||'', dob: member.dob||'' }); setShowAdd(true) }}
                        style={{ padding: '0.35rem 0.6rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                    <button onClick={() => setExpanded(isOpen ? null : member.id)}
                      style={{ padding: '0.35rem 0.6rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '1rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {/* ID doc */}
                      <div style={{ flex: '0 0 auto' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>ID Document</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {member.idDocUrl && (
                            <button onClick={() => openDocUrl(member.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', background: '#fff8f0', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#c56003' }}>
                              <Download size={12} /> View ID
                            </button>
                          )}
                          {isManager && (
                            <button onClick={() => { uploadTargetRef.current = member; setUploadTarget(member); fileRef.current?.click() }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#374151' }}>
                              <Upload size={12} /> {member.idDocUrl ? 'Replace' : 'Upload ID'}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Start date */}
                      {member.startDate && (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Start Date</div>
                          <div style={{ fontSize: '0.85rem', color: '#0D0D0D' }}>{new Date(member.startDate).toLocaleDateString('en-ZA')}</div>
                        </div>
                      )}
                    </div>

                    {/* Screening history */}
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 8 }}>Screening History</div>
                    {(!member.screenings || member.screenings.length === 0) ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No screenings recorded yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {member.screenings.map((s, i) => (
                          <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem 0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D', minWidth: 50 }}>{s.year}</div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>TFS:</span><StatusPill status={s.tfs_status} />
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 4 }}>UN:</span><StatusPill status={s.un_status} />
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', flex: 1 }}>
                                {new Date(s.screened_at).toLocaleDateString('en-ZA')} · {s.screened_by_name || 'Unknown'}
                                {s.notes && <span style={{ display: 'block', fontStyle: 'italic', color: '#94a3b8', marginTop: 2 }}>{s.notes}</span>}
                              </div>
                              {(s.tfs_screenshot || s.un_screenshot) && (
                                <ScreenshotDownloadBtn screeningId={s.id} tfsKey={s.tfs_screenshot} unKey={s.un_screenshot} />
                              )}
                              {isManager && Number(s.year) === new Date().getFullYear() && (s.tfs_status === 'flagged' || s.un_status === 'flagged') && (
                                <button onClick={() => {
                                  setScreenForm({ tfsStatus: s.tfs_status||'pending', unStatus: s.un_status||'pending', notes: s.notes||'', tfsScreenshot: s.tfs_screenshot||null, unScreenshot: s.un_screenshot||null })
                                  setScreenTarget(member)
                                }}
                                  style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:5, cursor:'pointer', fontSize:'0.7rem', color:'#92400e', fontWeight:700 }}>
                                  ✎ Override
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isManager && (
                      <button onClick={() => handleArchive(member)}
                        style={{ marginTop: 12, padding: '0.35rem 0.7rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                        Archive Staff Member
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} />

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0D0D0D' }}>
                {editMember ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button onClick={() => { setShowAdd(false); setEditMember(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              {[
                { key: 'name',      label: 'Full Name *', placeholder: 'e.g. Jane Smith' },
                { key: 'idNumber',  label: 'ID / Passport Number', placeholder: 'e.g. 8001015009087', autoDob: true },
                { key: 'role',      label: 'Role / Job Title', placeholder: 'e.g. Agent, Admin' },
              ].map(({ key, label, placeholder, autoDob }) => (
                <div key={key} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.82rem', color: '#374151' }}>{label}</label>
                  <input value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    onBlur={autoDob ? (e => { const parsed = dobFromId(e.target.value); if (parsed) setForm(f => ({ ...f, dob: parsed })) }) : undefined}
                    placeholder={placeholder} required={key==='name'}
                    style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.82rem', color: '#374151' }}>
                  Date of Birth
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: '0.75rem' }}>auto-filled from ID</span>
                </label>
                <input type="date" value={form.dob || ''} onChange={e => setForm(f => ({...f, dob: e.target.value}))}
                  style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.82rem', color: '#374151' }}>Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))}
                  style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowAdd(false); setEditMember(null) }}
                  style={{ padding: '0.55rem 1.1rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>
                  <Save size={14} /> {saving ? 'Saving…' : editMember ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screening Modal */}
      {screenTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0D0D0D' }}>
                  {(screenForm.tfsScreenshot || screenForm.unScreenshot) ? 'Override Screening Result' : 'Screen Staff Member'}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>{screenTarget.name} — {currentYear}</div>
              </div>
              <button onClick={() => setScreenTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleScreen}>
              {(screenForm.tfsScreenshot || screenForm.unScreenshot) && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.875rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.8rem', color: '#166534' }}>
                  ✓ Auto-screen screenshots are preserved — only the status will be updated.
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.82rem', color: '#374151' }}>Screening Results</label>
                {[
                  { key: 'tfsStatus', label: 'TFS (FIC)', url: 'https://tfs.fic.gov.za/Pages/Search' },
                  { key: 'unStatus',  label: 'UN Sanctions', url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
                ].map(({ key, label, url }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.75rem' }}>
                    <span style={{ width: 110, fontSize: '0.82rem', fontWeight: 600, color: '#374151', flexShrink: 0 }}>{label}</span>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#c56003', textDecoration: 'none', background: '#fff8f0', padding: '3px 7px', borderRadius: 5, flexShrink: 0 }}>
                      Open <ExternalLink size={10} />
                    </a>
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      {['clear','flagged','pending'].map(r => (
                        <button key={r} type="button" onClick={() => setScreenForm(f => ({...f, [key]: r}))}
                          style={{ flex: 1, padding: '0.35rem', border: `2px solid ${screenForm[key]===r ? (r==='clear'?'#16a34a':r==='flagged'?'#dc2626':'#d97706') : '#e2e8f0'}`,
                            borderRadius: 6, background: screenForm[key]===r ? (r==='clear'?'#f0fdf4':r==='flagged'?'#fef2f2':'#fffbeb') : '#fff',
                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                            color: screenForm[key]===r ? (r==='clear'?'#16a34a':r==='flagged'?'#dc2626':'#d97706') : '#94a3b8',
                            textTransform: 'capitalize' }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {(screenForm.tfsStatus === 'flagged' || screenForm.unStatus === 'flagged') && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.82rem', color: '#7f1d1d', fontWeight: 600 }}>
                    Flagged result — all managers will be notified by email immediately on save.
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.82rem', color: '#374151' }}>Notes</label>
                <textarea value={screenForm.notes} onChange={e => setScreenForm(f => ({...f, notes: e.target.value}))}
                  placeholder="Optional notes about this screening…" rows={2}
                  style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setScreenTarget(null)}
                  style={{ padding: '0.55rem 1.1rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>
                  <ShieldCheck size={14} /> {saving ? 'Saving…' : (screenForm.tfsScreenshot || screenForm.unScreenshot) ? 'Save Override' : 'Record Screening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
