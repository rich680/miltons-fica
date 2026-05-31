import React, { useState } from 'react'
import { useApp } from '../context.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint.js'
import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, AlertTriangle, Clock, TrendingUp, CalendarClock, ShieldAlert, FileText, X, ExternalLink } from 'lucide-react'

function KPI({ icon: Icon, label, value, color, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: 14,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, transform 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = '' }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0D0D0D', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
      </div>
      {onClick && value > 0 && (
        <ExternalLink size={13} color={color} style={{ position: 'absolute', top: 10, right: 10, opacity: 0.5 }} />
      )}
    </div>
  )
}

function StatusDot({ status }) {
  const map = { clear: '#22c55e', flagged: '#ef4444', pending: '#f59e0b' }
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: map[status] || '#94a3b8', marginRight: 5 }} />
}

function StatusBadge({ status }) {
  const cfg = { clear: ['#f0fdf4', '#16a34a'], flagged: ['#fef2f2', '#dc2626'], pending: ['#fffbeb', '#d97706'] }
  const [bg, color] = cfg[status] || ['#f1f5f9', '#64748b']
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>{status}</span>
}

const ROLE_COLORS = {
  'Buyer': '#c56003', 'Co-Buyer': '#2563eb',
  'Seller': '#be185d', 'Co-Seller': '#db2777',
  'Landlord': '#15803d', 'Tenant': '#16a34a',
  'Power of Attorney': '#b45309', 'Trustee': '#d97706',
  'Executor': '#7e22ce',
}

function PartyModal({ title, color, parties, transactions, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '92%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0D0D0D' }}>{title}</h2>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{parties.length} {parties.length === 1 ? 'party' : 'parties'}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {parties.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', margin: 0 }}>None at this time.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.78rem' }}>Party</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.78rem' }}>Transaction</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.78rem' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {parties.map(p => {
                  const tx = transactions.find(t => t.id === p.transactionId)
                  const overallStatus = (p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged') ? 'flagged'
                    : (p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear') ? 'clear' : 'pending'
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.625rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0D0D0D' }}>{p.clientName}</div>
                        <div style={{ fontSize: '0.72rem', color: ROLE_COLORS[p.role] || '#64748b', fontWeight: 600, marginTop: 1 }}>{p.role}</div>
                      </td>
                      <td style={{ padding: '0.625rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx?.property || '—'}
                      </td>
                      <td style={{ padding: '0.625rem 1rem' }}>
                        {p.riskRating && (
                          <span style={{ background: p.riskRating === 'High' ? '#fef2f2' : p.riskRating === 'Medium' ? '#fffbeb' : '#f0fdf4', color: p.riskRating === 'High' ? '#dc2626' : p.riskRating === 'Medium' ? '#d97706' : '#16a34a', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, marginRight: 4 }}>{p.riskRating}</span>
                        )}
                        {p.reviewDate && new Date(p.reviewDate) < new Date() && (
                          <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, marginRight: 4 }}>Due {p.reviewDate}</span>
                        )}
                        {overallStatus !== 'clear' && !p.riskRating && !p.reviewDate && (
                          <StatusBadge status={overallStatus} />
                        )}
                        {p.screeningDate && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Screened {p.screeningDate}</span>
                        )}
                        {!p.screeningDate && overallStatus === 'pending' && (
                          <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>Not yet screened</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { clients, transactions, parties, currentUser } = useApp()
  const { isMobile, isTablet } = useBreakpoint()
  const isSmall = isMobile || isTablet
  const navigate = useNavigate()
  const [modal, setModal] = useState(null) // { title, color, parties }

  const totalClients   = clients.length
  const totalTx        = transactions.length
  const screened       = parties.filter(p => p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear').length
  const flaggedList    = parties.filter(p => p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged')
  const pendingList    = parties.filter(p => p.ficStatus === 'pending' && p.unStatus === 'pending')
  const highRiskList   = parties.filter(p => p.riskRating === 'High')
  const overdueList    = parties.filter(p => p.reviewDate && new Date(p.reviewDate) < new Date())
  const pendingPepAuth = parties.filter(p => p.pepAuthStatus === 'pending').length

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const recentParties = [...parties].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8)

  function openModal(title, color, list) {
    if (list.length === 0) return
    setModal({ title, color, parties: list })
  }

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D' }}>Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 2 }}>Welcome back, {currentUser?.name} — {today}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isMobile ? '0.625rem' : '1rem', marginBottom: '1.5rem' }}>
        <KPI icon={Users}         label="Total Clients"     value={totalClients}       color="#e77204" />
        <KPI icon={FileText}      label="Transactions"      value={totalTx}            color="#6366f1" />
        <KPI icon={ShieldCheck}   label="Parties Screened"  value={screened}           color="#22c55e" />
        <KPI icon={AlertTriangle} label="Parties Flagged"   value={flaggedList.length} color="#ef4444"
          sub={flaggedList.length > 0 ? 'Requires attention' : null}
          onClick={() => openModal('Parties Flagged', '#ef4444', flaggedList)} />
        <KPI icon={Clock}         label="Pending Screening" value={pendingList.length} color="#f59e0b"
          onClick={() => openModal('Pending Screening', '#f59e0b', pendingList)} />
        <KPI icon={TrendingUp}    label="High Risk Parties" value={highRiskList.length} color="#7c3aed"
          onClick={() => openModal('High Risk Parties', '#7c3aed', highRiskList)} />
        <KPI icon={CalendarClock} label="Due for Review"    value={overdueList.length} color="#0891b2"
          sub={overdueList.length > 0 ? 'Overdue' : null}
          onClick={() => openModal('Due for Review', '#0891b2', overdueList)} />
        {currentUser?.role === 'manager' && (
          <KPI icon={ShieldAlert} label="PEP Pending Auth" value={pendingPepAuth} color="#ea580c"
            sub={pendingPepAuth > 0 ? 'Action required' : null}
            onClick={() => navigate('/pep-auth')} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: isSmall ? '1rem' : '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0D0D0D' }}>Party Compliance Status</h2>
            <button onClick={() => navigate('/transactions')} style={{ fontSize: '0.75rem', color: '#e77204', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all</button>
          </div>
          {recentParties.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No parties yet — open a transaction to add parties</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {['Party', 'FIC', 'UN', 'PEP', 'Risk'].map(h => (
                    <th key={h} style={{ padding: '0.35rem 0.5rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentParties.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.clientName}</div>
                      <div style={{ fontSize: '0.72rem', color: ROLE_COLORS[p.role] || '#64748b', fontWeight: 600 }}>{p.role}</div>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><StatusDot status={p.ficStatus} /></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><StatusDot status={p.unStatus} /></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}><StatusDot status={p.pepStatus} /></td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {p.riskRating
                        ? <span style={{ background: p.riskRating === 'High' ? '#fef2f2' : p.riskRating === 'Medium' ? '#fffbeb' : '#f0fdf4', color: p.riskRating === 'High' ? '#dc2626' : p.riskRating === 'Medium' ? '#d97706' : '#16a34a', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 }}>{p.riskRating}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0D0D0D' }}>Recent Transactions</h2>
            <button onClick={() => navigate('/transactions')} style={{ fontSize: '0.75rem', color: '#e77204', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all</button>
          </div>
          {transactions.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No transactions yet</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {['Property', 'Type', 'Parties', 'Value', 'Status'].map(h => (
                    <th key={h} style={{ padding: '0.35rem 0.5rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 8).map(tx => {
                  const txParties = parties.filter(p => p.transactionId === tx.id)
                  const anyFlagged = txParties.some(p => p.ficStatus === 'flagged' || p.unStatus === 'flagged' || p.pepStatus === 'flagged' || p.adverseMediaStatus === 'flagged')
                  const allClear   = txParties.length > 0 && txParties.every(p => p.ficStatus === 'clear' && p.unStatus === 'clear' && p.pepStatus === 'clear' && p.adverseMediaStatus === 'clear')
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.property || '—'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: '#64748b', fontSize: '0.78rem' }}>{tx.type}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <span style={{ background: '#fff7ed', color: '#c56003', padding: '1px 7px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>{txParties.length}</span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, fontSize: '0.8rem' }}>R {Number(tx.value || 0).toLocaleString('en-ZA')}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        {txParties.length === 0
                          ? <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No parties</span>
                          : anyFlagged ? <StatusBadge status="flagged" />
                          : allClear   ? <StatusBadge status="clear" />
                          :               <StatusBadge status="pending" />
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <PartyModal
          title={modal.title}
          color={modal.color}
          parties={modal.parties}
          transactions={transactions}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
