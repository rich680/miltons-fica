import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint.js'
import {
  LayoutDashboard, Users, ArrowLeftRight, ShieldCheck,
  BarChart3, GitBranch, FileText, LogOut, Menu, X, UserCog, ShieldAlert, ClipboardList, Users2
} from 'lucide-react'

// MM brand palette
const MM = {
  orange:    '#e77204',
  orangeHov: '#c56003',
  black:     '#111111',
  sidebar:   '#0D0D0D',
  divider:   '#242424',
  navHover:  '#1a1a1a',
  navActive: '#1f1f1f',
  textMuted: '#8a8a8a',
  textLight: '#f1f5f9',
}

const BASE_NAV = [
  { to: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/clients',      label: 'Clients',        icon: Users },
  { to: '/transactions', label: 'Transactions',   icon: ArrowLeftRight },
  { to: '/screening',    label: 'Screening',      icon: ShieldCheck },
  { to: '/risk-rating',  label: 'Risk Rating',    icon: BarChart3 },
  { to: '/ubo',          label: 'UBO / Entities', icon: GitBranch },
  { to: '/reports',      label: 'Reports',        icon: FileText },
]

// MM wordmark SVG — "mm" in orange + white matching their logo style
function MMLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#111111"/>
      {/* Simplified "mm" letterform */}
      <text x="3" y="23" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill="#e77204">m</text>
      <text x="16" y="23" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill="#e0e0e0">m</text>
    </svg>
  )
}

export default function Layout() {
  const { currentUser, logout, parties } = useApp()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isMobile, isTablet } = useBreakpoint()
  const isSmall   = isMobile || isTablet

  const [open, setOpen] = useState(!isSmall)

  useEffect(() => { if (isSmall) setOpen(false) }, [location.pathname, isSmall])
  useEffect(() => { if (!isSmall) setOpen(true) }, [isSmall])

  const pendingPepAuth   = parties.filter(p => p.pepAuthStatus === 'pending').length
  const { staffOverdue } = useApp()
  const overdue          = parties.filter(p => p.reviewDate && new Date(p.reviewDate) < new Date()).length
  const pendingScreening = parties.filter(p => p.ficStatus === 'pending' && p.unStatus === 'pending').length

  const NAV = currentUser?.role === 'manager'
    ? [...BASE_NAV,
        { to: '/pep-auth',     label: 'PEP Auth',      icon: ShieldAlert },
        { to: '/audit',        label: 'Audit Log',      icon: ClipboardList },
        { to: '/agents',       label: 'Agents',         icon: UserCog },
        { to: '/agency-staff', label: 'Agency Staff',   icon: Users2 },
      ]
    : BASE_NAV

  function handleLogout() { logout(); navigate('/login') }

  const sideW = isSmall ? 260 : (open ? 240 : 64)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>

      {isSmall && open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199, cursor: 'pointer' }} />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: sideW,
        background: MM.sidebar,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        ...(isSmall ? {
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
        } : {
          position: 'relative',
          transition: 'width 0.2s',
        }),
      }}>

        {/* Logo row */}
        {(!isSmall && !open) ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 64, borderBottom: `1px solid ${MM.divider}`, flexShrink: 0 }}>
            <button onClick={() => setOpen(true)}
              style={{ background: 'none', border: 'none', color: MM.textMuted,
                cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
              title="Expand sidebar">
              <Menu size={20} />
            </button>
          </div>
        ) : (
          <div style={{ padding: '1rem 1rem', display: 'flex', alignItems: 'center',
            gap: 10, borderBottom: `1px solid ${MM.divider}`, flexShrink: 0 }}>
            <MMLogo size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: MM.orange, fontWeight: 800, fontSize: '0.82rem',
                whiteSpace: 'nowrap', fontFamily: 'Georgia, serif', letterSpacing: '0.02em' }}>
                miltons matsemela
              </div>
              <div style={{ color: MM.textMuted, fontSize: '0.65rem', whiteSpace: 'nowrap',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>
                FICA Compliance
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: MM.textMuted,
                cursor: 'pointer', padding: 4, flexShrink: 0 }}
              title={isSmall ? 'Close menu' : 'Collapse sidebar'}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
          {NAV.map(({ to, label, icon: Icon }) => {
            const badge = to === '/screening'    ? pendingScreening
                        : to === '/risk-rating'  ? overdue
                        : to === '/pep-auth'     ? pendingPepAuth
                        : to === '/agency-staff' ? staffOverdue
                        : 0
            return (
              <NavLink key={to} to={to} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: isSmall ? '0.75rem 1.25rem' : '0.6rem 1rem',
                color: isActive ? MM.orange : MM.textMuted,
                background: isActive ? MM.navActive : 'transparent',
                textDecoration: 'none',
                fontSize: isSmall ? '0.95rem' : '0.875rem',
                fontWeight: isActive ? 600 : 500,
                borderLeft: isActive ? `3px solid ${MM.orange}` : '3px solid transparent',
                transition: 'all 0.15s',
              })}>
                <Icon size={isSmall ? 20 : 18} style={{ flexShrink: 0 }} />
                {(open || isSmall) && (
                  <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
                )}
                {(open || isSmall) && badge > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10,
                    padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Divider + "The Conveyancers" tagline */}
        {(open || isSmall) && (
          <div style={{ padding: '0.5rem 1rem 0.25rem', borderTop: `1px solid ${MM.divider}` }}>
            <div style={{ fontSize: '0.65rem', color: '#4a4a4a', fontStyle: 'italic',
              letterSpacing: '0.04em' }}>
              The Conveyancers
            </div>
          </div>
        )}

        {/* User footer */}
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${MM.divider}`, flexShrink: 0 }}>
          {(open || isSmall) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%',
                background: MM.orange, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700,
                fontSize: '0.85rem', flexShrink: 0 }}>
                {currentUser?.name?.[0]}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ color: MM.textLight, fontSize: '0.8rem', fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.name}
                </div>
                <div style={{ color: '#4a4a4a', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                  {currentUser?.role}
                </div>
              </div>
              <button onClick={handleLogout} title="Logout"
                style={{ background: 'none', border: 'none', color: '#4a4a4a', cursor: 'pointer', padding: 4 }}>
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} title="Logout"
              style={{ background: 'none', border: 'none', color: '#4a4a4a', cursor: 'pointer', padding: 4 }}>
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Mobile top bar */}
        {isSmall && (
          <header style={{
            background: MM.sidebar, padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            <button onClick={() => setOpen(true)}
              style={{ background: 'none', border: 'none', color: MM.textMuted,
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <Menu size={22} />
            </button>
            <MMLogo size={28} />
            <span style={{ color: MM.orange, fontWeight: 800, fontSize: '0.88rem',
              fontFamily: 'Georgia, serif' }}>
              miltons matsemela
            </span>
          </header>
        )}

        <main style={{
          flex: 1, overflow: 'auto',
          padding: isMobile ? '1rem 0.75rem' : isTablet ? '1.25rem 1rem' : '2rem',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
