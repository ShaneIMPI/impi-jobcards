import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="screen">
      <div className="brandbar">
        <div className="brandbar-left">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Amandla Protection Services" className="brand-logo" />
          <div className="name">IMPI <span>Job Cards</span></div>
        </div>
      </div>

      <div className="card">
        <h1>Sign in</h1>
        {!sent ? (
          <>
            <p className="hint">Enter your work email. We'll send you a link — tap it to sign in, no password needed.</p>
            <form onSubmit={handleSend}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@impi-secure.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="primary" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
              {error && <p className="error">{error}</p>}
            </form>
          </>
        ) : (
          <>
            <p className="success">Link sent to {email}.</p>
            <p className="hint">
              Open your email on this device and tap the link. You'll stay signed
              in after that, even if you lose signal later in the day.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
