import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context.jsx'
import { ShieldCheck } from 'lucide-react'

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const ok = await login(email, password)
    setLoading(false)
    if (ok) navigate('/dashboard')
    else setError('Invalid email or password.')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #111111 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: '#0D0D0D', borderRadius: 16, marginBottom: '1rem' }}>
            <ShieldCheck size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D0D0D', marginBottom: 4 }}>MM FICA Compliance</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Miltons Matsemela — Compliance Portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem', color: '#374151' }}>Email address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }}
              placeholder="you@miltons.law.za"
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem', color: '#374151' }}>Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: 6 }}>{error}</p>}

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.75rem', background: loading ? '#94a3b8' : '#111111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  )
}
