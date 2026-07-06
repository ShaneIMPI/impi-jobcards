import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!error) setProfile(data)
        setLoading(false)
      })
  }, [session])

  if (loading) {
    return (
      <div className="screen">
        <div className="card"><p>Loading…</p></div>
      </div>
    )
  }

  if (!session) return <Login />
  if (!profile) {
    return (
      <div className="screen">
        <div className="card">
          <p>We couldn't load your staff profile yet. If this is your first time
          logging in, please try refreshing in a moment, or contact your administrator.</p>
        </div>
      </div>
    )
  }
  if (!profile.active) {
    return (
      <div className="screen">
        <div className="card">
          <p>Your account is currently inactive. Please contact your administrator.</p>
        </div>
      </div>
    )
  }

  return <Home profile={profile} />
}
