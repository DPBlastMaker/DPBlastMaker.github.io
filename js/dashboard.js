var currentSession = null
var currentProfile = null

async function initDashboard() {
  currentSession = await requireAuth()
  currentProfile = await getProfile(currentSession.user.id)

  document.getElementById('username').textContent = currentProfile.username

  if (currentProfile.role === 'admin') {
    var adminLink = document.getElementById('adminLink')
    if (adminLink) adminLink.style.display = ''
  }

  await loadBlasts()

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    if (!confirm('Log out?')) return
    await logout()
    window.location.href = 'login.html'
  })

  document.getElementById('editSaveBtn').addEventListener('click', saveEdit)
  document.getElementById('editCancelBtn').addEventListener('click', cancelEdit)
}

async function loadBlasts() {
  var container = document.getElementById('blastsContainer')

  try {
    var result = await supabase
      .from('dp_blasts')
      .select('*')
      .eq('owner', currentSession.user.id)
      .order('created_at', { ascending: false })

    if (result.error) throw result.error
    var data = result.data || []

    if (data.length === 0) {
      container.innerHTML = [
        '<div class="empty">',
        '<p>You haven\'t created any DP Blasts yet.</p>',
        '<a href="create.html" class="btn btn-primary">Create Your First</a>',
        '</div>'
      ].join('')
      return
    }

    var ids = []
    data.forEach(function (b) {
      if (b.owner && !ids.includes(b.owner)) ids.push(b.owner)
    })
    var ownerNames = {}
    try {
      var pr = await supabase.from('profiles').select('id, username')
      if (pr.data) pr.data.forEach(function (p) { ownerNames[p.id] = p.username })
    } catch (e) {}

    container.innerHTML = data.map(function (b) {
      var name = b.anonymous ? 'Anonymous' : (ownerNames[b.owner] || 'Unknown')
      var viewerUrl = window.location.origin + '/' + b.slug
      return [
        '<div class="glass blast-item fade-in" data-id="' + b.id + '" style="margin-bottom:16px">',
        '<div class="dash-card">',
        '<img class="dash-thumb" src="' + (b.frame_url || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">',
        '<div class="dash-body">',
        '<h3 class="dash-title">' + escapeHtml(b.title) + '</h3>',
        (b.description ? '<p class="dash-desc">' + escapeHtml(b.description) + '</p>' : ''),
        '<div class="dash-meta">by ' + escapeHtml(name) + ' &middot; /' + b.slug + '</div>',
        '</div>',
        '</div>',
        '<div class="flex gap-8" style="margin-top:12px">',
        '<button class="btn btn-outline btn-sm edit-blast" data-id="' + b.id + '" data-title="' + escapeHtml(b.title) + '" data-desc="' + escapeHtml(b.description || '') + '">Edit</button>',
        '<button class="btn btn-outline btn-sm copy-link" data-slug="' + b.slug + '">Copy Link</button>',
        '<a href="' + viewerUrl + '" class="btn btn-primary btn-sm">Open</a>',
        '<button class="btn btn-danger btn-sm delete-blast" data-id="' + b.id + '">Delete</button>',
        '</div>',
        '</div>'
      ].join('')
    }).join('')

    container.querySelectorAll('.copy-link').forEach(function (btn) {
      btn.addEventListener('click', function () { copyLink(btn.dataset.slug) })
    })
    container.querySelectorAll('.delete-blast').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteBlast(btn.dataset.id) })
    })
    container.querySelectorAll('.edit-blast').forEach(function (btn) {
      btn.addEventListener('click', function () { openEdit(btn.dataset.id, btn.dataset.title, btn.dataset.desc) })
    })
  } catch (err) {
    container.innerHTML = '<div class="msg error">' + escapeHtml(err.message || 'Failed') + '</div>'
  }
}

function copyLink(slug) {
  var url = window.location.origin + '/' + slug
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function () {
      alert('Link copied!')
    }).catch(function () { alert(url) })
  } else { alert(url) }
}

async function deleteBlast(id) {
  if (!confirm('Delete this DP Blast permanently?')) return
  try {
    await supabase.from('dp_blasts').delete().eq('id', id)
    await loadBlasts()
  } catch (err) {
    alert(err.message || 'Failed to delete.')
  }
}

var editingId = null

function openEdit(id, title, desc) {
  editingId = id
  document.getElementById('editTitle').value = title
  document.getElementById('editDesc').value = desc
  document.getElementById('editMsg').className = 'msg'
  document.getElementById('editMsg').textContent = ''
  document.getElementById('editModal').style.display = ''
}

async function saveEdit() {
  var title = document.getElementById('editTitle').value.trim()
  var desc = document.getElementById('editDesc').value.trim()
  var msgEl = document.getElementById('editMsg')
  msgEl.className = 'msg'

  if (!title) {
    msgEl.textContent = 'Title is required.'
    msgEl.className = 'msg error'
    return
  }

  var btn = document.getElementById('editSaveBtn')
  btn.disabled = true
  btn.textContent = 'Saving...'

  try {
    var r = await supabase.from('dp_blasts').update({ title: title, description: desc }).eq('id', editingId)
    if (r.error) throw r.error
    cancelEdit()
    await loadBlasts()
  } catch (err) {
    msgEl.textContent = err.message || 'Failed to save.'
    msgEl.className = 'msg error'
  } finally {
    btn.disabled = false
    btn.textContent = 'Save'
  }
}

function cancelEdit() {
  editingId = null
  document.getElementById('editTitle').value = ''
  document.getElementById('editDesc').value = ''
  document.getElementById('editMsg').className = 'msg'
  document.getElementById('editMsg').textContent = ''
  document.getElementById('editModal').style.display = 'none'
}

function escapeHtml(s) {
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

document.addEventListener('DOMContentLoaded', initDashboard)
