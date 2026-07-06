import { supabase } from './supabaseClient'

// ------------------------------------------------------------------
// This module lets staff sign in / sign out even with no signal.
// Everything is written to localStorage immediately so the UI never
// blocks, then quietly synced to Supabase in the background whenever
// a connection is available.
//
// localStorage keys used:
//   ijc_open_entry   -> the visit currently in progress (or null)
//   ijc_pending_ops  -> queue of writes waiting to reach the server
//   ijc_recent       -> last few completed visits, for the on-screen list
// ------------------------------------------------------------------

const OPEN_KEY = 'ijc_open_entry'
const QUEUE_KEY = 'ijc_pending_ops'
const RECENT_KEY = 'ijc_recent'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getOpenEntry() {
  return read(OPEN_KEY, null)
}
export function getRecentEntries() {
  return read(RECENT_KEY, [])
}
function pushRecent(entry) {
  const recent = getRecentEntries()
  recent.unshift(entry)
  write(RECENT_KEY, recent.slice(0, 15))
}
function getQueue() {
  return read(QUEUE_KEY, [])
}
function setQueue(q) {
  write(QUEUE_KEY, q)
}

function localId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

// ---- SIGN IN --------------------------------------------------------

export async function signIn({ staffId, siteId, siteNameOther }) {
  const now = new Date().toISOString()
  const lid = localId()

  const entry = {
    localId: lid,
    id: null,
    staff_id: staffId,
    site_id: siteId || null,
    site_name_other: siteNameOther || null,
    sign_in_at: now,
    sign_in_offline: !navigator.onLine,
    sign_out_at: null,
    notes: ''
  }

  write(OPEN_KEY, entry)

  if (navigator.onLine) {
    const { data, error } = await supabase
      .from('job_entries')
      .insert({
        staff_id: staffId,
        site_id: siteId || null,
        site_name_other: siteNameOther || null,
        sign_in_at: now,
        sign_in_offline: false
      })
      .select()
      .single()

    if (!error && data) {
      entry.id = data.id
      write(OPEN_KEY, entry)
      return entry
    }
    // Insert failed even though we're "online" (e.g. flaky connection) — queue it.
  }

  // Offline, or the immediate insert failed: queue it for later.
  const queue = getQueue()
  queue.push({ op: 'insert', localId: lid, table: 'job_entries', payload: {
    staff_id: staffId,
    site_id: siteId || null,
    site_name_other: siteNameOther || null,
    sign_in_at: now,
    sign_in_offline: true
  }})
  setQueue(queue)
  return entry
}

// ---- SIGN OUT ---------------------------------------------------------

export async function signOut({ notes }) {
  const entry = getOpenEntry()
  if (!entry) return null

  const now = new Date().toISOString()
  entry.sign_out_at = now
  entry.sign_out_offline = !navigator.onLine
  entry.notes = notes || ''

  if (entry.id && navigator.onLine) {
    const { error } = await supabase
      .from('job_entries')
      .update({ sign_out_at: now, sign_out_offline: false, notes: notes || '' })
      .eq('id', entry.id)

    if (!error) {
      localStorage.removeItem(OPEN_KEY)
      pushRecent(entry)
      return entry
    }
  }

  // Either offline, or no real id yet (the insert itself hasn't synced),
  // or the update failed — queue the sign-out to run once possible.
  const queue = getQueue()
  queue.push({
    op: 'update',
    targetId: entry.id,       // may be null if the insert hasn't synced yet
    localId: entry.localId,   // used to resolve targetId once insert syncs
    table: 'job_entries',
    payload: { sign_out_at: now, sign_out_offline: true, notes: notes || '' }
  })
  setQueue(queue)

  localStorage.removeItem(OPEN_KEY)
  pushRecent(entry)
  return entry
}

export async function updateNotes(notes) {
  const entry = getOpenEntry()
  if (!entry) return
  entry.notes = notes
  write(OPEN_KEY, entry)

  if (entry.id && navigator.onLine) {
    await supabase.from('job_entries').update({ notes }).eq('id', entry.id)
    return
  }
  const queue = getQueue()
  queue.push({
    op: 'update',
    targetId: entry.id,
    localId: entry.localId,
    table: 'job_entries',
    payload: { notes }
  })
  setQueue(queue)
}

// ---- SYNC -------------------------------------------------------------

let syncing = false

export async function flushQueue() {
  if (syncing || !navigator.onLine) return
  syncing = true
  try {
    let queue = getQueue()
    if (queue.length === 0) return

    // Map of localId -> real id, resolved as inserts succeed
    const resolved = {}
    const remaining = []

    for (const item of queue) {
      try {
        if (item.op === 'insert') {
          const { data, error } = await supabase
            .from('job_entries')
            .insert(item.payload)
            .select()
            .single()
          if (error) throw error
          resolved[item.localId] = data.id

          // If this insert is the currently-open entry, attach the real id
          const open = getOpenEntry()
          if (open && open.localId === item.localId) {
            open.id = data.id
            write(OPEN_KEY, open)
          }
        } else if (item.op === 'update') {
          const targetId = item.targetId || resolved[item.localId]
          if (!targetId) {
            // Insert for this entry hasn't synced yet — keep for next pass
            remaining.push(item)
            continue
          }
          const { error } = await supabase
            .from('job_entries')
            .update(item.payload)
            .eq('id', targetId)
          if (error) throw error
        }
      } catch (err) {
        // Keep it queued and stop this pass — try again on next trigger
        remaining.push(item)
      }
    }

    setQueue(remaining)
  } finally {
    syncing = false
  }
}

export function setupAutoSync() {
  window.addEventListener('online', flushQueue)
  // Also retry periodically in case 'online' doesn't fire reliably
  setInterval(flushQueue, 30000)
  flushQueue()
}

export function pendingCount() {
  return getQueue().length
}
