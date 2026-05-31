import React, { useState, useMemo } from 'react'
import { useApp } from '../context.jsx'
import { DOC_LIST } from '../store.js'
import { useBreakpoint } from '../hooks/useBreakpoint.js'
import { FileText, Printer, Users, AlertTriangle, CheckCircle2, Clock, ShieldAlert, FolderOpen, RefreshCw } from 'lucide-react'

const RESCREEN_MONTHS = 12

const ROLE_COLORS = {
  'Buyer': '#c56003', 'Co-Buyer': '#2563eb',
  'Seller': '#be185d', 'Co-Seller': '#db2777',
  'Landlord': '#15803d', 'Tenant': '#16a34a',
  'Power of Attorney': '#b45309', 'Trustee': '#d97706',
  'Executor': '#7e22ce',
}

function monthsAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44))
}

function normaliseDoc(val) {
  if (!val) return null
  if (val === true) return { status: 'uploaded' }
  return val
}

function badgeHtml(status) {
  const map = { clear: ['#f0fdf4','#16a34a'], flagged: ['#fef2f2','#dc2626'], pending: ['#fffbeb','#d97706'] }
  const [bg, color] = map[status] || ['#f1f5f9','#64748b']
  return `<span style="background:${bg};color:${color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:capitalize">${status || 'pending'}</span>`
}

function riskBadgeHtml(rating) {
  if (!rating) return '<span style="color:#94a3b8">—</span>'
  const color = rating === 'High' ? '#dc2626' : rating === 'Medium' ? '#d97706' : '#16a34a'
  const bg    = rating === 'High' ? '#fef2f2' : rating === 'Medium' ? '#fffbeb' : '#f0fdf4'
  return `<span style="background:${bg};color:${color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${rating} Risk</span>`
}

function partySection(party) {
  const docs      = party.docs || {}
  const ubos      = party.ubos || []
  const isPep = party.pepStatus === 'flagged' ||
    (party.riskCriteria?.pepStatus && party.riskCriteria.pepStatus !== 'Not a PEP') ||
    party.pepAuthStatus != null
  const docEntries = DOC_LIST.filter(d => d !== 'Source of Funds Declaration' || isPep)
  const docsUploaded = docEntries.filter(d => normaliseDoc(docs[d])).length
  const docsVerified = docEntries.filter(d => { const n = normaliseDoc(docs[d]); return n && n.status === 'verified' }).length
  const riskColor = party.riskRating === 'High' ? '#dc2626' : party.riskRating === 'Medium' ? '#d97706' : '#16a34a'
  const roleColor = ROLE_COLORS[party.role] || '#64748b'

  const docRows = docEntries.map(doc => {
    const d = normaliseDoc(docs[doc])
    const status = !d ? 'Outstanding' : d.status === 'verified' ? 'Verified' : 'Uploaded'
    const color = !d ? '#dc2626' : d.status === 'verified' ? '#16a34a' : '#d97706'
    return `<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${doc}</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:${color};font-weight:700">${!d ? '✗' : '✓'} ${status}</td></tr>`
  }).join('')

  const uboRows = ubos.length > 0
    ? ubos.map(u => `<tr>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${u.uboName || '—'}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${u.uboId || '—'}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${u.ownershipPct ? u.ownershipPct + '%' : '—'}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(u.ficStatus)}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(u.unStatus)}</td>
        <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(u.pepStatus)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="padding:8px 10px;color:#94a3b8">No UBOs recorded</td></tr>'

  return `
<div style="border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:24px;overflow:hidden">
  <div style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
    <div>
      <span style="font-weight:700;font-size:14px;color:#0f172a">${party.clientName}</span>
      <span style="background:${roleColor}18;color:${roleColor};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-left:8px">${party.role}</span>
    </div>
    <div style="font-size:11px;color:#64748b">${party.clientType} · ${party.clientIdNumber || '—'}</div>
  </div>
  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Date of Birth</label><span style="font-weight:700">${party.clientDob || '—'}</span></div>
      <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Place of Birth</label><span style="font-weight:700">${party.clientPob || '—'}</span></div>
      <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Nationality</label><span style="font-weight:700">${party.clientNationality || '—'}</span></div>
    </div>
    <h3 style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin:12px 0 10px">Screening Results</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <thead><tr>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Check</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Result</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Date Screened</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">FIC Terrorist Financing</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(party.ficStatus)}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${party.screeningDate || '—'}</td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">UN Sanctions</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(party.unStatus)}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${party.screeningDate || '—'}</td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">PEP (Politically Exposed Person)</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${badgeHtml(party.pepStatus)}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${party.screeningDate || '—'}</td></tr>
        <tr><td style="padding:6px 10px">Adverse Media</td><td style="padding:6px 10px">${badgeHtml(party.adverseMediaStatus)}</td><td style="padding:6px 10px">${party.screeningDate || '—'}</td></tr>
      </tbody>
    </table>
    ${party.screeningNotes ? `<p style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:12px;color:#92400e;margin:0 0 12px"><strong>Notes:</strong> ${party.screeningNotes}</p>` : ''}
    <h3 style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin:12px 0 10px">Risk Rating</h3>
    ${party.riskRating ? `
    <div style="background:${party.riskRating==='High'?'#fef2f2':party.riskRating==='Medium'?'#fffbeb':'#f0fdf4'};border:2px solid ${riskColor}30;border-radius:8px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div><div style="font-size:11px;color:#64748b">Risk Score</div><div style="font-size:24px;font-weight:900;color:${riskColor}">${party.riskScore || '—'}/8</div></div>
      <div style="text-align:center"><div style="font-size:11px;color:#64748b">Rating</div><div style="font-size:16px;font-weight:800;color:${riskColor}">${party.riskRating} Risk</div></div>
    </div>` : '<p style="color:#94a3b8;font-size:12px">Risk rating not yet completed.</p>'}
    ${party.reviewDate ? `<p style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px 12px;border-radius:6px;font-size:12px;color:#1d4ed8;margin:0 0 12px"><strong>Next Review Date:</strong> ${party.reviewDate}</p>` : ''}
    <h3 style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin:12px 0 10px">Document Checklist (${docsVerified}/${docEntries.length} verified)</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <thead><tr>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Document</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Status</th>
      </tr></thead>
      <tbody>${docRows}</tbody>
    </table>
    ${['Company','CC','Trust','Partnership'].some(t => party.clientType?.includes(t)) ? `
    <h3 style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin:12px 0 10px">Ultimate Beneficial Owners</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Name</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">ID / Passport</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Ownership</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">FIC</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">UN</th>
        <th style="background:#f8fafc;padding:6px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">PEP</th>
      </tr></thead>
      <tbody>${uboRows}</tbody>
    </table>` : ''}
  </div>
</div>`
}

function generateReportHTML(tx, txParties, userName) {
  const anyFlagged = txParties.some(p => p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged')
  const allClear   = txParties.length > 0 && txParties.every(p => p.ficStatus==='clear'&&p.unStatus==='clear'&&p.pepStatus==='clear'&&p.adverseMediaStatus==='clear')
  const overallStatus = anyFlagged ? 'FLAGGED' : allClear ? 'CLEAR' : 'IN PROGRESS'
  const overallColor  = anyFlagged ? '#dc2626' : allClear ? '#16a34a' : '#d97706'
  const overallBg     = anyFlagged ? '#fef2f2' : allClear ? '#f0fdf4' : '#fffbeb'
  const partiesHtml   = txParties.map(p => partySection(p)).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FICA Report — ${tx.property||tx.type}</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1e293b;font-size:13px}.header{background:#0f172a;color:#fff;padding:24px 32px;border-radius:10px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start}.footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;color:#94a3b8;font-size:11px;display:flex;justify-content:space-between}@media print{body{padding:20px}}</style>
</head><body>
<div style="text-align:right;margin-bottom:16px"><button onclick="window.print()" style="display:inline-flex;align-items:center;gap:8px;background:#111111;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">&#128438; Print / Save PDF</button></div>
<div class="header">
  <div><h1 style="margin:0 0 4px;font-size:20px">FICA Compliance Report</h1><p style="margin:0;opacity:.7;font-size:12px">Miltons Matsemela — Compliance Portal</p></div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:900">${tx.property||'—'}</div>
    <div style="opacity:.7;font-size:12px;margin-top:4px">${tx.type} · R ${Number(tx.value||0).toLocaleString('en-ZA')}</div>
    <div style="margin-top:8px;background:${overallBg};color:${overallColor};padding:3px 14px;border-radius:20px;font-size:12px;font-weight:800;display:inline-block">${overallStatus}</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
  <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Transaction Type</label><span style="font-weight:700">${tx.type}</span></div>
  <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Transaction Value</label><span style="font-weight:700">R ${Number(tx.value||0).toLocaleString('en-ZA')}</span></div>
  <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Parties</label><span style="font-weight:700">${txParties.length}</span></div>
  <div style="background:#f8fafc;border-radius:8px;padding:10px 14px"><label style="font-size:11px;color:#64748b;display:block;margin-bottom:3px">Generated</label><span style="font-weight:700">${new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}</span></div>
</div>
<h2 style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 16px">Transaction Parties (${txParties.length})</h2>
${txParties.length>0?partiesHtml:'<p style="color:#94a3b8;text-align:center;padding:2rem">No parties on this transaction.</p>'}
<div class="footer"><span>Miltons Matsemela — Miltons Matsemela FICA Portal</span><span>Prepared by: ${userName||'System'} | ${new Date().toLocaleDateString('en-ZA')}</span></div>
</body></html>`
}

function StatusBadge({ status }) {
  const map = { clear: ['#f0fdf4','#16a34a'], flagged: ['#fef2f2','#dc2626'], pending: ['#fffbeb','#d97706'] }
  const [bg, color] = map[status] || ['#f1f5f9','#64748b']
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>{status}</span>
}

function RiskChip({ label, active, count, onClick }) {
  const colors = {
    All:     { bg: active ? '#111111' : '#f1f5f9', color: active ? '#fff' : '#374151' },
    Low:     { bg: active ? '#16a34a' : '#f0fdf4', color: active ? '#fff' : '#16a34a' },
    Medium:  { bg: active ? '#d97706' : '#fffbeb', color: active ? '#fff' : '#d97706' },
    High:    { bg: active ? '#dc2626' : '#fef2f2', color: active ? '#fff' : '#dc2626' },
    Unrated: { bg: active ? '#64748b' : '#f8fafc', color: active ? '#fff' : '#64748b' },
  }
  const c = colors[label] || colors.All
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.875rem', background: c.bg, color: c.color, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}>
      {label} {count !== undefined && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '0px 6px', fontSize: '0.72rem' }}>{count}</span>}
    </button>
  )
}

export default function Reports() {
  const { transactions, parties, currentUser } = useApp()
  const { isMobile } = useBreakpoint()
  const [activeTab, setActiveTab]   = useState('transactions')
  const [search, setSearch]         = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [showExport, setShowExport] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────────────

  const flaggedParties = useMemo(() =>
    parties.filter(p => p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged'),
    [parties]
  )

  const highRiskTxCount = useMemo(() =>
    transactions.filter(tx => parties.some(p => p.transactionId===tx.id && p.riskRating==='High')).length,
    [transactions, parties]
  )

  const outstandingDocParties = useMemo(() =>
    parties.filter(p => {
      const docs = p.docs || {}
      const isPep = p.pepStatus === 'flagged' ||
        (p.riskCriteria?.pepStatus && p.riskCriteria.pepStatus !== 'Not a PEP') ||
        p.pepAuthStatus != null
      const docList = DOC_LIST.filter(d => d !== 'Source of Funds Declaration' || isPep)
      return docList.some(d => !normaliseDoc(docs[d]))
    }),
    [parties]
  )

  const screeningDueParties = useMemo(() => {
    const seen = new Set()
    return parties.filter(p => {
      if (seen.has(p.clientId)) return false
      const m = monthsAgo(p.screeningDate)
      const due = m === null || m >= RESCREEN_MONTHS
      if (due) seen.add(p.clientId)
      return due
    })
  }, [parties])

  // ── Transaction filters ───────────────────────────────────────────────────────

  const riskCounts = useMemo(() => {
    const counts = { All: transactions.length, Low: 0, Medium: 0, High: 0, Unrated: 0 }
    transactions.forEach(tx => {
      const txP = parties.filter(p => p.transactionId === tx.id)
      if (txP.some(p => p.riskRating === 'High'))        counts.High++
      else if (txP.some(p => p.riskRating === 'Medium')) counts.Medium++
      else if (txP.some(p => p.riskRating === 'Low'))    counts.Low++
      else                                                counts.Unrated++
    })
    return counts
  }, [transactions, parties])

  const filteredTx = useMemo(() => {
    return transactions.filter(tx => {
      const txP = parties.filter(p => p.transactionId === tx.id)
      // search
      if (search && !(tx.property||'').toLowerCase().includes(search.toLowerCase()) &&
          !(tx.type||'').toLowerCase().includes(search.toLowerCase())) return false
      // risk filter
      if (riskFilter !== 'All') {
        const hasHigh   = txP.some(p => p.riskRating === 'High')
        const hasMed    = txP.some(p => p.riskRating === 'Medium')
        const hasLow    = txP.some(p => p.riskRating === 'Low')
        const hasRated  = hasHigh || hasMed || hasLow
        if (riskFilter === 'High'    && !hasHigh)              return false
        if (riskFilter === 'Medium'  && (hasHigh || !hasMed))  return false
        if (riskFilter === 'Low'     && (hasHigh||hasMed||!hasLow)) return false
        if (riskFilter === 'Unrated' && hasRated)              return false
      }
      return true
    })
  }, [transactions, parties, search, riskFilter])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function openReport(tx) {
    const txParties = parties.filter(p => p.transactionId === tx.id)
    const html = generateReportHTML(tx, txParties, currentUser?.name)
    const win = window.open('', '_blank')
    if (!win) { alert('Please allow popups for this site.'); return }
    win.document.write(html)
    win.document.close()
  }

  function txForParty(partyOrId) {
    const tid = typeof partyOrId === 'object' ? partyOrId.transactionId : partyOrId
    return transactions.find(t => t.id === tid)
  }

  // ── Export functions ──────────────────────────────────────────────────────────

  function exportCSV() {
    const rows = []
    // Header
    rows.push([
      'Transaction ID','Property','Type','Value (ZAR)','Status','Transaction Notes','Created',
      'Party Name','ID Number','Client Type','Role',
      'FIC Status','UN Status','PEP Status','Adverse Media',
      'Risk Score','Risk Rating','Screening Date','Review Date',
      'SA ID / Passport','Proof of Address','FIC Questionnaire',
      'Source of Funds Declaration','Overall Docs','Party Notes'
    ])
    transactions.forEach(tx => {
      const txParties = parties.filter(p => p.transactionId === tx.id)
      if (txParties.length === 0) {
        rows.push([tx.id, tx.property||'', tx.type, tx.value||0, tx.status, tx.notes||'', tx.createdAt,
          '—','—','—','—','—','—','—','—','—','—','—','—','—','—','—','—','—','—'])
      } else {
        txParties.forEach(p => {
          const docs = p.docs || {}
          const nd = v => { if (!v) return 'Not uploaded'; if (v===true) return 'Uploaded'; return v.status==='verified'?'Verified':'Uploaded' }
          const isPep = p.pepStatus==='flagged'||(p.riskCriteria?.pepStatus&&p.riskCriteria.pepStatus!=='Not a PEP')||p.pepAuthStatus!=null
          const docList = ['SA ID / Passport','Proof of Address (<=3 months)','FIC Questionnaire']
          const allDocs = isPep ? [...docList,'Source of Funds Declaration'] : docList
          const uploaded = allDocs.filter(d => docs[d] && docs[d] !== false).length
          rows.push([
            tx.id, tx.property||'', tx.type, tx.value||0, tx.status, tx.notes||'', tx.createdAt,
            p.clientName||'', p.clientIdNumber||'', p.clientType||'', p.role||'',
            p.ficStatus||'', p.unStatus||'', p.pepStatus||'', p.adverseMediaStatus||'',
            p.riskScore||'', p.riskRating||'', p.screeningDate||'', p.reviewDate||'',
            nd(docs['SA ID / Passport']), nd(docs['Proof of Address (<=3 months)']),
            nd(docs['FIC Questionnaire']),
            isPep ? nd(docs['Source of Funds Declaration']) : 'N/A (not a PEP)',
            `${uploaded}/${allDocs.length}`, p.notes||''
          ])
        })
      }
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TP-FICA-Compliance-Export-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const date = new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})
    const totalParties = parties.length
    const flagged = parties.filter(p=>p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged').length
    const highRisk = parties.filter(p=>p.riskRating==='High').length

    const txSections = transactions.map(tx => {
      const txP = parties.filter(p => p.transactionId === tx.id)
      const anyFlag = txP.some(p=>p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged')
      const allClr  = txP.length>0&&txP.every(p=>p.ficStatus==='clear'&&p.unStatus==='clear'&&p.pepStatus==='clear'&&p.adverseMediaStatus==='clear')
      const status  = anyFlag?'FLAGGED':allClr?'CLEAR':'IN PROGRESS'
      const scol    = anyFlag?'#dc2626':allClr?'#16a34a':'#d97706'
      const rows    = txP.map(p => {
        const isPep = p.pepStatus==='flagged'||(p.riskCriteria?.pepStatus&&p.riskCriteria.pepStatus!=='Not a PEP')||p.pepAuthStatus!=null
        const docList = isPep
          ? ['SA ID / Passport','Proof of Address (<=3 months)','FIC Questionnaire','Source of Funds Declaration']
          : ['SA ID / Passport','Proof of Address (<=3 months)','FIC Questionnaire']
        const docs = p.docs||{}
        const verified = docList.filter(d=>{const n=docs[d];return n&&n!==false&&(n===true||n.status==='verified')}).length
        const screening = anyFlag?`<span style="color:#dc2626;font-weight:700">⚑ FLAGGED</span>`
          :(p.ficStatus==='clear'&&p.unStatus==='clear'&&p.pepStatus==='clear'&&p.adverseMediaStatus==='clear')?`<span style="color:#16a34a;font-weight:700">✓ Clear</span>`
          :`<span style="color:#d97706;font-weight:700">⏳ Pending</span>`
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:600">${p.clientName||'—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">${p.role||'—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${screening}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9">${p.riskRating?`<span style="color:${p.riskRating==='High'?'#dc2626':p.riskRating==='Medium'?'#d97706':'#16a34a'};font-weight:700">${p.riskRating}</span>`:'<span style="color:#94a3b8">—</span>'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px">${verified}/${docList.length} verified</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">${p.screeningDate||'—'}</td>
        </tr>`
      }).join('')

      return `<div style="border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:20px;overflow:hidden;page-break-inside:avoid">
        <div style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-weight:700;font-size:14px">${tx.property||'(No address)'}</span>
            <span style="margin-left:10px;font-size:11px;color:#64748b">${tx.type} · R ${Number(tx.value||0).toLocaleString('en-ZA')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:12px;color:#64748b">${txP.length} ${txP.length===1?'party':'parties'}</span>
            <span style="font-size:11px;font-weight:800;color:${scol};background:${anyFlag?'#fef2f2':allClr?'#f0fdf4':'#fffbeb'};padding:2px 12px;border-radius:20px">${status}</span>
          </div>
        </div>
        ${txP.length===0?'<p style="padding:12px 16px;color:#94a3b8;font-size:12px;margin:0">No parties on this transaction.</p>':`
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Party</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Role</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Screening</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Risk</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Docs</th>
            <th style="padding:6px 10px;text-align:left;font-size:11px;color:#64748b">Screened</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MM FICA Compliance Export — ${date}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1e293b;font-size:13px}
  @media print{body{padding:20px}.no-print{display:none}@page{margin:15mm}}
</style></head><body>
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:8px;background:#111111;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">&#128438; Print / Save PDF</button>
</div>
<div style="background:#0f172a;color:#fff;padding:24px 32px;border-radius:10px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start">
  <div><h1 style="margin:0 0 4px;font-size:20px">FICA Compliance Portfolio Export</h1><p style="margin:0;opacity:.7;font-size:12px">Miltons Matsemela — Full Portfolio</p></div>
  <div style="text-align:right;font-size:12px;opacity:.8">${date}<br/>Prepared by: ${currentUser?.name||'System'}</div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
  <div style="background:#f8fafc;border-radius:8px;padding:12px 16px"><div style="font-size:11px;color:#64748b;margin-bottom:4px">Total Transactions</div><div style="font-size:22px;font-weight:900">${transactions.length}</div></div>
  <div style="background:#f8fafc;border-radius:8px;padding:12px 16px"><div style="font-size:11px;color:#64748b;margin-bottom:4px">Total Parties</div><div style="font-size:22px;font-weight:900">${totalParties}</div></div>
  <div style="background:${flagged>0?'#fef2f2':'#f0fdf4'};border-radius:8px;padding:12px 16px"><div style="font-size:11px;color:#64748b;margin-bottom:4px">Flagged Parties</div><div style="font-size:22px;font-weight:900;color:${flagged>0?'#dc2626':'#16a34a'}">${flagged}</div></div>
  <div style="background:${highRisk>0?'#fffbeb':'#f0fdf4'};border-radius:8px;padding:12px 16px"><div style="font-size:11px;color:#64748b;margin-bottom:4px">High Risk Parties</div><div style="font-size:22px;font-weight:900;color:${highRisk>0?'#d97706':'#16a34a'}">${highRisk}</div></div>
</div>
<h2 style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 20px">Transactions (${transactions.length})</h2>
${transactions.length===0?'<p style="color:#94a3b8;text-align:center;padding:2rem">No transactions on record.</p>':txSections}
<div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;color:#94a3b8;font-size:11px;display:flex;justify-content:space-between">
  <span>Miltons Matsemela — Miltons Matsemela FICA Portal</span>
  <span>Exported: ${date}</span>
</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Please allow popups for this site.'); return }
    win.document.write(html)
    win.document.close()
  }

  // ── Stat cards ────────────────────────────────────────────────────────────────

  const stats = [
    { label: 'Total Transactions', value: transactions.length, icon: <FileText size={18} />, color: '#111111', bg: '#fff7ed' },
    { label: 'Flagged Parties',    value: flaggedParties.length, icon: <ShieldAlert size={18} />, color: flaggedParties.length > 0 ? '#dc2626' : '#16a34a', bg: flaggedParties.length > 0 ? '#fef2f2' : '#f0fdf4' },
    { label: 'High Risk Txns',     value: highRiskTxCount, icon: <AlertTriangle size={18} />, color: highRiskTxCount > 0 ? '#d97706' : '#16a34a', bg: highRiskTxCount > 0 ? '#fffbeb' : '#f0fdf4' },
    { label: 'Docs Outstanding',   value: outstandingDocParties.length, icon: <FolderOpen size={18} />, color: outstandingDocParties.length > 0 ? '#d97706' : '#16a34a', bg: outstandingDocParties.length > 0 ? '#fffbeb' : '#f0fdf4' },
    { label: 'Screening Due',      value: screeningDueParties.length, icon: <RefreshCw size={18} />, color: screeningDueParties.length > 0 ? '#d97706' : '#16a34a', bg: screeningDueParties.length > 0 ? '#fffbeb' : '#f0fdf4' },
  ]

  const tabs = [
    { id: 'transactions', label: 'Transactions', count: transactions.length },
    { id: 'flagged',      label: 'Flagged',      count: flaggedParties.length,        alert: flaggedParties.length > 0 },
    { id: 'documents',    label: 'Docs Outstanding', count: outstandingDocParties.length, alert: outstandingDocParties.length > 0 },
    { id: 'screening',    label: 'Screening Due', count: screeningDueParties.length,   alert: screeningDueParties.length > 0 },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D' }}>KYC Reports</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 2 }}>
            Generate compliance reports and monitor flagged parties, outstanding documents and screening status.
          </p>
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowExport(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', width: isMobile ? '100%' : 'auto' }}
          >
            <FileText size={15} /> Export ▾
          </button>
          {showExport && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 200, overflow: 'hidden' }}>
              <button onClick={() => { exportCSV(); setShowExport(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#0D0D0D', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                📊 Download CSV
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>Excel-compatible</span>
              </button>

              <div style={{ height: 1, background: '#f1f5f9' }} />
              <button onClick={() => { exportPDF(); setShowExport(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#0D0D0D', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                🖨️ Print / Save PDF
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>Full portfolio</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary stat bar */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '0.4rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#111111' : '#64748b',
              borderBottom: activeTab === tab.id ? '2px solid #111111' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            <span style={{
              background: tab.alert ? '#fef2f2' : '#f1f5f9',
              color: tab.alert ? '#dc2626' : '#64748b',
              borderRadius: 20, padding: '0px 7px', fontSize: '0.72rem', fontWeight: 700
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Transactions tab ─────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by property or type…"
              style={{ padding: '0.5rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', width: isMobile ? '100%' : 280, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All','Low','Medium','High','Unrated'].map(r => (
                <RiskChip key={r} label={r} active={riskFilter===r} count={riskCounts[r]} onClick={() => setRiskFilter(r)} />
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>No transactions match your filters.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredTx.map(tx => {
                const txParties  = parties.filter(p => p.transactionId === tx.id)
                const anyFlagged = txParties.some(p => p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged')
                const allClear   = txParties.length>0 && txParties.every(p => p.ficStatus==='clear'&&p.unStatus==='clear'&&p.pepStatus==='clear'&&p.adverseMediaStatus==='clear')
                const overallStatus = anyFlagged ? 'flagged' : allClear ? 'clear' : 'pending'
                const highRisk = txParties.some(p => p.riskRating==='High')
                const medRisk  = txParties.some(p => p.riskRating==='Medium')
                const riskLabel = highRisk ? 'High' : medRisk ? 'Medium' : txParties.some(p => p.riskRating==='Low') ? 'Low' : null
                return (
                  <div key={tx.id} style={{ background:'#fff', borderRadius:12, padding:'1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border: anyFlagged ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                      <div style={{ flex:1, overflow:'hidden', marginRight:10 }}>
                        <div style={{ fontWeight:700, fontSize:'0.95rem', color:'#0D0D0D', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.property||'(No address)'}</div>
                        <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:2 }}>{tx.type} · R {Number(tx.value||0).toLocaleString('en-ZA')}</div>
                      </div>
                      {riskLabel && (
                        <span style={{ background: riskLabel==='High'?'#fef2f2':riskLabel==='Medium'?'#fffbeb':'#f0fdf4', color: riskLabel==='High'?'#dc2626':riskLabel==='Medium'?'#d97706':'#16a34a', padding:'3px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700, flexShrink:0 }}>{riskLabel} Risk</span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'#64748b' }}>
                        <Users size={14} /><span>{txParties.length} {txParties.length===1?'party':'parties'}</span>
                      </div>
                      <StatusBadge status={overallStatus} />
                    </div>
                    {txParties.length > 0 && (
                      <div style={{ marginBottom:'0.875rem', display:'flex', flexDirection:'column', gap:4 }}>
                        {txParties.map(p => {
                          const pFlagged = p.ficStatus==='flagged'||p.unStatus==='flagged'||p.pepStatus==='flagged'||p.adverseMediaStatus==='flagged'
                          const pClear   = p.ficStatus==='clear'&&p.unStatus==='clear'&&p.pepStatus==='clear'&&p.adverseMediaStatus==='clear'
                          const dot = pFlagged ? '#ef4444' : pClear ? '#22c55e' : '#f59e0b'
                          return (
                            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.78rem' }}>
                              <span style={{ width:8, height:8, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }} />
                              <span style={{ fontWeight:600, color:'#374151', flex:1 }}>{p.clientName}</span>
                              <span style={{ color: ROLE_COLORS[p.role]||'#64748b', fontSize:'0.72rem', fontWeight:600 }}>{p.role}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {txParties.length === 0 && <p style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:'0.875rem', textAlign:'center', padding:'0.5rem 0' }}>No parties added yet</p>}
                    <button onClick={() => openReport(tx)} disabled={txParties.length===0} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'0.6rem', background: txParties.length===0?'#f1f5f9':'#111111', color: txParties.length===0?'#94a3b8':'#fff', border:'none', borderRadius:8, cursor: txParties.length===0?'not-allowed':'pointer', fontWeight:600, fontSize:'0.875rem' }}>
                      <Printer size={15} /> Generate PDF Report
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Flagged tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'flagged' && (
        <div>
          {flaggedParties.length === 0 ? (
            <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
              <CheckCircle2 size={40} style={{ marginBottom:12, opacity:0.4, color:'#16a34a' }} />
              <p style={{ fontWeight:600, color:'#16a34a' }}>No flagged parties — all clear.</p>
            </div>
          ) : isMobile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {flaggedParties.map(p => {
                const tx = txForParty(p)
                return (
                  <div key={p.id} style={{ background:'#fff', border:'1.5px solid #fecaca', borderRadius:10, padding:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:'0.9rem', color:'#0D0D0D' }}>{p.clientName}</span>
                      <span style={{ background:(ROLE_COLORS[p.role]||'#64748b')+'18', color:ROLE_COLORS[p.role]||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{p.role}</span>
                    </div>
                    <div style={{ fontSize:'0.8rem', color:'#64748b', marginBottom:10 }}>{tx?.property||'—'}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {[['FIC', p.ficStatus],['UN', p.unStatus],['PEP', p.pepStatus],['Adverse Media', p.adverseMediaStatus]].map(([label, status]) => (
                        <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:'0.72rem', color:'#94a3b8', minWidth:80 }}>{label}</span>
                          <StatusBadge status={status||'pending'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                <thead style={{ background:'#fef2f2' }}>
                  <tr>
                    {['Client','Role','Transaction','FIC','UN','PEP','Adverse Media'].map(h => (
                      <th key={h} style={{ padding:'0.75rem 1rem', textAlign:'left', color:'#dc2626', fontWeight:600, fontSize:'0.8rem', borderBottom:'1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flaggedParties.map(p => {
                    const tx = txForParty(p)
                    return (
                      <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'0.75rem 1rem', fontWeight:600, color:'#0D0D0D' }}>{p.clientName}</td>
                        <td style={{ padding:'0.75rem 1rem' }}><span style={{ background:(ROLE_COLORS[p.role]||'#64748b')+'18', color:ROLE_COLORS[p.role]||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{p.role}</span></td>
                        <td style={{ padding:'0.75rem 1rem', color:'#64748b', fontSize:'0.82rem' }}>{tx?.property||'—'}</td>
                        <td style={{ padding:'0.75rem 1rem' }}><StatusBadge status={p.ficStatus||'pending'} /></td>
                        <td style={{ padding:'0.75rem 1rem' }}><StatusBadge status={p.unStatus||'pending'} /></td>
                        <td style={{ padding:'0.75rem 1rem' }}><StatusBadge status={p.pepStatus||'pending'} /></td>
                        <td style={{ padding:'0.75rem 1rem' }}><StatusBadge status={p.adverseMediaStatus||'pending'} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Outstanding docs tab ─────────────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div>
          {outstandingDocParties.length === 0 ? (
            <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
              <CheckCircle2 size={40} style={{ marginBottom:12, opacity:0.4, color:'#16a34a' }} />
              <p style={{ fontWeight:600, color:'#16a34a' }}>All documents uploaded — nothing outstanding.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              {outstandingDocParties.map(p => {
                const docs = p.docs || {}
                const isPep2 = p.pepStatus === 'flagged' ||
                  (p.riskCriteria?.pepStatus && p.riskCriteria.pepStatus !== 'Not a PEP') ||
                  p.pepAuthStatus != null
                const pDocList = DOC_LIST.filter(d => d !== 'Source of Funds Declaration' || isPep2)
                const missing  = pDocList.filter(d => !normaliseDoc(docs[d]))
                const uploaded = pDocList.filter(d => { const n=normaliseDoc(docs[d]); return n && n.status !== 'verified' })
                const tx = txForParty(p)
                return (
                  <div key={p.id} style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.625rem' }}>
                      <div>
                        <span style={{ fontWeight:700, color:'#0D0D0D', fontSize:'0.9rem' }}>{p.clientName}</span>
                        <span style={{ background:(ROLE_COLORS[p.role]||'#64748b')+'18', color:ROLE_COLORS[p.role]||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:'0.7rem', fontWeight:700, marginLeft:8 }}>{p.role}</span>
                      </div>
                      <span style={{ fontSize:'0.78rem', color:'#64748b' }}>{tx?.property||'—'}</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {missing.map(d => (
                        <span key={d} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:6, padding:'2px 8px', fontSize:'0.72rem', fontWeight:600 }}>
                          ✗ {d}
                        </span>
                      ))}
                      {uploaded.map(d => (
                        <span key={d} style={{ background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a', borderRadius:6, padding:'2px 8px', fontSize:'0.72rem', fontWeight:600 }}>
                          ! {d} (not verified)
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Screening due tab ────────────────────────────────────────────────── */}
      {activeTab === 'screening' && (
        <div>
          {screeningDueParties.length === 0 ? (
            <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8' }}>
              <CheckCircle2 size={40} style={{ marginBottom:12, opacity:0.4, color:'#16a34a' }} />
              <p style={{ fontWeight:600, color:'#16a34a' }}>All clients screened within the last {RESCREEN_MONTHS} months.</p>
            </div>
          ) : isMobile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {screeningDueParties.map(p => {
                const m = monthsAgo(p.screeningDate)
                const tx = txForParty(p)
                const neverScreened = m === null
                return (
                  <div key={p.id} style={{ background:'#fff', border:'1.5px solid #fde68a', borderRadius:10, padding:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:'0.9rem', color:'#0D0D0D' }}>{p.clientName}</span>
                      <span style={{ background:(ROLE_COLORS[p.role]||'#64748b')+'18', color:ROLE_COLORS[p.role]||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{p.role}</span>
                    </div>
                    <div style={{ fontSize:'0.8rem', color:'#64748b', marginBottom:8 }}>{tx?.property||'—'}</div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>Last screened: {p.screeningDate||'—'}</span>
                      {neverScreened
                        ? <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>Never screened</span>
                        : <span style={{ background:'#fffbeb', color:'#d97706', padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{m}m ago — due</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                <thead style={{ background:'#fffbeb' }}>
                  <tr>
                    {['Client','Role','Transaction','Last Screened','Status'].map(h => (
                      <th key={h} style={{ padding:'0.75rem 1rem', textAlign:'left', color:'#d97706', fontWeight:600, fontSize:'0.8rem', borderBottom:'1px solid #fde68a' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screeningDueParties.map(p => {
                    const m = monthsAgo(p.screeningDate)
                    const tx = txForParty(p)
                    const neverScreened = m === null
                    return (
                      <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'0.75rem 1rem', fontWeight:600 }}>{p.clientName}</td>
                        <td style={{ padding:'0.75rem 1rem' }}><span style={{ background:(ROLE_COLORS[p.role]||'#64748b')+'18', color:ROLE_COLORS[p.role]||'#64748b', padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{p.role}</span></td>
                        <td style={{ padding:'0.75rem 1rem', color:'#64748b', fontSize:'0.82rem' }}>{tx?.property||'—'}</td>
                        <td style={{ padding:'0.75rem 1rem', color:'#64748b' }}>{p.screeningDate || '—'}</td>
                        <td style={{ padding:'0.75rem 1rem' }}>
                          {neverScreened
                            ? <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>Never screened</span>
                            : <span style={{ background:'#fffbeb', color:'#d97706', padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>{m}m ago — due</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
