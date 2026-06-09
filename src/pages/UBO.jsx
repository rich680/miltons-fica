import React, { useState, useEffect } from 'react'
import { useApp } from '../context.jsx'
import { GitBranch, Save, Plus, Trash2, ExternalLink, Edit2, AlertTriangle, Printer } from 'lucide-react'

// Entity types that qualify a party for UBO identification
const ENTITY_TYPES_PARTY = [
  'SA Company / CC', 'SA Trust',
  'SA Professional Partnership (Drs, Engineers, Attorneys etc)',
  'SA Listed Company', 'SA Partnership',
  'Foreign National / Company from USA, UK',
  'Company / CC', 'Trust',
]

// Entity types selectable for intermediate entities
const UBO_ENTITY_TYPES = [
  'SA Company / CC', 'Close Corporation (CC)', 'SA Trust',
  'SA Listed Company', 'SA Partnership', 'Foreign Company',
  'Trust', 'Partnership', 'Other Entity',
]

const ROLES = ['Shareholder', 'Member', 'Trustee', 'Beneficiary', 'Partner', 'Director', 'Controller']
const TRUST_ROLES = new Set(['Trustee', 'Beneficiary'])

const EMPTY_FORM = {
  uboName: '', uboId: '', ownershipPct: '',
  role: 'Shareholder', isEntity: false, entityType: '',
  ficStatus: 'pending', unStatus: 'pending', notes: '',
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).substr(2, 9) }

function normalizeTree(nodes) {
  if (!Array.isArray(nodes)) return []
  return nodes.map(u => ({
    id:           u.id           || genId(),
    uboName:      u.uboName      || '',
    uboId:        u.uboId        || '',
    ownershipPct: u.ownershipPct ?? '',
    role:         u.role         || 'Shareholder',
    isEntity:     u.isEntity     || false,
    entityType:   u.entityType   || '',
    ficStatus:    u.ficStatus    || 'pending',
    unStatus:     u.unStatus     || 'pending',
    notes:        u.notes        || '',
    savedAt:      u.savedAt      || '',
    children:     normalizeTree(u.children || []),
  }))
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) { const f = findNode(n.children, id); if (f) return f }
  }
  return null
}

function findSiblings(nodes, targetId) {
  if (nodes.some(n => n.id === targetId)) return nodes
  for (const n of nodes) {
    if (n.children?.length) {
      const f = findSiblings(n.children, targetId)
      if (f) return f
    }
  }
  return null
}

function addToParent(nodes, parentId, node) {
  if (!parentId) return [...nodes, node]
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), node] }
    if (n.children?.length) return { ...n, children: addToParent(n.children, parentId, node) }
    return n
  })
}

function updateInTree(nodes, id, fn) {
  return nodes.map(n => {
    if (n.id === id) return fn(n)
    if (n.children?.length) return { ...n, children: updateInTree(n.children, id, fn) }
    return n
  })
}

function removeFromTree(nodes, id) {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: n.children?.length ? removeFromTree(n.children, id) : n.children }))
}

function countAll(nodes) {
  if (!Array.isArray(nodes)) return 0
  return nodes.reduce((s, n) => s + 1 + countAll(n.children || []), 0)
}

function hasIncomplete(nodes) {
  for (const n of nodes) {
    if (n.isEntity && (!n.children || n.children.length === 0)) return true
    if (n.children?.length && hasIncomplete(n.children)) return true
  }
  return false
}

// ── Small display components ──────────────────────────────────────────────────

function StatusPill({ status }) {
  const map = {
    clear:   ['#f0fdf4', '#16a34a'],
    flagged: ['#fef2f2', '#dc2626'],
    pending: ['#fffbeb', '#d97706'],
  }
  const [bg, color] = map[status] || ['#f1f5f9', '#64748b']
  return (
    <span style={{ background: bg, color, padding: '1px 8px', borderRadius: 12,
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

function RolePill({ role }) {
  const map = {
    Shareholder:  ['#fff7ed', '#c56003'],
    Member:       ['#fff7ed', '#c56003'],
    Trustee:      ['#faf5ff', '#7c3aed'],
    Beneficiary:  ['#fdf4ff', '#a21caf'],
    Partner:      ['#ecfdf5', '#065f46'],
    Director:     ['#fff7ed', '#c2410c'],
    Controller:   ['#fef2f2', '#dc2626'],
  }
  const [bg, color] = map[role] || ['#f1f5f9', '#64748b']
  return (
    <span style={{ background: bg, color, padding: '1px 8px', borderRadius: 12,
      fontSize: '0.72rem', fontWeight: 700 }}>
      {role}
    </span>
  )
}

// ── Recursive tree node ───────────────────────────────────────────────────────

function UBONode({ node, depth, onEdit, onDelete, onAddChild }) {
  const isTrustRole      = TRUST_ROLES.has(node.role)
  const pct              = Number(node.ownershipPct) || 0
  const isReportable     = !isTrustRole && pct >= 5
  const allClear         = node.ficStatus === 'clear'  && node.unStatus === 'clear'
  const anyFlagged       = node.ficStatus === 'flagged' || node.unStatus === 'flagged'
  const nodeColor        = anyFlagged ? '#dc2626' : allClear ? '#16a34a' : '#d97706'
  const nodeBg           = anyFlagged ? '#fef2f2' : allClear ? '#f0fdf4' : '#fffbeb'
  const nodeBorder       = anyFlagged ? '#fca5a5' : allClear ? '#bbf7d0' : '#fcd34d'
  const needsLookThrough = node.isEntity && (!node.children || node.children.length === 0)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: nodeBg, border: `2px solid ${nodeBorder}`, borderRadius: 10,
        padding: '0.65rem 1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + role + entity badge + % */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{node.uboName}</span>
              <RolePill role={node.role} />
              {node.isEntity && node.entityType && (
                <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569',
                  padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                  {node.entityType}
                </span>
              )}
              {!isTrustRole && pct > 0 && (
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: nodeColor }}>
                  {pct}%{isReportable ? ' ⚠' : ''}
                </span>
              )}
            </div>
            {/* ID + screening pills */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID/Reg:</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                {node.uboId || '—'}
              </span>
              <span style={{ marginLeft: 4, fontSize: '0.72rem', color: '#94a3b8' }}>FIC:</span>
              <StatusPill status={node.ficStatus} />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>UN:</span>
              <StatusPill status={node.unStatus} />
            </div>
            {node.notes && (
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: 3 }}>
                {node.notes}
              </div>
            )}
            {needsLookThrough && (
              <div style={{ marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6 }}>
                <AlertTriangle size={11} style={{ color: '#d97706', flexShrink: 0 }} />
                <span style={{ fontSize: '0.71rem', color: '#92400e', fontWeight: 600 }}>
                  Look-through required — identify UBOs of this entity
                </span>
              </div>
            )}
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'flex-start' }}>
            {node.isEntity && (
              <button onClick={() => onAddChild(node.id, node.uboName)}
                title="Add UBO of this entity"
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0.28rem 0.6rem',
                  background: '#fff7ed', border: '1px solid #bfdbfe', borderRadius: 6,
                  cursor: 'pointer', color: '#c56003', fontSize: '0.75rem', fontWeight: 700 }}>
                <Plus size={11} /> Add
              </button>
            )}
            <button onClick={() => onEdit(node)} title="Edit"
              style={{ padding: '0.3rem 0.55rem', background: '#f1f5f9', border: 'none',
                borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(node.id)} title="Remove"
              style={{ padding: '0.3rem 0.55rem', background: '#fef2f2', border: 'none',
                borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Children */}
      {node.children?.length > 0 && (
        <div style={{
          marginLeft: 28, paddingLeft: 8,
          borderLeft: '2px dashed #cbd5e1',
          marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {node.children.map(child => (
            <UBONode key={child.id} node={child} depth={depth + 1}
              onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UBO() {
  const { transactions, parties, updateParty } = useApp()

  const entityParties = parties.filter(p => ENTITY_TYPES_PARTY.includes(p.clientType))

  const [transactionId, setTransactionId] = useState('')
  const [partyId, setPartyId]             = useState('')
  const [ubos, setUbos]                   = useState([])
  const [saving, setSaving]               = useState(false)
  const [savedMsg, setSavedMsg]           = useState('')

  // Form state
  const [showForm, setShowForm]               = useState(false)
  const [editingId, setEditingId]             = useState(null)
  const [formParentId, setFormParentId]       = useState(null)
  const [formParentName, setFormParentName]   = useState(null)
  const [form, setForm]                       = useState(EMPTY_FORM)
  const [capError, setCapError]               = useState('')

  const txEntityParties = entityParties.filter(p => p.transactionId === Number(transactionId))
  const party = parties.find(p => p.id === Number(partyId))

  useEffect(() => {
    if (party) {
      setUbos(normalizeTree(Array.isArray(party.ubos) ? party.ubos : []))
    } else {
      setUbos([])
    }
    closeForm()
    setSavedMsg('')
  }, [partyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived form values ──
  const isTrustRole = TRUST_ROLES.has(form.role)

  // Siblings of the node being added/edited — used for % cap
  const siblings = (() => {
    if (editingId) return findSiblings(ubos, editingId) || []
    if (formParentId) {
      const p = findNode(ubos, formParentId)
      return p?.children || []
    }
    return ubos
  })()

  const otherTotal = isTrustRole ? 0 : siblings
    .filter(n => n.id !== editingId)
    .reduce((s, n) => s + (TRUST_ROLES.has(n.role) ? 0 : (Number(n.ownershipPct) || 0)), 0)

  const liveNewTotal = otherTotal + (Number(form.ownershipPct) || 0)
  const overCap      = !isTrustRole && liveNewTotal > 100

  // ── Form actions ──
  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormParentId(null)
    setFormParentName(null)
    setForm(EMPTY_FORM)
    setCapError('')
  }

  function openAddRoot() {
    closeForm()
    setShowForm(true)
  }

  function openAddChild(parentId, parentName) {
    closeForm()
    setFormParentId(parentId)
    setFormParentName(parentName)
    setShowForm(true)
  }

  function openEdit(node) {
    closeForm()
    setEditingId(node.id)
    setForm({
      uboName: node.uboName, uboId: node.uboId,
      ownershipPct: node.ownershipPct,
      role: node.role, isEntity: node.isEntity, entityType: node.entityType,
      ficStatus: node.ficStatus, unStatus: node.unStatus, notes: node.notes,
    })
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this entry and all its sub-entries?')) return
    const updated = removeFromTree(ubos, id)
    setUbos(updated)
    await persist(updated)
  }

  async function handleSaveUBO(e) {
    e.preventDefault()
    if (!isTrustRole) {
      const pct = Number(form.ownershipPct) || 0
      if (otherTotal + pct > 100) {
        setCapError(`Total would be ${otherTotal + pct}% — exceeds 100%. Available: ${100 - otherTotal}%.`)
        return
      }
    }
    setCapError('')

    const savedNode = {
      uboName:      form.uboName.trim(),
      uboId:        form.uboId.trim(),
      ownershipPct: isTrustRole ? 0 : (Number(form.ownershipPct) || 0),
      role:         form.role,
      isEntity:     form.isEntity,
      entityType:   form.isEntity ? form.entityType : '',
      ficStatus:    form.ficStatus,
      unStatus:     form.unStatus,
      notes:        form.notes,
      savedAt:      new Date().toISOString().split('T')[0],
    }

    let updated
    if (editingId) {
      // preserve children when editing
      updated = updateInTree(ubos, editingId, n => ({ ...n, ...savedNode }))
    } else {
      const newNode = { ...savedNode, id: genId(), children: [] }
      updated = addToParent(ubos, formParentId, newNode)
    }

    setUbos(updated)
    await persist(updated)
    closeForm()
  }

  async function persist(list) {
    if (!party) return
    setSaving(true)
    try {
      await updateParty(party.id, { ubos: list })
      setSavedMsg('Saved ✓')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch {
      setSavedMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }


  // ── Print / Download ──
  function printUBOTree() {
    function roleColor(role) {
      const m = { Shareholder: '#c56003', Member: '#c56003', Trustee: '#7c3aed',
        Beneficiary: '#a21caf', Partner: '#065f46', Director: '#c2410c', Controller: '#dc2626' }
      return m[role] || '#64748b'
    }
    function statusColor(s) {
      return s === 'clear' ? '#16a34a' : s === 'flagged' ? '#dc2626' : '#d97706'
    }

    function nodeHtml(node, depth) {
      const isTrustRole = TRUST_ROLES.has(node.role)
      const pct = Number(node.ownershipPct) || 0
      const allClear = node.ficStatus === 'clear' && node.unStatus === 'clear'
      const anyFlagged = node.ficStatus === 'flagged' || node.unStatus === 'flagged'
      const sc = anyFlagged ? '#dc2626' : allClear ? '#16a34a' : '#d97706'
      const bg = anyFlagged ? '#fef2f2' : allClear ? '#f0fdf4' : '#fffbeb'
      const br = anyFlagged ? '#fca5a5' : allClear ? '#bbf7d0' : '#fcd34d'
      const needsLook = node.isEntity && (!node.children || node.children.length === 0)
      const childHtml = (node.children || []).map(c => nodeHtml(c, depth + 1)).join('')
      const indent = depth * 28

      return `
        <div style="margin-left:${indent}px; margin-bottom:8px; ${depth > 0 ? 'border-left:2px dashed #cbd5e1; padding-left:12px; margin-top:6px;' : ''}">
          <div style="background:${bg}; border:1.5px solid ${br}; border-radius:8px; padding:10px 14px;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-weight:700; font-size:13px; color:#0f172a;">
              ${node.uboName}
              <span style="background:${roleColor(node.role)}; color:#fff; padding:1px 8px; border-radius:10px; font-size:11px;">${node.role}</span>
              ${node.isEntity && node.entityType ? `<span style="background:#f1f5f9; color:#475569; padding:1px 8px; border-radius:10px; font-size:11px;">${node.entityType}</span>` : ''}
              ${!isTrustRole && pct > 0 ? `<span style="color:${sc}; font-size:12px;">${pct}%${pct >= 5 ? ' \u26a0' : ''}</span>` : ''}
            </div>
            <div style="font-size:11px; color:#64748b; margin-top:5px;">
              ID/Reg: <span style="font-family:monospace;">${node.uboId || '\u2014'}</span>
              &nbsp;|&nbsp; FIC:&nbsp;<strong style="color:${statusColor(node.ficStatus)}">${node.ficStatus.toUpperCase()}</strong>
              &nbsp;|&nbsp; UN:&nbsp;<strong style="color:${statusColor(node.unStatus)}">${node.unStatus.toUpperCase()}</strong>
              ${node.notes ? `<br/><em style="color:#94a3b8; font-size:11px;">${node.notes}</em>` : ''}
              ${needsLook ? '<br/><span style="color:#92400e; font-weight:600; font-size:11px;">\u26a0 Look-through required \u2014 UBOs of this entity not yet recorded</span>' : ''}
            </div>
          </div>
          ${childHtml}
        </div>`
    }

    const treeHtml = ubos.map(n => nodeHtml(n, 0)).join('')
    const tx = transactions.find(t => t.id === Number(transactionId))
    const dateStr = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
    const bannerBg = incomplete ? '#fffbeb' : '#f0fdf4'
    const bannerColor = incomplete ? '#92400e' : '#166534'
    const bannerBorder = incomplete ? '#fcd34d' : '#bbf7d0'
    const bannerText = incomplete
      ? '\u26a0 Look-through incomplete \u2014 one or more intermediate entities still need UBOs identified.'
      : '\u2713 Look-through complete \u2014 all entities traced to natural persons or trust beneficiaries.'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>UBO Report \u2014 ${party?.clientName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f172a; padding: 36px; max-width: 860px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #0f172a; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .party-block { background: #111111; color: #fff; padding: 14px 20px; border-radius: 10px; margin-bottom: 22px; }
    .party-block h2 { margin: 0; font-size: 17px; font-weight: 700; }
    .party-block p  { margin: 4px 0 0; font-size: 12px; opacity: 0.72; }
    .banner { padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; margin-top: 24px; }
    .print-btn { padding: 9px 22px; background: #111111; color: #fff; border: none;
      border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 700;
      margin-bottom: 22px; display: inline-flex; align-items: center; gap: 7px; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 22px 0; }
    .footer { font-size: 11px; color: #94a3b8; margin-top: 28px; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">&#128438; Print / Save as PDF</button>
  <h1>UBO / Entity Identification Report</h1>
  <div class="meta">
    Generated: ${dateStr}
    &nbsp;&nbsp;|&nbsp;&nbsp; Transaction: ${tx?.property || ('Transaction #' + transactionId)} \u2014 ${tx?.type || ''}
  </div>
  <div class="party-block">
    <h2>${party?.clientName}</h2>
    <p>${party?.clientType}</p>
  </div>
  ${treeHtml || '<p style="color:#94a3b8; font-size:13px;">No beneficial owners recorded.</p>'}
  <hr/>
  <div class="banner" style="background:${bannerBg}; color:${bannerColor}; border:1px solid ${bannerBorder};">
    ${bannerText}
  </div>
  <p class="footer">
    Generated by Miltons Matsemela Miltons Matsemela FICA Portal \u2014 ${dateStr}.<br/>
    Retain as part of your FICA client due diligence file.
  </p>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this site.'); return }
    win.document.write(html)
    win.document.close()
  }

  const totalCount = countAll(ubos)
  const incomplete = hasIncomplete(ubos)

  const inpStyle = {
    width: '100%', padding: '0.6rem 0.875rem',
    border: '1.5px solid #d1d5db', borderRadius: 8,
    fontSize: '0.875rem', outline: 'none', background: '#fff', boxSizing: 'border-box',
  }
  const selStyle = { ...inpStyle }

  // ── Render ──
  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>
          UBO / Entity Identification
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
          Identify Ultimate Beneficial Owners. Apply look-through to all intermediate entities — trace every ownership chain to natural persons.
        </p>
      </div>

      {entityParties.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center',
          color: '#94a3b8', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <GitBranch size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p>No entity parties yet. Add a Company, CC, Trust or Partnership to a transaction first.</p>
        </div>
      ) : (
        <>
          {/* ── Selectors ── */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8,
                  fontSize: '0.875rem', color: '#374151' }}>Transaction</label>
                <select value={transactionId}
                  onChange={e => { setTransactionId(e.target.value); setPartyId('') }}
                  style={selStyle}>
                  <option value="">— Select transaction —</option>
                  {transactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.property || `Transaction #${t.id}`} — {t.type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8,
                  fontSize: '0.875rem', color: '#374151' }}>Entity Party</label>
                <select value={partyId} onChange={e => setPartyId(e.target.value)}
                  disabled={!transactionId}
                  style={{ ...selStyle, opacity: transactionId ? 1 : 0.5 }}>
                  <option value="">— Select entity —</option>
                  {txEntityParties.map(p => {
                    const n = countAll(normalizeTree(p.ubos || []))
                    return (
                      <option key={p.id} value={p.id}>
                        {p.clientName} ({p.clientType}){n > 0 ? ` · ${n} recorded` : ''}
                      </option>
                    )
                  })}
                </select>
                {transactionId && txEntityParties.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 5 }}>
                    No entity parties on this transaction.
                  </p>
                )}
              </div>
            </div>
          </div>

          {partyId && (
            <>
              {/* ── Tree panel ── */}
              <div style={{ background: '#fff', borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>
                    Beneficial Owners — {party?.clientName}
                    {totalCount > 0 && (
                      <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 400, color: '#64748b' }}>
                        {totalCount} recorded
                        {incomplete && (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>
                            {' · '}⚠ look-through incomplete
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {savedMsg && (
                      <span style={{ fontSize: '0.82rem', fontWeight: 600,
                        color: savedMsg.includes('failed') ? '#dc2626' : '#16a34a' }}>
                        {savedMsg}
                      </span>
                    )}
                    {ubos.length > 0 && (
                      <button onClick={printUBOTree}
                        title="Print / Download PDF"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9rem',
                          background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0', borderRadius: 8,
                          cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                        <Printer size={14} /> Print
                      </button>
                    )}
                    <button onClick={openAddRoot}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
                        background: '#e77204', color: '#fff', border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.5rem' }}>
                  {ubos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', padding: '1.5rem 0' }}>
                      No beneficial owners recorded yet. Click <strong>Add</strong> to begin.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ubos.map(node => (
                        <UBONode key={node.id} node={node} depth={0}
                          onEdit={openEdit} onDelete={handleDelete} onAddChild={openAddChild} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Add / Edit form ── */}
              {showForm && (
                <div style={{ background: '#fff', borderRadius: 12,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.5rem', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>
                      {editingId
                        ? 'Edit Entry'
                        : formParentName
                          ? `Add UBO of "${formParentName}"`
                          : `Add Trustee / Shareholder / Beneficiary`}
                    </div>
                    {formParentName && !editingId && (
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                        Identifying the beneficial owners of the intermediate entity above.
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSaveUBO} style={{ padding: '1.5rem' }}>
                    {/* Row 1: Name + ID */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>Full Name *</label>
                        <input required value={form.uboName}
                          onChange={e => setForm(f => ({ ...f, uboName: e.target.value }))}
                          placeholder="Jane Doe or ABC Holdings (Pty) Ltd"
                          style={inpStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>
                          {form.isEntity ? 'Registration Number *' : 'ID / Passport Number *'}
                        </label>
                        <input required value={form.uboId}
                          onChange={e => setForm(f => ({ ...f, uboId: e.target.value }))}
                          placeholder={form.isEntity ? '2020/123456/07' : '8001015009087'}
                          style={inpStyle} />
                      </div>
                    </div>

                    {/* Row 2: Role + Natural person / Entity toggle */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>Role *</label>
                        <select value={form.role}
                          onChange={e => setForm(f => ({
                            ...f, role: e.target.value,
                            ownershipPct: TRUST_ROLES.has(e.target.value) ? '' : f.ownershipPct,
                          }))}
                          style={selStyle}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>This entry is a…</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[
                            { label: 'Natural Person', val: false, bg: '#fff7ed', border: '#111111', color: '#111111', inactBg: '#fff' },
                            { label: 'Entity', val: true, bg: '#faf5ff', border: '#7c3aed', color: '#7c3aed', inactBg: '#fff' },
                          ].map(opt => (
                            <label key={String(opt.val)} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flex: 1, padding: '0.58rem', cursor: 'pointer', borderRadius: 8,
                              border: `2px solid ${form.isEntity === opt.val ? opt.border : '#e2e8f0'}`,
                              background: form.isEntity === opt.val ? opt.bg : opt.inactBg,
                              color: form.isEntity === opt.val ? opt.color : '#64748b',
                              fontSize: '0.83rem', fontWeight: 600,
                            }}>
                              <input type="radio" style={{ display: 'none' }}
                                checked={form.isEntity === opt.val}
                                onChange={() => setForm(f => ({ ...f, isEntity: opt.val, entityType: '' }))} />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Entity type (visible only when entity) */}
                    {form.isEntity && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>Entity Type *</label>
                        <select required={form.isEntity} value={form.entityType}
                          onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}
                          style={selStyle}>
                          <option value="">— Select type —</option>
                          {UBO_ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <p style={{ fontSize: '0.78rem', color: '#7c3aed', marginTop: 5, fontWeight: 600 }}>
                          ⚠ This is an entity — after saving, click <strong>Add</strong> on this entry to identify its UBOs.
                        </p>
                      </div>
                    )}

                    {/* Ownership % */}
                    {isTrustRole ? (
                      <div style={{ marginBottom: '1rem', padding: '0.5rem 0.875rem',
                        background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Ownership % is not applicable for Trustee / Beneficiary roles.
                        </span>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                          fontSize: '0.82rem', color: '#374151' }}>
                          Ownership / Beneficial Interest %
                          <span style={{ marginLeft: 8, fontWeight: 400, color: '#64748b', fontSize: '0.78rem' }}>
                            ({100 - otherTotal}% available in this group)
                          </span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="number" min="0" max="100" value={form.ownershipPct}
                            onChange={e => { setCapError(''); setForm(f => ({ ...f, ownershipPct: e.target.value })) }}
                            placeholder="e.g. 51"
                            style={{ width: 110, padding: '0.6rem 0.875rem',
                              border: `1.5px solid ${overCap ? '#dc2626' : '#d1d5db'}`,
                              borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: '#fff' }} />
                          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>%</span>
                          {Number(form.ownershipPct) >= 5 && !overCap && (
                            <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                              ⚠ Reportable beneficial interest (≥5%)
                            </span>
                          )}
                        </div>
                        {form.ownershipPct !== '' && (
                          <div style={{ marginTop: 5, fontSize: '0.78rem', fontWeight: 600,
                            color: overCap ? '#dc2626' : '#16a34a' }}>
                            {overCap
                              ? `⛔ Group total would be ${liveNewTotal}% — max ${100 - otherTotal}%.`
                              : `Group total after save: ${liveNewTotal}% (${100 - liveNewTotal}% remaining)`}
                          </div>
                        )}
                        {capError && (
                          <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                            {capError}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Screening */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8,
                        fontSize: '0.82rem', color: '#374151' }}>Screening Results</label>
                      {[
                        { key: 'ficStatus', label: 'FIC TFS',      url: 'https://tfs.fic.gov.za/Pages/Search' },
                        { key: 'unStatus',  label: 'UN Sanctions', url: 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list' },
                      ].map(({ key, label, url }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.75rem' }}>
                          <span style={{ width: 100, fontSize: '0.82rem', fontWeight: 600,
                            color: '#374151', flexShrink: 0 }}>{label}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem',
                              color: '#c56003', textDecoration: 'none', background: '#fff8f0',
                              padding: '3px 7px', borderRadius: 5, flexShrink: 0 }}>
                            Open <ExternalLink size={10} />
                          </a>
                          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                            {['clear', 'flagged', 'pending'].map(r => (
                              <button key={r} type="button"
                                onClick={() => setForm(f => ({ ...f, [key]: r }))}
                                style={{
                                  flex: 1, padding: '0.35rem',
                                  border: `2px solid ${form[key] === r
                                    ? (r === 'clear' ? '#16a34a' : r === 'flagged' ? '#dc2626' : '#d97706')
                                    : '#e2e8f0'}`,
                                  borderRadius: 6,
                                  background: form[key] === r
                                    ? (r === 'clear' ? '#f0fdf4' : r === 'flagged' ? '#fef2f2' : '#fffbeb')
                                    : '#fff',
                                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                  color: form[key] === r
                                    ? (r === 'clear' ? '#16a34a' : r === 'flagged' ? '#dc2626' : '#d97706')
                                    : '#94a3b8',
                                  textTransform: 'capitalize',
                                }}>
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 5,
                        fontSize: '0.82rem', color: '#374151' }}>Notes</label>
                      <textarea value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Additional notes…" rows={2}
                        style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0',
                          borderRadius: 8, fontSize: '0.84rem', outline: 'none', resize: 'vertical',
                          background: '#fff', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={closeForm}
                        style={{ padding: '0.55rem 1.1rem', border: '1.5px solid #e2e8f0',
                          borderRadius: 8, background: '#fff', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.84rem' }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={saving || overCap}
                        style={{ display: 'flex', alignItems: 'center', gap: 6,
                          padding: '0.55rem 1.1rem',
                          background: overCap ? '#94a3b8' : '#111111',
                          color: '#fff', border: 'none', borderRadius: 8,
                          cursor: overCap ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: '0.84rem' }}>
                        <Save size={14} /> {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Completion banner ── */}
              {ubos.length > 0 && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
                  background: incomplete ? '#fffbeb' : '#f0fdf4',
                  color: incomplete ? '#92400e' : '#166534',
                  border: `1px solid ${incomplete ? '#fcd34d' : '#bbf7d0'}`,
                }}>
                  {incomplete
                    ? '⚠ Look-through incomplete — one or more intermediate entities still need their UBOs identified.'
                    : '✓ Look-through complete — all entities traced to natural persons or trust beneficiaries.'}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
