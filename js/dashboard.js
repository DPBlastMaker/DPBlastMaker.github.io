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
    await logout()
    window.location.href = 'login.html'
  })
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
        '<div class="dash-meta">by ' + escapeHtml(name) + ' &middot; /' + b.slug + (b.link_url ? ' &middot; <a href="' + escapeHtml(b.link_url) + '" target="_blank" rel="noopener">Link</a>' : '') + '</div>',
        '</div>',
        '</div>',
        '<div class="flex gap-8" style="margin-top:12px">',
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

function escapeHtml(s) {
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

document.addEventListener('DOMContentLoaded', initDashboard)
