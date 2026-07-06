import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  getOpenEntry, getRecentEntries, signIn, signOut, updateNotes,
  setupAutoSync, pendingCount
} from '../offlineQueue'

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

export default function Home({ profile }) {
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [siteOther, setSiteOther] = useState('')
  const [notes, setNotes] = useState('')
  const [openEntry, setOpenEntry] = useState(getOpenEntry())
  const [recent, setRecent] = useState(getRecentEntries())
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(pendingCount())
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    setOpenEntry(getOpenEntry())
    setRecent(getRecentEntries())
    setPending(pendingCount())
  }, [])

  useEffect(() => {
    setupAutoSync()
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    const interval = setInterval(refresh, 5000)

    supabase.from('sites').select('*').eq('active', true).order('name')
      .then(({ data }) => setSites(data || []))

    if (openEntry) setNotes(openEntry.notes || '')

    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn(e) {
    e.preventDefault()
    if (!siteId && !siteOther.trim()) return
    setBusy(true)
    await signIn({
      staffId: profile.id,
      siteId: siteId || null,
      siteNameOther: siteId ? null : siteOther.trim()
    })
    setBusy(false)
    setSiteId('')
    setSiteOther('')
    refresh()
  }

  async function handleSignOut() {
    setBusy(true)
    await signOut({ notes })
    setBusy(false)
    setNotes('')
    refresh()
  }

  async function handleNotesBlur() {
    if (openEntry) await updateNotes(notes)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const siteLabel = (entry) => {
    if (entry.site_id) {
      const s = sites.find((x) => x.id === entry.site_id)
      return s ? s.name : 'Site'
    }
    return entry.site_name_other || 'Site'
  }

  return (
    <div className="screen">
      <div className="brandbar">
        <div className="name">IMPI <span>Job Cards</span></div>
        <button className="link" onClick={handleLogout}>Sign out of app</button>
      </div>

      {!online && (
        <div className="card" style={{ background: '#fdf3d6', border: '1px solid #f0d878' }}>
          <strong>No signal.</strong> Your sign-in/out will be saved on this device and sent
          automatically once you're back online.
        </div>
      )}
      {online && pending > 0 && (
        <div className="card" style={{ background: '#fdf3d6', border: '1px solid #f0d878' }}>
          Syncing {pending} saved {pending === 1 ? 'entry' : 'entries'}…
        </div>
      )}

      <div className="card">
        <h1>Hi, {profile.full_name}</h1>
        {openEntry ? (
          <span className="status-pill on">● Signed in — {siteLabel(openEntry)} since {formatTime(openEntry.sign_in_at)}</span>
        ) : (
          <span className="status-pill off">Not signed in</span>
        )}

        {!openEntry ? (
          <form onSubmit={handleSignIn}>
            <label htmlFor="site">Site</label>
            <select id="site" value={siteId} onChange={(e) => { setSiteId(e.target.value); setSiteOther('') }}>
              <option value="">— Select a site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="">Other (type below)</option>
            </select>
            {!siteId && (
              <input
                type="text"
                placeholder="Type site name"
                value={siteOther}
                onChange={(e) => setSiteOther(e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
            <button className="primary" type="submit" disabled={busy || (!siteId && !siteOther.trim())}>
              Sign in now
            </button>
          </form>
        ) : (
          <div>
            <label htmlFor="notes">Notes — what are you doing here today?</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="e.g. CCTV fault inspection, met with site manager…"
            />
            <button className="primary" onClick={handleSignOut} disabled={busy}>
              Sign out of this site
            </button>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2>Recent visits</h2>
          {recent.map((r) => (
            <div className="entry-row" key={r.localId}>
              <div className="site">{siteLabel(r)} <span className="times">— {formatDate(r.sign_in_at)}</span></div>
              <div className="times">
                {formatTime(r.sign_in_at)} → {formatTime(r.sign_out_at)}
                {(r.sign_in_offline || r.sign_out_offline) && <span className="offline-tag"> · saved offline</span>}
              </div>
              {r.notes && <div className="notes">{r.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
