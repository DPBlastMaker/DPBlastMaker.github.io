let currentSession = null
let currentProfile = null

async function initDashboard() {
  currentSession = await requireAuth()
  currentProfile = await getProfile(currentSession.user.id)

  document.getElementById('username').textContent = currentProfile.username

  await loadBlasts()

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout()
    window.location.href = 'login.html'
  })
}

async function loadBlasts() {
  const container = document.getElementById('blastsContainer')

  try {
    const result = await supabase.from('dp_blasts')
      .select('*')
      .eq('owner', currentSession.user.id)
      .order('created_at', { ascending: false })

    if (result.error) throw result.error
    const data = result.data || []

    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <p>You haven't created any DP Blasts yet.</p>
          <a href="create.html" class="btn btn-primary">Create Your First</a>
        </div>
      `
      return
    }

    container.innerHTML = data.map(b => `
      <div class="glass blast-item fade-in" data-id="${b.id}" style="margin-bottom:16px">
        <div class="flex-between">
          <div>
            <h3 style="font-size:1rem;font-weight:600">${escapeHtml(b.title)}</h3>
            <p class="text-muted text-sm">/${b.slug}</p>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-outline btn-sm copy-link" data-id="${b.id}" data-slug="${b.slug}">Copy Link</button>
            <button class="btn btn-danger btn-sm delete-blast" data-id="${b.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('')

    container.querySelectorAll('.copy-link').forEach(btn => {
      btn.addEventListener('click', () => copyLink(btn.dataset.id, btn.dataset.slug))
    })
    container.querySelectorAll('.delete-blast').forEach(btn => {
      btn.addEventListener('click', () => deleteBlast(btn.dataset.id))
    })
  } catch (err) {
    container.innerHTML =
      `<div class="msg error">${escapeHtml(err.message)}</div>`
  }
}

async function copyLink(id, slug) {
  const url = `${window.location.origin}/${slug}`
  try {
    await navigator.clipboard.writeText(url)
    alert('Link copied to clipboard!')
  } catch {
    alert(url)
  }
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
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

document.addEventListener('DOMContentLoaded', initDashboard)
