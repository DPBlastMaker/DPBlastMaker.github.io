var currentSession = null
var deleteModal = null

function throttle(fn, ms) {
  var last = 0
  return function () {
    var now = Date.now()
    if (now - last < ms) return
    last = now
    return fn.apply(this, arguments)
  }
}

async function initAdmin() {
  var session = await getSession()
  if (!session) {
    var hasAdmin = await checkHasAdmin()
    if (!hasAdmin) { renderFirstAdminSetup(); return }
    window.location.href = 'login.html'
    return
  }
  try {
    var profile = await getProfile(session.user.id)
    if (profile.role !== 'admin') { window.location.href = 'dashboard.html'; return }
    currentSession = session
    document.getElementById('adminUsername').textContent = profile.username
    await Promise.all([loadUsers(), loadBlasts()])
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser)
    document.getElementById('logoutBtn').addEventListener('click', function () {
      logout().then(function () { window.location.href = 'login.html' })
    })
    buildDeleteModal()
  } catch (err) {
    var hasAdmin = await checkHasAdmin()
    if (!hasAdmin) renderFirstAdminSetup()
    else window.location.href = 'login.html'
  }
}

function checkHasAdmin() {
  return supabase.from('profiles').select('*').eq('role', 'admin').then(function (r) {
    return r.data && r.data.length > 0
  }).catch(function () { return false })
}

function renderFirstAdminSetup() {
  var el = document.querySelector('.admin-grid'); if (el) el.remove()
  el = document.querySelector('.card.mt-24'); if (el) el.remove()
  var un = document.getElementById('adminUsername'); if (un) un.remove()
  document.querySelector('.page-title').textContent = 'Welcome — Set Up Admin'
  var main = document.querySelector('.page')
  main.innerHTML = [
    '<div class="glass max-w-sm mx-auto fade-in" style="margin-top:24px">',
    '<h2>Create First Admin</h2>',
    '<p class="text-secondary text-sm mb-24">No admin account found. Sign up, then promote yourself.</p>',
    '<form id="firstAdminForm">',
    '<div class="form-group"><label>Admin Username</label>',
    '<input type="text" id="adminUserInput" placeholder="e.g. admin" required></div>',
    '<div class="form-group"><label>Password</label>',
    '<input type="password" id="adminPassInput" placeholder="Min 6 characters" required minlength="6"></div>',
    '<div id="firstAdminMsg" class="msg"></div>',
    '<button type="submit" class="btn btn-primary w-full">Create Admin</button>',
    '</form>',
    '<p class="text-muted text-sm mt-16 text-center">Already have an account? <a href="login.html">Sign in</a></p>',
    '</div>'
  ].join('')
  document.getElementById('firstAdminForm').addEventListener('submit', function (e) {
    e.preventDefault()
    var username = document.getElementById('adminUserInput').value.trim()
    var password = document.getElementById('adminPassInput').value
    var msgEl = document.getElementById('firstAdminMsg')
    msgEl.className = 'msg'
    if (!username || password.length < 6) {
      msgEl.textContent = 'Username required and password ≥ 6 chars.'
      msgEl.className = 'msg error'; return
    }
    var btn = e.target.querySelector('button[type="submit"]')
    btn.disabled = true; btn.textContent = 'Creating...'
    supabase.auth.signUp({ email: username + '@dpblast.local', password: password }).then(function (res) {
      if (res.error) throw res.error
      return supabase.rpc('bootstrap_first_admin')
    }).then(function () {
      return supabase.auth.signInWithPassword({ email: username + '@dpblast.local', password: password })
    }).then(function () {
      window.location.href = 'admin.html'
    }).catch(function (err) {
      msgEl.textContent = err.message || 'Failed.'
      msgEl.className = 'msg error'
      btn.disabled = false; btn.textContent = 'Create Admin'
    })
  })
}

function handleCreateUser(e) {
  e.preventDefault()
  var username = document.getElementById('newUsername').value.trim()
  var password = document.getElementById('newPassword').value
  var role = document.getElementById('newRole').value
  var msgEl = document.getElementById('createUserMsg')
  msgEl.className = 'msg'
  if (!username || !password) {
    msgEl.textContent = 'Username and password required.'
    msgEl.className = 'msg error'; return
  }
  var btn = e.target.querySelector('button[type="submit"]')
  btn.disabled = true; btn.textContent = 'Creating...'
  supabase.rpc('admin_create_user', {
    p_username: username, p_password: password, p_role: role,
  }).then(function (r) {
    if (r.error) throw r.error
    msgEl.textContent = 'User "' + username + '" created!'
    msgEl.className = 'msg success'
    document.getElementById('createUserForm').reset()
    return loadUsers()
  }).catch(function (err) {
    msgEl.textContent = err.message || 'Failed.'
    msgEl.className = 'msg error'
  }).then(function () {
    btn.disabled = false; btn.textContent = 'Create User'
  })
}

function loadUsers() {
  var container = document.getElementById('usersList')
  container.innerHTML = '<div class="spinner"></div>'
  return supabase.rpc('admin_get_users').then(function (r) {
    if (r.error) throw r.error
    var data = r.data || []
    if (data.length === 0) { container.innerHTML = '<p class="text-muted">No users.</p>'; return }
    var html = ''
    data.forEach(function (u) {
      var isSelf = currentSession && u.id === currentSession.user.id
      html += [
        '<div class="usr" data-id="' + u.id + '">',
        '<div class="usr-body">',
        '<div class="usr-name">' + escapeHtml(u.username) + '</div>',
        '<div class="usr-meta">' + escapeHtml((u.email || '').split('@')[0] + '@…') + ' · ' + (u.blast_count || 0) + ' blasts · joined ' + fmtDate(u.created_at) + '</div>',
        '</div>',
        '<div class="usr-actions">',
        '<span class="badge ' + (u.role === 'admin' ? 'badge-admin' : 'badge-creator') + '">' + u.role + '</span>',
        !isSelf ? '<button class="btn btn-outline btn-sm rpw" data-id="' + u.id + '" data-name="' + escapeHtml(u.username) + '">Reset PW</button>' : '',
        !isSelf ? '<button class="btn btn-danger btn-sm del" data-id="' + u.id + '" data-name="' + escapeHtml(u.username) + '">Delete</button>' : '',
        '</div>',
        '</div>'
      ].join('')
    })
    container.innerHTML = html
    container.querySelectorAll('.rpw').forEach(function (b) {
      b.addEventListener('click', function () { resetPw(b.dataset.id, b.dataset.name) })
    })
    container.querySelectorAll('.del').forEach(function (b) {
      b.addEventListener('click', function () { showDeleteModal(b.dataset.id, b.dataset.name) })
    })
  }).catch(function (err) {
    container.innerHTML = '<div class="msg error">' + escapeHtml(err.message || 'Failed to load users') + '</div>'
  })
}

function loadBlasts() {
  var container = document.getElementById('blastsList')
  container.innerHTML = '<div class="spinner"></div>'
  return supabase.from('dp_blasts').select('*').order('created_at', { ascending: false }).then(function (r) {
    if (r.error) throw r.error
    var data = r.data || []
    if (data.length === 0) { container.innerHTML = '<p class="text-muted">No blasts yet.</p>'; return }
    var ids = []
    data.forEach(function (b) { if (b.owner && ids.indexOf(b.owner) === -1) ids.push(b.owner) })
    return supabase.from('profiles').select('*').then(function (pr) {
      var pm = {}
      ;(pr.data || []).forEach(function (p) { pm[p.id] = p.username })
      var html = ''
      data.forEach(function (b) {
        html += [
          '<div class="blast-row">',
          '<div class="blast-info">',
          '<span class="blast-title">' + escapeHtml(b.title) + '</span>',
          '<span class="blast-meta">by ' + escapeHtml(pm[b.owner] || 'unknown') + ' · /' + b.slug + ' · ' + (b.likes || 0) + ' ♥</span>',
          '</div>',
          '<button class="btn btn-danger btn-sm dblast" data-id="' + b.id + '">Delete</button>',
          '</div>'
        ].join('')
      })
      container.innerHTML = html
      container.querySelectorAll('.dblast').forEach(function (b) {
        b.addEventListener('click', function () { adminDeleteBlast(b.dataset.id) })
      })
    })
  }).catch(function (err) {
    container.innerHTML = '<div class="msg error">' + escapeHtml(err.message || 'Failed to load blasts') + '</div>'
  })
}

function resetPw(userId, name) {
  var pw = prompt('New password for ' + name + ' (≥ 6 chars):')
  if (!pw || pw.length < 6) { alert('Password must be ≥ 6 characters.'); return }
  var btn = document.querySelector('.rpw[data-id="' + userId + '"]')
  if (btn) { btn.disabled = true; btn.textContent = 'Resetting...' }
  supabase.rpc('admin_reset_password', { target_id: userId, new_password: pw }).then(function (r) {
    if (r.error) throw r.error
    alert('Password reset for ' + name + '!')
  }).catch(function (err) {
    alert(err.message || 'Failed to reset password.')
  }).then(function () {
    if (btn) { btn.disabled = false; btn.textContent = 'Reset PW' }
  })
}

function buildDeleteModal() {
  var d = document.createElement('div')
  d.id = 'deleteModal'
  d.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;padding:24px'
  d.innerHTML = [
    '<div class="glass" style="max-width:420px;width:100%;padding:24px;text-align:center">',
    '<h2 style="font-size:1.1rem;font-weight:500;margin-bottom:8px">Delete Account?</h2>',
    '<p class="text-secondary text-sm mb-24" id="delModalText">This cannot be undone.</p>',
    '<div class="flex gap-8" style="justify-content:center">',
    '<button class="btn btn-outline" id="delCancel">Cancel</button>',
    '<button class="btn btn-danger" id="delConfirm">Delete</button>',
    '</div>',
    '<div id="delModalMsg" class="msg mt-16"></div>',
    '</div>'
  ].join('')
  document.body.appendChild(d)
  deleteModal = d
  d.querySelector('#delCancel').addEventListener('click', hideDeleteModal)
  d.querySelector('#delConfirm').addEventListener('click', confirmDelete)
}

var deleteTargetId = null

function showDeleteModal(userId, userName) {
  deleteTargetId = userId
  document.getElementById('delModalText').textContent = 'Delete "' + userName + '"? This removes their account, blasts, and data permanently.'
  document.getElementById('delModalMsg').className = 'msg'
  deleteModal.style.display = 'flex'
}

function hideDeleteModal() {
  deleteModal.style.display = 'none'
  deleteTargetId = null
}

var confirmDelete = throttle(function () {
  if (!deleteTargetId) return
  var btn = document.getElementById('delConfirm')
  var msg = document.getElementById('delModalMsg')
  msg.className = 'msg'
  btn.disabled = true; btn.textContent = 'Deleting...'
  supabase.rpc('admin_delete_user', { target_id: deleteTargetId }).then(function (r) {
    if (r.error) throw r.error
    msg.textContent = 'Deleted.'
    msg.className = 'msg success'
    hideDeleteModal()
    return loadUsers()
  }).catch(function (err) {
    msg.textContent = err.message || 'Failed.'
    msg.className = 'msg error'
  }).then(function () {
    btn.disabled = false; btn.textContent = 'Delete'
  })
}, 2000)

function adminDeleteBlast(id) {
  if (!confirm('Delete this blast permanently?')) return
  supabase.from('dp_blasts').delete().eq('id', id).then(function (r) {
    if (r.error) throw r.error
    loadBlasts()
  }).catch(function (err) {
    alert(err.message || 'Failed to delete.')
  })
}

function fmtDate(d) {
  if (!d) return '?'
  return new Date(d).toLocaleDateString()
}

function escapeHtml(s) {
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

document.addEventListener('DOMContentLoaded', initAdmin)
