import React, { useState } from 'react'
import { useApp } from '../context.jsx'
import { Save, Download, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch } from '../api.js'

const CLIENT_TYPE_ITEMS = [
  { id: 'ct_sa_natural',     label: 'SA Natural Person (Citizen / Permanent Resident)',  weight: 1 },
  { id: 'ct_cc',             label: 'Close Corporation (CC)',                             weight: 1 },
  { id: 'ct_sa_company',     label: 'SA Company (Pty Ltd / Ltd)',                        weight: 1 },
  { id: 'ct_prof_partner',   label: 'Professional Partnership',                          weight: 1 },
  { id: 'ct_listed',         label: 'Listed Company (JSE or equivalent)',                weight: 1 },
  { id: 'ct_sa_trust',       label: 'SA Trust',                                          weight: 2 },
  { id: 'ct_sa_partner',     label: 'Ordinary Partnership',                              weight: 2 },
  { id: 'ct_foreign_fatf',   label: 'Foreign Natural Person (FATF country)',             weight: 2 },
  { id: 'ct_principal',      label: 'Principal / Agent Relationship',                    weight: 2 },
  { id: 'ct_dom_pip',        label: 'Domestic Prominent Influential Person (PIP)',       weight: 2 },
  { id: 'ct_foreign_entity', label: 'Foreign FATF Member Entity',                       weight: 2 },
  { id: 'ct_foreign_pep',    label: 'Foreign Prominent Public Official (PEP)',           weight: 3 },
  { id: 'ct_foreign_trust',  label: 'Foreign Trust',                                    weight: 3 },
  { id: 'ct_non_fatf',       label: 'Non-FATF Country Client',                          weight: 3 },
]

const DELIVERY_CHANNEL_ITEMS = [
  { id: 'dc_face',     label: 'Face to Face',     weight: 1 },
  { id: 'dc_nonface',  label: 'Non-Face to Face', weight: 2 },
]

const CONDUCT_ITEMS = [
  { id: 'co_employed',      label: 'Employed',                                          weight: 1 },
  { id: 'co_self_employed', label: 'Self-Employed',                                     weight: 1 },
  { id: 'co_retired',       label: 'Retired',                                           weight: 1 },
  { id: 'co_nonresident',   label: 'Non-Resident / Foreign Address',                    weight: 2 },
  { id: 'co_crossborder',   label: 'Cross-Border Transaction',                          weight: 2 },
  { id: 'co_thirdparty',    label: 'Third Party Payment',                               weight: 2 },
  { id: 'co_complex',       label: 'Complex Ownership Structure',                       weight: 2 },
  { id: 'co_unemployed',    label: 'Unemployed',                                        weight: 3 },
  { id: 'co_cash',          label: 'Cash Payment',                                      weight: 3 },
  { id: 'co_crypto',        label: 'Cryptocurrency / Digital Assets',                   weight: 3 },
  { id: 'co_unwilling',     label: 'Unwillingness to Provide Due Diligence Documents',  weight: 3 },
  { id: 'co_suspicion',     label: 'Suspicion of Money Laundering / Terrorist Financing', weight: 3 },
  { id: 'co_secrecy',       label: 'Secrecy / Lack of Transparency',                   weight: 3 },
  { id: 'co_evasive',       label: 'Evasiveness or Inconsistent Information',           weight: 3 },
]

function computeScore(clientTypes, deliveryChannel, conduct) {
  const ctMax = clientTypes.length ? Math.max(...clientTypes.map(id => CLIENT_TYPE_ITEMS.find(i => i.id === id)?.weight || 0)) : 0
  const dc = DELIVERY_CHANNEL_ITEMS.find(i => i.id === deliveryChannel)?.weight || 0
  const coMax = conduct.length ? Math.max(...conduct.map(id => CONDUCT_ITEMS.find(i => i.id === id)?.weight || 0)) : 0
  return ctMax + dc + coMax
}

function riskBand(score) {
  if (score >= 8)  return { label: 'High',   code: 'E-CDD', desc: 'Enhanced Customer Due Diligence',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', review: '6 months'  }
  if (score >= 6)  return { label: 'Medium', code: 'A-CDD', desc: 'Advanced Customer Due Diligence',  color: '#d97706', bg: '#fffbeb', border: '#fcd34d', review: '12 months' }
  if (score >= 1)  return { label: 'Low',    code: 'S-CDD', desc: 'Standard Customer Due Diligence', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', review: '24 months' }
  return null
}

const WEIGHT_COLOR = { 1: '#16a34a', 2: '#d97706', 3: '#dc2626' }
const WEIGHT_BG    = { 1: '#f0fdf4', 2: '#fffbeb', 3: '#fef2f2' }
const WEIGHT_LABEL = { 1: 'Low', 2: 'Medium', 3: 'High' }

function SectionHeader({ number, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }}>{number}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function WeightBadge({ weight }) {
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: WEIGHT_BG[weight], color: WEIGHT_COLOR[weight], border: `1px solid ${WEIGHT_COLOR[weight]}40`, whiteSpace: 'nowrap' }}>
      {WEIGHT_LABEL[weight]}
    </span>
  )
}

export default function RiskRating() {
  const { transactions, parties, updateParty } = useApp()
  const [transactionId,    setTransactionId]    = useState('')
  const [partyId,          setPartyId]          = useState('')
  const [clientTypes,      setClientTypes]      = useState([])
  const [deliveryChannel,  setDeliveryChannel]  = useState('')
  const [conduct,          setConduct]           = useState([])
  const [saved,            setSaved]             = useState(false)
  const [downloading,      setDownloading]       = useState(false)
  const [expandSections,   setExpandSections]    = useState({ ct: true, dc: true, co: true })

  const txParties = parties.filter(p => p.transactionId === Number(transactionId))
  const party     = parties.find(p => p.id === Number(partyId))
  const score     = computeScore(clientTypes, deliveryChannel, conduct)
  const allDone   = clientTypes.length > 0 && deliveryChannel && conduct.length > 0
  const risk      = allDone ? riskBand(score) : null

  function toggleClientType(id) {
    setClientTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setSaved(false)
  }
  function toggleConduct(id) {
    setConduct(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setSaved(false)
  }
  function setDC(id) { setDeliveryChannel(id); setSaved(false) }

  function handlePartyChange(val) {
    setPartyId(val)
    setSaved(false)
    setClientTypes([])
    setDeliveryChannel('')
    setConduct([])
    const p = parties.find(x => x.id === Number(val))
    if (p?.riskCriteria && Object.keys(p.riskCriteria).length > 0) {
      const rc = p.riskCriteria
      setClientTypes(rc.clientTypes || [])
      setDeliveryChannel(rc.deliveryChannel || '')
      setConduct(rc.conduct || [])
    }
  }

  async function handleSave() {
    if (!party || !allDone) return
    const rc = { clientTypes, deliveryChannel, conduct }
    await updateParty(party.id, {
      riskScore: score,
      riskRating: risk.label,
      riskCriteria: rc,
    })
    setSaved(true)
  }

  async function handleDownload() {
    if (!allDone) return
    setDownloading(true)
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${API}/api/risk-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: party?.clientName || 'Unknown Client',
          idNumber: party?.clientIdNumber || '',
          clientTypes,
          deliveryChannel,
          conduct,
          score,
          riskLabel: risk.label,
          riskCode: risk.code,
          riskDesc: risk.desc,
        }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `RiskScoreCard_${(party?.clientName || 'client').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Could not generate PDF: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const toggle = (s) => setExpandSections(p => ({ ...p, [s]: !p[s] }))

  const selStyle = { width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', outline: 'none', background: '#fff', color: '#0D0D0D' }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>Risk Score Card</h1>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>FICA Risk Score Card v1.3 — Miltons Matsemela</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownload} disabled={!allDone || downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.1rem', background: allDone && !downloading ? '#0D0D0D' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 8, cursor: allDone && !downloading ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.82rem' }}>
            <Download size={15} /> {downloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={handleSave} disabled={!allDone || !partyId}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.1rem', background: allDone && partyId ? '#111111' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 8, cursor: allDone && partyId ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.82rem' }}>
            <Save size={15} /> {saved ? 'Saved ✓' : 'Save to Party'}
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.875rem', color: '#374151' }}>Transaction</label>
            <select value={transactionId} onChange={e => { setTransactionId(e.target.value); setPartyId(''); setClientTypes([]); setDeliveryChannel(''); setConduct([]) }} style={selStyle}>
              <option value="">— Select transaction —</option>
              {transactions.map(t => (
                <option key={t.id} value={t.id}>{t.property || `Transaction #${t.id}`} — {t.type}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.875rem', color: '#374151' }}>Party</label>
            <select value={partyId} onChange={e => handlePartyChange(e.target.value)} disabled={!transactionId} style={{ ...selStyle, opacity: transactionId ? 1 : 0.5 }}>
              <option value="">— Select party —</option>
              {txParties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.clientName} — {p.role}{p.riskRating ? ` · ${p.riskRating} Risk` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {party && (
          <div style={{ marginTop: '0.875rem', padding: '0.65rem 1rem', background: '#f8fafc', borderRadius: 8, fontSize: '0.82rem', color: '#374151' }}>
            <strong>{party.clientName}</strong> — {party.role} &nbsp;|&nbsp; ID: {party.clientIdNumber || '—'} &nbsp;|&nbsp; Type: {party.clientType}
          </div>
        )}
      </div>

      {allDone && risk && (
        <div style={{ background: risk.bg, border: `2px solid ${risk.border}`, borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Total Score</div>
            <div style={{ fontSize: '2.75rem', fontWeight: 900, color: risk.color, lineHeight: 1 }}>{score}<span style={{ fontSize: '1rem', fontWeight: 400, marginLeft: 4, color: '#94a3b8' }}>/8</span></div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Risk Rating</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: risk.color }}>{risk.label} Risk</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Due Diligence Level</div>
            <div style={{ fontWeight: 700, color: risk.color }}>{risk.code}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{risk.desc}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Review Period</div>
            <div style={{ fontWeight: 700, color: risk.color }}>Every {risk.review}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
        {[
          { range: '1 – 5', label: 'Low', code: 'S-CDD', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
          { range: '6 – 7', label: 'Medium', code: 'A-CDD', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
          { range: '8',     label: 'High',   code: 'E-CDD', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
        ].map(b => (
          <div key={b.label} style={{ flex: 1, background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 8, padding: '0.6rem 0.875rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 2 }}>Score {b.range}</div>
            <div style={{ fontWeight: 700, color: b.color, fontSize: '0.875rem' }}>{b.label} — {b.code}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem', overflow: 'hidden' }}>
        <button onClick={() => toggle('ct')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expandSections.ct ? '1px solid #f1f5f9' : 'none' }}>
          <SectionHeader number="1" title="Client Type" subtitle="Select all that apply — the highest-risk category determines this section's score" />
          {expandSections.ct ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
        </button>
        {expandSections.ct && (
          <div style={{ padding: '0.75rem 1.5rem 1.25rem' }}>
            {[1, 2, 3].map(w => (
              <div key={w} style={{ marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <WeightBadge weight={w} />
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>risk score contributes {w}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                  {CLIENT_TYPE_ITEMS.filter(i => i.weight === w).map(item => {
                    const checked = clientTypes.includes(item.id)
                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.875rem', borderRadius: 8, border: `1.5px solid ${checked ? WEIGHT_COLOR[w] : '#e2e8f0'}`, background: checked ? WEIGHT_BG[w] : '#fafafa', cursor: 'pointer', fontSize: '0.84rem', color: checked ? WEIGHT_COLOR[w] : '#374151', fontWeight: checked ? 600 : 400, transition: 'all 0.12s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleClientType(item.id)}
                          style={{ accentColor: WEIGHT_COLOR[w], width: 16, height: 16, flexShrink: 0 }} />
                        {item.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1rem', overflow: 'hidden' }}>
        <button onClick={() => toggle('dc')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expandSections.dc ? '1px solid #f1f5f9' : 'none' }}>
          <SectionHeader number="2" title="Delivery Channel" subtitle="How was contact with the client established?" />
          {expandSections.dc ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
        </button>
        {expandSections.dc && (
          <div style={{ padding: '0.75rem 1.5rem 1.25rem', display: 'flex', gap: 12 }}>
            {DELIVERY_CHANNEL_ITEMS.map(item => {
              const selected = deliveryChannel === item.id
              return (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', borderRadius: 10, border: `2px solid ${selected ? WEIGHT_COLOR[item.weight] : '#e2e8f0'}`, background: selected ? WEIGHT_BG[item.weight] : '#fafafa', cursor: 'pointer', fontSize: '0.9rem', fontWeight: selected ? 700 : 400, color: selected ? WEIGHT_COLOR[item.weight] : '#374151', flex: 1, transition: 'all 0.12s' }}>
                  <input type="radio" name="deliveryChannel" checked={selected} onChange={() => setDC(item.id)}
                    style={{ accentColor: WEIGHT_COLOR[item.weight], width: 17, height: 17 }} />
                  <span>{item.label}</span>
                  <WeightBadge weight={item.weight} />
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <button onClick={() => toggle('co')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expandSections.co ? '1px solid #f1f5f9' : 'none' }}>
          <SectionHeader number="3" title="Client Conduct & Attributes" subtitle="Select all that apply — the highest-risk attribute determines this section's score" />
          {expandSections.co ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
        </button>
        {expandSections.co && (
          <div style={{ padding: '0.75rem 1.5rem 1.25rem' }}>
            {[1, 2, 3].map(w => (
              <div key={w} style={{ marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <WeightBadge weight={w} />
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>risk score contributes {w}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                  {CONDUCT_ITEMS.filter(i => i.weight === w).map(item => {
                    const checked = conduct.includes(item.id)
                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.875rem', borderRadius: 8, border: `1.5px solid ${checked ? WEIGHT_COLOR[w] : '#e2e8f0'}`, background: checked ? WEIGHT_BG[w] : '#fafafa', cursor: 'pointer', fontSize: '0.84rem', color: checked ? WEIGHT_COLOR[w] : '#374151', fontWeight: checked ? 600 : 400, transition: 'all 0.12s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleConduct(item.id)}
                          style={{ accentColor: WEIGHT_COLOR[w], width: 16, height: 16, flexShrink: 0 }} />
                        {item.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {!clientTypes.length && !deliveryChannel && !conduct.length
            ? 'Select items in all three sections to calculate the risk score.'
            : !allDone
            ? `Complete ${!clientTypes.length ? 'Client Type' : !deliveryChannel ? 'Delivery Channel' : 'Client Conduct'} to finish.`
            : `Score: ${score}/8 — ${risk?.label} Risk (${risk?.code})`
          }
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownload} disabled={!allDone || downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.65rem 1.2rem', background: allDone && !downloading ? '#0D0D0D' : '#e2e8f0', color: allDone && !downloading ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, cursor: allDone && !downloading ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.84rem' }}>
            <Download size={15} /> {downloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={handleSave} disabled={!allDone || !partyId}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.65rem 1.2rem', background: allDone && partyId ? '#111111' : '#e2e8f0', color: allDone && partyId ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, cursor: allDone && partyId ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.84rem' }}>
            <Save size={15} /> {saved ? 'Saved ✓' : 'Save to Party'}
          </button>
        </div>
      </div>
    </div>
  )
}
