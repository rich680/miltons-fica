import React, { useState } from 'react'
import { useApp } from '../context.jsx'
import { CheckCircle2, ExternalLink, AlertTriangle, ChevronRight, ChevronLeft, Zap, Loader, Download, ShieldAlert } from 'lucide-react'

const STEPS = ['Select Party', 'FIC Check', 'UN Sanctions', 'PEP Check', 'Adverse Media', 'Confirm']

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

const BLANK_PEP_FORM = {
  isPep: null,
  representative: '',
  categories: {},
  sourceOfFunds: '',
  transactionDetails: '',
  date: new Date().toISOString().split('T')[0],
}

function Step({ n, label, active, done }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem',
        background: done ? '#16a34a' : active ? '#111111' : '#e2e8f0',
        color: done || active ? '#fff' : '#94a3b8' }}>
        {done ? <CheckCircle2 size={17} /> : n}
      </div>
      <span style={{ fontSize: '0.72rem', color: active ? '#111111' : '#94a3b8', fontWeight: active ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

function downloadBase64(base64, filename) {
  const a = document.createElement('a')
  a.href = base64
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Automated search panel ────────────────────────────────────────────────────
function AutoSearch({ clientInfo, endpoint, label, status, onResult, onScreenshot, notes, onNotes, actorId, actorName, entityId }) {
  const [loading, setLoading] = useState(false)
  const [screenshotB64, setScreenshotB64] = useState(null)
  const [serverError, setServerError] = useState(false)
  const [portalUrl, setPortalUrl] = useState(null)
  const [matches, setMatches] = useState(null)
  const [searched, setSearched] = useState(false)

  async function runSearch() {
    setLoading(true); setServerError(false); setScreenshotB64(null); setPortalUrl(null); setMatches(null); setSearched(false)
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientInfo.name,
          idNumber: clientInfo.idNumber,
          dateOfBirth: clientInfo.dateOfBirth || null,
          placeOfBirth: clientInfo.placeOfBirth || null,
          nationality: clientInfo.nationality || null,
          type: (['Individual SA', 'Individual Foreign', 'Principal (Power of Attorney)'].includes(clientInfo.type) || !clientInfo.type) ? 'person' : 'entity',
          actorId: actorId || null,
          actorName: actorName || null,
          entityId: entityId || null,
        }),
      })
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearched(true)
      const img = data.screenshotBase64 || null
      if (img) { setScreenshotB64(img); if (onScreenshot) onScreenshot(img) }
      if (data.portalUrl) setPortalUrl(data.portalUrl)
      if (data.matches) setMatches(data.matches)
      if (data.result !== null && data.result !== undefined) onResult(data.result)
    } catch {
      setServerError(true)
    } finally {
      setLoading(false)
    }
  }

  const statusColor = status === 'clear' ? '#16a34a' : status === 'flagged' ? '#dc2626' : '#d97706'
  const statusBg    = status === 'clear' ? '#f0fdf4'  : status === 'flagged' ? '#fef2f2'  : '#fffbeb'
  const safeLabel   = label.replace(/[^a-zA-Z0-9]/g, '_')
  const safeName    = (clientInfo?.name || 'client').replace(/[^a-zA-Z0-9]/g, '_')

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', border: '1.5px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>{label}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {screenshotB64 && (
            <button onClick={() => downloadBase64(screenshotB64, `${safeLabel}_${safeName}.png`)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', color: '#374151', padding: '0.4rem 0.875rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              <Download size={13} /> Download
            </button>
          )}
          <button onClick={runSearch} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: loading ? '#94a3b8' : '#111111', color: '#fff', padding: '0.4rem 0.875rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Searching…</> : <><Zap size={13} /> Auto Search</>}
          </button>
        </div>
      </div>

      {serverError && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: '#713f12', marginBottom: '0.875rem' }}>
          ⚠️ Could not reach the search server. Check that the Railway backend is running and <code style={{ background: '#fef08a', padding: '2px 6px', borderRadius: 4 }}>VITE_API_URL</code> is set in Netlify.
        </div>
      )}

      {/* FIC: manual portal link */}
      {portalUrl && (
        <div style={{ background: '#fff7ed', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#1e40af', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>Open the FIC portal, search for <strong>{clientInfo?.name}</strong>, then record the result below.</span>
          <a href={portalUrl} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#111111', color: '#fff', padding: '0.4rem 0.875rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <ExternalLink size={13} /> Open FIC Portal
          </a>
        </div>
      )}

      {/* UN: inline match results */}
      {matches !== null && (
        <div style={{ marginBottom: '0.875rem' }}>
          <div style={{ background: matches.length === 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${matches.length === 0 ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.82rem', fontWeight: 700, color: matches.length === 0 ? '#16a34a' : '#dc2626', marginBottom: matches.length > 0 ? '0.5rem' : 0 }}>
            {matches.length === 0 ? `✅ Clear — ${clientInfo?.name} does not appear on the UN Consolidated Sanctions List` : `⚠️ ${matches.length} match${matches.length > 1 ? 'es' : ''} found — review required`}
          </div>
          {matches.length > 0 && (
            <div style={{ border: '1px solid #fecaca', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#fef2f2' }}>
                    {['Name', 'Type', 'Nationality', 'Listed On'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #fecaca' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fef9f9' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#dc2626', borderBottom: '1px solid #fee2e2' }}>{m.name}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2' }}>{m.type}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2' }}>{m.nationality || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2' }}>{m.listedOn || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Screenshot (legacy / future use) */}
      {screenshotB64 && (
        <div style={{ marginBottom: '0.875rem' }}>
          <div style={{ background: status === 'clear' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${statusColor}40`, borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.82rem', fontWeight: 700, color: statusColor, marginBottom: '0.5rem' }}>
            {status === 'clear' ? '✅ Clear — no matches found' : '⚠️ Matches found — review required'}
          </div>
          <img src={screenshotB64} alt="Search result"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
            onClick={() => window.open(screenshotB64, '_blank')} title="Click to open full size" />
          <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 4 }}>Click to enlarge · use Download button to save</p>
        </div>
      )}

      <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
        {(searched || status) ? 'Record result:' : 'Click Auto Search, or record result manually:'}
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: status === 'flagged' ? '0.75rem' : 0 }}>
        {['clear', 'flagged'].map(r => (
          <button key={r} onClick={() => onResult(r)}
            style={{ flex: 1, padding: '0.5rem', border: `2px solid ${status === r ? statusColor : '#e2e8f0'}`, borderRadius: 8, background: status === r ? statusBg : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: status === r ? statusColor : '#64748b' }}>
            {r === 'clear' ? '✓ Clear' : '⚠ Flagged'}
          </button>
        ))}
      </div>
      {status === 'flagged' && (
        <textarea value={notes} onChange={e => onNotes(e.target.value)} placeholder="Describe the flagged entry…" rows={3}
          style={{ width: '100%', marginTop: '0.75rem', padding: '0.6rem', border: '1.5px solid #fca5a5', borderRadius: 8, fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
      )}
    </div>
  )
}

// ── PEP Check panel ───────────────────────────────────────────────────────────
function PEPCheck({ clientInfo, status, onResult, pepForm, onPepForm }) {
  const inp = { width: '100%', padding: '0.6rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }

  function answer(val) {
    onPepForm({ ...pepForm, isPep: val })
    onResult(val === 'no' ? 'clear' : 'flagged')
  }

  function setField(field, value) { onPepForm({ ...pepForm, [field]: value }) }

  function toggleCategory(cat) {
    onPepForm({ ...pepForm, categories: { ...pepForm.categories, [cat]: !pepForm.categories[cat] } })
  }

  const isPep = pepForm.isPep

  return (
    <div>
      <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: '1rem' }}>
          <ShieldAlert size={22} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D', margin: 0 }}>
            Is the client a Politically Exposed Person (PEP), or a close family member or closely associated with a PEP?
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => answer('yes')}
            style={{ flex: 1, padding: '0.65rem', border: `2.5px solid ${isPep === 'yes' ? '#dc2626' : '#e2e8f0'}`, borderRadius: 10, background: isPep === 'yes' ? '#fef2f2' : '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: isPep === 'yes' ? '#dc2626' : '#64748b' }}>
            YES
          </button>
          <button onClick={() => answer('no')}
            style={{ flex: 1, padding: '0.65rem', border: `2.5px solid ${isPep === 'no' ? '#16a34a' : '#e2e8f0'}`, borderRadius: 10, background: isPep === 'no' ? '#f0fdf4' : '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: isPep === 'no' ? '#16a34a' : '#64748b' }}>
            NO
          </button>
        </div>
      </div>

      {isPep === 'no' && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={20} color="#16a34a" />
          <span style={{ fontWeight: 600, color: '#15803d', fontSize: '0.9rem' }}>Confirmed — client is not a PEP. You may proceed.</span>
        </div>
      )}

      {isPep === 'yes' && (
        <div style={{ border: '2px solid #fca5a5', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#111111', color: '#fff', padding: '1rem 1.5rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.03em' }}>FICA CHECKLIST</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>Politically Exposed People (PEPs)</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4 }}>
              This checklist must be completed with every FICA related transaction concluded with a politically exposed person.
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: 5 }}>Client Name</label>
                <input value={clientInfo?.name || ''} readOnly style={{ ...inp, background: '#f8fafc', color: '#64748b' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: 5 }}>Representative</label>
                <input value={pepForm.representative} onChange={e => setField('representative', e.target.value)} placeholder="Your name" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: 5 }}>Date</label>
                <input type="date" value={pepForm.date} onChange={e => setField('date', e.target.value)} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0D0D0D', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                Is the client one of the following, or a close family member or closely associated with one of the following?
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.6rem 0.875rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0', width: '70%' }}>Category</th>
                    <th style={{ padding: '0.6rem 0.875rem', textAlign: 'center', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #e2e8f0', width: '15%' }}>YES</th>
                    <th style={{ padding: '0.6rem 0.875rem', textAlign: 'center', fontWeight: 700, color: '#dc2626', borderBottom: '1px solid #e2e8f0', width: '15%' }}>NO</th>
                  </tr>
                </thead>
                <tbody>
                  {PEP_CATEGORIES.map((cat, i) => {
                    const val = pepForm.categories[cat]
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: val === true ? '#fef2f2' : val === false ? '#f0fdf4' : '#fff' }}>
                        <td style={{ padding: '0.65rem 0.875rem', color: '#374151' }}>{cat}</td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <button onClick={() => toggleCategory(cat)}
                            style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${val === true ? '#dc2626' : '#e2e8f0'}`, background: val === true ? '#dc2626' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            {val === true && <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>✓</span>}
                          </button>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <button onClick={() => onPepForm({ ...pepForm, categories: { ...pepForm.categories, [cat]: false } })}
                            style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${val === false ? '#16a34a' : '#e2e8f0'}`, background: val === false ? '#16a34a' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            {val === false && <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>✓</span>}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#92400e', marginBottom: '1.25rem' }}>
              ⚠ If YES, obtain additional information regarding source of funds, the transaction and the client.
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', color: '#374151', marginBottom: 6 }}>
                Source of Funds / Income <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea value={pepForm.sourceOfFunds} onChange={e => setField('sourceOfFunds', e.target.value)}
                placeholder="Describe the client's source of funds and income…" rows={3}
                style={{ width: '100%', padding: '0.6rem', border: `1.5px solid ${pepForm.sourceOfFunds.trim() ? '#d1d5db' : '#fca5a5'}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', color: '#374151', marginBottom: 6 }}>
                Transaction Details <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea value={pepForm.transactionDetails} onChange={e => setField('transactionDetails', e.target.value)}
                placeholder="Describe the nature and purpose of the transaction…" rows={3}
                style={{ width: '100%', padding: '0.6rem', border: `1.5px solid ${pepForm.transactionDetails.trim() ? '#d1d5db' : '#fca5a5'}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <ShieldAlert size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626', marginBottom: 3 }}>Senior Management Authorisation Required</div>
                <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>If the client is a PEP, senior management authorisation must be obtained before proceeding with the transaction.</div>
              </div>
            </div>

            {(!pepForm.sourceOfFunds.trim() || !pepForm.transactionDetails.trim()) && (
              <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>
                ⛔ Complete Source of Funds and Transaction Details to proceed.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Adverse Media panel ───────────────────────────────────────────────────────
function AdverseMedia({ clientInfo, status, onResult, notes, onNotes }) {
  const statusColor = status === 'clear' ? '#16a34a' : status === 'flagged' ? '#dc2626' : '#d97706'
  const statusBg    = status === 'clear' ? '#f0fdf4'  : status === 'flagged' ? '#fef2f2'  : '#fffbeb'
  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', border: '1.5px solid #e2e8f0' }}>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D', display: 'block', marginBottom: '0.75rem' }}>Adverse Media Search</span>
      <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Search for negative news — fraud, corruption, money laundering, financial crime.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        {[
          { label: 'Google News', url: `https://news.google.com/search?q=${encodeURIComponent(clientInfo?.name || '')}` },
          { label: 'TimesLIVE',   url: `https://www.timeslive.co.za/search/?query=${encodeURIComponent(clientInfo?.name || '')}` },
          { label: 'IOL',         url: `https://www.iol.co.za/search?query=${encodeURIComponent(clientInfo?.name || '')}` },
          { label: 'Hawks / NPA', url: 'https://www.justice.gov.za/npa/media.html' },
        ].map(({ label, url }) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', color: '#111111', padding: '0.4rem 0.875rem', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #e2e8f0' }}>
            {label} <ExternalLink size={11} />
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {['clear', 'flagged'].map(r => (
          <button key={r} onClick={() => onResult(r)}
            style={{ flex: 1, padding: '0.5rem', border: `2px solid ${status === r ? statusColor : '#e2e8f0'}`, borderRadius: 8, background: status === r ? statusBg : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: status === r ? statusColor : '#64748b' }}>
            {r === 'clear' ? '✓ No adverse media' : '⚠ Adverse media found'}
          </button>
        ))}
      </div>
      {status === 'flagged' && (
        <textarea value={notes} onChange={e => onNotes(e.target.value)} placeholder="Summarise the adverse media found…" rows={3}
          style={{ width: '100%', marginTop: '0.75rem', padding: '0.6rem', border: '1.5px solid #fca5a5', borderRadius: 8, fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
      )}
    </div>
  )
}

// ── Main Screening page ───────────────────────────────────────────────────────
export default function Screening() {
  const { currentUser, transactions, parties, clients, updateParty } = useApp()
  const [step, setStep]               = useState(0)
  const [transactionId, setTransactionId] = useState('')
  const [partyId, setPartyId]         = useState('')
  const [results, setResults]         = useState({ fic: 'pending', un: 'pending', pep: 'pending', adverse: 'pending' })
  const [notes, setNotes]             = useState({ fic: '', un: '', pep: '', adverse: '', general: '' })
  const [screenshots, setScreenshots] = useState({ fic: null, un: null })
  const [pepForm, setPepForm]         = useState({ ...BLANK_PEP_FORM })
  const [reviewDate, setReviewDate]   = useState('')
  const [saved, setSaved]             = useState(false)

  const txParties = parties.filter(p => p.transactionId === Number(transactionId))
  const party     = parties.find(p => p.id === Number(partyId))

  // Build clientInfo from the live clients state so edits are reflected immediately
  const freshClient = clients.find(c => c.id === party?.clientId)
  const clientInfo = party ? {
    name:         freshClient?.name        || party.clientName,
    idNumber:     freshClient?.idNumber    || party.clientIdNumber || party.idNumber,
    type:         freshClient?.type        || party.clientType,
    dateOfBirth:  freshClient?.dateOfBirth || party.clientDob,
    placeOfBirth: freshClient?.placeOfBirth || party.clientPob,
    nationality:  freshClient?.nationality || party.clientNationality,
    screeningDate: party.screeningDate,
  } : null

  function setResult(key, val)     { setResults(r => ({ ...r, [key]: val })) }
  function setNote(key, val)       { setNotes(n => ({ ...n, [key]: val })) }
  function setScreenshot(key, b64) { setScreenshots(s => ({ ...s, [key]: b64 })) }

  function canAdvance() {
    if (step === 0) return !!partyId
    if (step === 1) return results.fic !== 'pending'
    if (step === 2) return results.un !== 'pending'
    if (step === 3) {
      if (results.pep === 'pending') return false
      if (results.pep === 'flagged') {
        return pepForm.sourceOfFunds.trim().length > 0 && pepForm.transactionDetails.trim().length > 0
      }
      return true
    }
    if (step === 4) return results.adverse !== 'pending'
    return true
  }

  function handleConfirm() {
    if (!party) return
    const isPepFlagged = results.pep === 'flagged'
    updateParty(party.id, {
      ficStatus:           results.fic,
      unStatus:            results.un,
      pepStatus:           results.pep,
      adverseMediaStatus:  results.adverse,
      pepAuthStatus:       isPepFlagged ? 'pending' : null,
      screeningNotes:      notes.general,
      screeningDate:       new Date().toISOString().split('T')[0],
      reviewDate:          reviewDate || null,
      ficScreenshot:       screenshots.fic || null,
      unScreenshot:        screenshots.un  || null,
      pepForm:             results.pep === 'flagged' ? pepForm : null,
    })
    setSaved(true)
  }

  function reset() {
    setStep(0)
    setTransactionId('')
    setPartyId('')
    setSaved(false)
    setResults({ fic: 'pending', un: 'pending', pep: 'pending', adverse: 'pending' })
    setNotes({ fic: '', un: '', pep: '', adverse: '', general: '' })
    setScreenshots({ fic: null, un: null })
    setPepForm({ ...BLANK_PEP_FORM, date: new Date().toISOString().split('T')[0] })
    setReviewDate('')
  }

  // ── Saved confirmation screen ─────────────────────────────────────────────
  if (saved) {
    const pepFlagged = results.pep === 'flagged'
    const allClear   = Object.values(results).every(r => r === 'clear')
    const safeName   = (clientInfo?.name || 'client').replace(/[^a-zA-Z0-9]/g, '_')

    if (pepFlagged) {
      return (
        <div style={{ maxWidth: 560, margin: '2rem auto', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff7ed', border: '3px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <ShieldAlert size={40} color="#ea580c" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: '#111111' }}>Awaiting Senior Management Authorisation</h2>
          <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Client: <strong>{clientInfo?.name}</strong></p>
          <p style={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Role: <strong>{party?.role}</strong></p>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            Transaction: <strong>{party?.txProperty}</strong> &mdash; Submitted {new Date().toLocaleDateString('en-ZA')}
          </p>

          <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '1.25rem 1.5rem', textAlign: 'left', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: 6, fontSize: '0.9rem' }}>🔒 Screening is locked pending authorisation</div>
            <p style={{ color: '#78350f', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              This party has been flagged as a PEP. The screening record has been saved and all managers have been notified by email. A manager must review the PEP Checklist and authorise or reject before this party's screening can be finalised.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {Object.entries({ FIC: results.fic, UN: results.un, PEP: results.pep, 'Adverse Media': results.adverse }).map(([label, r]) => (
              <span key={label} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, background: r === 'clear' ? '#f0fdf4' : r === 'flagged' ? '#fff7ed' : '#fef2f2', color: r === 'clear' ? '#16a34a' : r === 'flagged' ? '#ea580c' : '#dc2626' }}>
                {label}: {r}
              </span>
            ))}
          </div>

          <button onClick={reset} style={{ padding: '0.7rem 1.5rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Screen Another Party
          </button>
        </div>
      )
    }

    return (
      <div style={{ maxWidth: 560, margin: '2rem auto', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: allClear ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
          {allClear ? <CheckCircle2 size={38} color="#16a34a" /> : <AlertTriangle size={38} color="#dc2626" />}
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{allClear ? 'Screening Complete — All Clear' : 'Screening Complete — Issues Found'}</h2>
        <p style={{ color: '#64748b', marginBottom: '0.25rem' }}>Client: <strong>{clientInfo?.name}</strong> ({party?.role})</p>
        <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
          {party?.txProperty} &mdash; Screened {new Date().toLocaleDateString('en-ZA')}
          {reviewDate ? ` — Next review: ${reviewDate}` : ''}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {Object.entries({ FIC: results.fic, UN: results.un, PEP: results.pep, 'Adverse Media': results.adverse }).map(([label, r]) => (
            <span key={label} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, background: r === 'clear' ? '#f0fdf4' : '#fef2f2', color: r === 'clear' ? '#16a34a' : '#dc2626' }}>
              {label}: {r}
            </span>
          ))}
        </div>
        {(screenshots.fic || screenshots.un) && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {screenshots.fic && (
              <button onClick={() => downloadBase64(screenshots.fic, `FIC_${safeName}.png`)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 1rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                <Download size={13} /> FIC Result
              </button>
            )}
            {screenshots.un && (
              <button onClick={() => downloadBase64(screenshots.un, `UN_${safeName}.png`)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.5rem 1rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                <Download size={13} /> UN Result
              </button>
            )}
          </div>
        )}
        <button onClick={reset} style={{ padding: '0.7rem 1.5rem', background: '#e77204', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          Screen Another Party
        </button>
      </div>
    )
  }

  const selStyle = { width: '100%', padding: '0.7rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', outline: 'none', background: '#fff' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D', marginBottom: '1.75rem' }}>Compliance Screening</h1>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2rem' }}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <Step n={i + 1} label={label} active={step === i} done={step > i} />
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step > i ? '#16a34a' : '#e2e8f0', marginTop: 17, transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', minHeight: 300 }}>

        {/* Step 0 — Select Transaction & Party */}
        {step === 0 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Select Transaction &amp; Party</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.85rem', color: '#374151' }}>Transaction</label>
              <select value={transactionId} onChange={e => { setTransactionId(e.target.value); setPartyId('') }} style={selStyle}>
                <option value="">— Select transaction —</option>
                {transactions.map(t => (
                  <option key={t.id} value={t.id}>{t.property || `Transaction #${t.id}`} — {t.type}</option>
                ))}
              </select>
            </div>
            {transactionId && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.85rem', color: '#374151' }}>Party to Screen</label>
                <select value={partyId} onChange={e => setPartyId(e.target.value)} style={selStyle}>
                  <option value="">— Select party —</option>
                  {txParties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.clientName} — {p.role}
                      {p.ficStatus !== 'pending' || p.unStatus !== 'pending' || p.pepStatus !== 'pending' ? ' (previously screened)' : ''}
                    </option>
                  ))}
                </select>
                {txParties.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 6 }}>No parties added to this transaction yet.</p>
                )}
              </div>
            )}
            {party && (
              <div style={{ marginTop: '1rem', background: '#f8fafc', borderRadius: 10, padding: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{party.clientName} <span style={{ fontWeight: 400, color: '#64748b' }}>— {party.role}</span></div>
                <div><strong>ID / Reg:</strong> {party.clientIdNumber || '—'} &nbsp;|&nbsp; <strong>Type:</strong> {party.clientType}</div>
                {party.screeningDate && <div style={{ marginTop: 6, color: '#64748b' }}>Last screened on this transaction: {party.screeningDate}</div>}
              </div>
            )}
          </div>
        )}

        {/* Step 1 — FIC */}
        {step === 1 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>FIC Terrorist Financing Search</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>Screening: <strong>{clientInfo?.name}</strong> ({party?.role})</p>
            <AutoSearch clientInfo={clientInfo} endpoint="api/fic-search" label="FIC TFS Portal"
              actorId={currentUser?.id} actorName={currentUser?.name} entityId={party?.clientId}
              status={results.fic} onResult={v => setResult('fic', v)}
              onScreenshot={b64 => setScreenshot('fic', b64)} notes={notes.fic} onNotes={v => setNote('fic', v)} />
          </div>
        )}

        {/* Step 2 — UN */}
        {step === 2 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>UN Sanctions Screening</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>Screening: <strong>{clientInfo?.name}</strong> ({party?.role})</p>
            <AutoSearch clientInfo={clientInfo} endpoint="api/un-search" label="UN Consolidated Sanctions List"
              actorId={currentUser?.id} actorName={currentUser?.name} entityId={party?.clientId}
              status={results.un} onResult={v => setResult('un', v)}
              onScreenshot={b64 => setScreenshot('un', b64)} notes={notes.un} onNotes={v => setNote('un', v)} />
          </div>
        )}

        {/* Step 3 — PEP */}
        {step === 3 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>PEP Screening</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Screening: <strong>{clientInfo?.name}</strong> ({party?.role})</p>
            <PEPCheck clientInfo={clientInfo} status={results.pep} onResult={v => setResult('pep', v)} pepForm={pepForm} onPepForm={setPepForm} />
          </div>
        )}

        {/* Step 4 — Adverse Media */}
        {step === 4 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Adverse Media Screening</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>Screening: <strong>{clientInfo?.name}</strong> ({party?.role})</p>
            <AdverseMedia clientInfo={clientInfo} status={results.adverse} onResult={v => setResult('adverse', v)}
              notes={notes.adverse} onNotes={v => setNote('adverse', v)} />
          </div>
        )}

        {/* Step 5 — Confirm */}
        {step === 5 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Review &amp; Confirm</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong>{clientInfo?.name}</strong> — {party?.role} on {party?.txProperty}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              {[['FIC', results.fic], ['UN Sanctions', results.un], ['PEP', results.pep], ['Adverse Media', results.adverse]].map(([label, r]) => (
                <div key={label} style={{ padding: '0.75rem', background: r === 'clear' ? '#f0fdf4' : r === 'flagged' ? '#fef2f2' : '#fffbeb', borderRadius: 8, border: `1px solid ${r === 'clear' ? '#bbf7d0' : r === 'flagged' ? '#fca5a5' : '#fde68a'}` }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: r === 'clear' ? '#16a34a' : r === 'flagged' ? '#dc2626' : '#d97706', textTransform: 'capitalize' }}>{r}</div>
                </div>
              ))}
            </div>
            {results.pep === 'flagged' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#7f1d1d', fontWeight: 600 }}>
                ⚠ PEP flagged — senior management authorisation will be required.
              </div>
            )}
            {(screenshots.fic || screenshots.un) && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Screening Evidence</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {screenshots.fic && (
                    <button onClick={() => downloadBase64(screenshots.fic, `FIC_${(clientInfo?.name||'client').replace(/[^a-zA-Z0-9]/g,'_')}.png`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                      <Download size={13} /> FIC Screenshot
                    </button>
                  )}
                  {screenshots.un && (
                    <button onClick={() => downloadBase64(screenshots.un, `UN_${(clientInfo?.name||'client').replace(/[^a-zA-Z0-9]/g,'_')}.png`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                      <Download size={13} /> UN Screenshot
                    </button>
                  )}
                </div>
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.85rem', color: '#374151' }}>General Notes (optional)</label>
              <textarea value={notes.general} onChange={e => setNote('general', e.target.value)} placeholder="Any additional compliance notes…" rows={3}
                style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, fontSize: '0.85rem', color: '#374151' }}>Next Review Date</label>
              <input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)}
                style={{ padding: '0.6rem 0.875rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', outline: 'none' }} />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.6rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: step === 0 ? 'not-allowed' : 'pointer', color: step === 0 ? '#cbd5e1' : '#374151', fontWeight: 600 }}>
            <ChevronLeft size={16} /> Back
          </button>
          {step < 5 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.6rem 1.25rem', background: canAdvance() ? '#111111' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: canAdvance() ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleConfirm}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.6rem 1.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              <CheckCircle2 size={16} /> Confirm &amp; Save
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
