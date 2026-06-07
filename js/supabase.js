const SUPABASE_URL = 'https://ofrhkcslonreivgxnxof.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_giGfbVP3QEdwi2mSgJ8Ang_jW-c5UZf'

const _h = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }

function _sid() {
  try {
    const r = localStorage.getItem('sb-session')
    if (!r) return null
    const s = JSON.parse(r)
    if (s.expires_at && s.expires_at < Math.floor(Date.now() / 1000)) {
      localStorage.removeItem('sb-session')
      return null
    }
    return s
  } catch { return null }
}
function _ss(s) {
  if (s) { s.expires_at = Math.floor(Date.now() / 1000) + s.expires_in; localStorage.setItem('sb-session', JSON.stringify(s)) }
  else { localStorage.removeItem('sb-session') }
}
function _ah() {
  const s = _sid()
  return s?.access_token ? { 'Authorization': `Bearer ${s.access_token}` } : {}
}

class QB {
  constructor(t) {
    this.table = t; this.filters = []; this._single = false; this._orderCol = null
    this._orderDir = 'asc'; this._method = 'select'; this._body = null; this._selectCols = '*'
  }
  eq(col, val) { this.filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this }
  single() { this._single = true; return this }
  order(col, { ascending } = {}) { this._orderCol = col; this._orderDir = ascending ? 'asc' : 'desc'; return this }
  select(cols) { this._selectCols = cols || '*'; this._method = 'select'; return this }
  insert(body) { this._body = body; this._method = 'insert'; return this }
  update(body) { this._body = body; this._method = 'update'; return this }
  delete() { this._method = 'delete'; return this }

  then(resolve, reject) {
    return this._exec().then(resolve, reject)
  }

  async _exec() {
    if (this._method === 'insert') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${this.table}`, {
        method: 'POST', headers: { ..._h, ..._ah(), 'Prefer': 'return=minimal' }, body: JSON.stringify(this._body),
      })
      if (res.status >= 400) { const d = await res.json().catch(() => ({})); return { data: null, error: { message: d.message || d.msg || `Insert failed (${res.status})` } } }
      return { data: null, error: null }
    }
    if (this._method === 'update') {
      let q = `/rest/v1/${this.table}`
      if (this.filters.length) q += '?' + this.filters.join('&')
      const res = await fetch(`${SUPABASE_URL}${q}`, {
        method: 'PATCH', headers: { ..._h, ..._ah(), 'Prefer': 'return=minimal' }, body: JSON.stringify(this._body),
      })
      if (res.status >= 400) { const d = await res.json().catch(() => ({})); return { data: null, error: { message: d.message || d.msg || `Update failed (${res.status})` } } }
      return { data: null, error: null }
    }
    if (this._method === 'delete') {
      let q = `/rest/v1/${this.table}`
      if (this.filters.length) q += '?' + this.filters.join('&')
      const res = await fetch(`${SUPABASE_URL}${q}`, {
        method: 'DELETE', headers: { ..._h, ..._ah(), 'Prefer': 'return=minimal' },
      })
      if (res.status >= 400) { const d = await res.json().catch(() => ({})); return { data: null, error: { message: d.message || d.msg || `Delete failed (${res.status})` } } }
      return { data: null, error: null }
    }
    let q = `/rest/v1/${this.table}?select=${this._selectCols}`
    if (this.filters.length) q += '&' + this.filters.join('&')
    if (this._orderCol) q += `&order=${this._orderCol}.${this._orderDir}`
    try {
      const res = await fetch(`${SUPABASE_URL}${q}`, { headers: _h })
      if (res.status >= 400) { const d = await res.json().catch(() => ({})); return { data: null, error: { message: d.message || d.msg || `Query failed (${res.status})` } } }
      const rows = res.status === 204 ? [] : await res.json()
      if (this._single) return { data: rows[0] || null, error: null }
      return { data: rows, error: null }
    } catch (e) {
      return { data: null, error: { message: e.message || 'Network error' } }
    }
  }
}

async function _rpc(name, params) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ..._h, ..._ah() },
      body: params ? JSON.stringify(params) : undefined,
    })
    if (res.status >= 400) {
      const d = await res.json().catch(() => ({}))
      return { data: null, error: { message: d.message || d.msg || `RPC failed (${res.status})` } }
    }
    const data = res.status === 204 ? null : await res.json()
    return { data, error: null }
  } catch (e) {
    return { data: null, error: { message: e.message || 'Network error' } }
  }
}

const supabase = {
  auth: {
    async signUp({ email, password }) {
      const data = await _fetch('POST', '/auth/v1/signup', { email, password })
      if (data?.access_token) _ss(data)
      return { data, error: null }
    },
    async signInWithPassword({ email, password }) {
      const data = await _fetch('POST', '/auth/v1/token?grant_type=password', { email, password })
      _ss(data)
      return { data, error: null }
    },
    async signOut() {
      const s = _sid()
      if (s?.access_token) { fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { ..._h, 'Authorization': `Bearer ${s.access_token}` } }).catch(() => {}) }
      _ss(null)
      return { error: null }
    },
    async getSession() { return { data: { session: _sid() }, error: null } },
  },
  from(table) { return new QB(table) },
  rpc(name, params) { return _rpc(name, params) },
  storage: {
    from(bucket) {
      return {
        async upload(path, file, opts) {
          const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
            method: 'POST',
            headers: {
              ..._ah(),
              'Content-Type': file.type || 'application/octet-stream',
              'cache-control': opts?.cacheControl || '3600',
              'x-upsert': opts?.upsert ? 'true' : 'false',
            },
            body: file,
          })
          if (res.status >= 400) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || `Upload failed (${res.status})`) }
          return res.json()
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } }
        },
      }
    }
  },
}

async function _fetch(method, path, body, extraH) {
  const h = { ..._h, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, ...extraH }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (res.status >= 400) {
    const m = typeof data === 'string' ? data : (data.msg || data.error || data.message || `Request failed (${res.status})`)
    throw new Error(typeof m === 'string' ? m : JSON.stringify(m))
  }
  return data
}
