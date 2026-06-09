import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context.jsx'

const MM_ORANGE = '#e77204'
const MM_BLACK  = '#0D0D0D'

const inputStyle = {
  width: '100%', padding: '0.65rem 0.875rem',
  border: '1.5px solid #d1d5db', borderRadius: 8,
  fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
}
const btnStyle = (disabled) => ({
  width: '100%', padding: '0.75rem',
  background: disabled ? '#94a3b8' : MM_BLACK,
  color: '#fff', border: 'none', borderRadius: 8,
  fontWeight: 700, fontSize: '0.95rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function Login() {
  const { login, verifyOTP } = useApp()
  const navigate = useNavigate()

  // Step 1 state
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // Step 2 state
  const [step, setStep]             = useState(1)          // 1 = credentials, 2 = OTP
  const [challengeId, setChallengeId] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otp, setOtp]               = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const otpRef = useRef(null)

  useEffect(() => {
    if (step === 2) otpRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleCredentials(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await login(email, password)
      if (data.token) {
        // Trust token bypassed MFA
        navigate('/dashboard')
      } else if (data.mfa_required) {
        setChallengeId(data.challengeId)
        setMaskedPhone(data.phone)
        setStep(2)
        setResendCooldown(60)
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOTP(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await verifyOTP(challengeId, otp, trustDevice)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Incorrect OTP. Please try again.')
      setOtp('')
      otpRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError(''); setLoading(true)
    try {
      const data = await login(email, password)
      if (data.mfa_required) {
        setChallengeId(data.challengeId)
        setMaskedPhone(data.phone)
        setResendCooldown(60)
        setOtp('')
        otpRef.current?.focus()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #111111 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: MM_BLACK, borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'inline-block' }}>
            <img src="/mm-logo.png" alt="Miltons Matsemela" style={{ height: 80, display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: MM_BLACK, marginBottom: 4, fontFamily: 'Georgia, serif' }}>miltons matsemela</h1>
          <p style={{ color: MM_ORANGE, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>The Conveyancers</p>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>FICA Compliance Portal</p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleCredentials}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem', color: '#374151' }}>Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} placeholder="you@miltons.law.za" autoComplete="email" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem', color: '#374151' }}>Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: 6 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTP}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📱</div>
              <p style={{ color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>
                A 6-digit code was sent to<br />
                <strong>{maskedPhone}</strong>
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Valid for 10 minutes</p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem', color: '#374151' }}>One-time code</label>
              <input
                ref={otpRef}
                type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.35em', fontWeight: 700 }}
                placeholder="000000" autoComplete="one-time-code"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
              <input type="checkbox" id="trust" checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: MM_ORANGE, cursor: 'pointer' }} />
              <label htmlFor="trust" style={{ fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
                Trust this device for 8 hours
              </label>
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: 6 }}>{error}</p>}

            <button type="submit" disabled={loading || otp.length < 6} style={btnStyle(loading || otp.length < 6)}>
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button type="button" onClick={() => { setStep(1); setError(''); setOtp('') }}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer' }}>
                ← Back
              </button>
              <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || loading}
                style={{ background: 'none', border: 'none', color: resendCooldown > 0 ? '#9ca3af' : MM_ORANGE, fontSize: '0.85rem', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontWeight: 600 }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
