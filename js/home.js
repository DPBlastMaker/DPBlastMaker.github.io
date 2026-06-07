(function () {
  var grid = document.getElementById('blasts-grid')
  var loading = document.getElementById('loading-state')
  var empty = document.getElementById('empty-state')

  var session = _sid()
  if (session) {
    document.body.classList.add('logged-in')
    var logoutBtn = document.getElementById('logoutBtnHome')
    if (logoutBtn) {
      logoutBtn.style.display = ''
      logoutBtn.addEventListener('click', function () {
        _ss(null)
        window.location.reload()
      })
    }
  }

  function createBlastCard(blast) {
    var card = document.createElement('div')
    card.className = 'blast-card'

    var imgUrl = blast.frame_url || ''

    var viewerUrl = window.location.origin + '/' + blast.slug

    card.innerHTML =
      '<img class="preview" src="' + imgUrl + '" alt="' + escapeHtml(blast.title) + '" loading="lazy" onerror="this.src=\'\';this.style.background=\'var(--bg-secondary)\'">' +
      '<div class="body">' +
        '<h3>' + escapeHtml(blast.title) + '</h3>' +
        '<div class="slug">#' + escapeHtml(blast.slug) + '</div>' +
        '<div class="footer">' +
          '<button class="like-btn" data-id="' + blast.id + '" data-liked="false">' +
            '<span class="heart">♡</span> <span class="count">0</span>' +
          '</button>' +
          '<div class="flex gap-8">' +
            '<button class="btn btn-outline btn-sm copy-link" data-url="' + viewerUrl + '">Copy Link</button>' +
            '<a href="' + viewerUrl + '" class="btn btn-primary btn-sm">Open</a>' +
          '</div>' +
        '</div>' +
      '</div>'

    var likeBtn = card.querySelector('.like-btn')
    likeBtn.addEventListener('click', function () {
      handleLike(blast.id, likeBtn)
    })

    var copyBtn = card.querySelector('.copy-link')
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(viewerUrl)
      var orig = copyBtn.textContent
      copyBtn.textContent = 'Copied!'
      setTimeout(function () { copyBtn.textContent = orig }, 2000)
    })

    return card
  }

  function escapeHtml(str) {
    var div = document.createElement('div')
    div.appendChild(document.createTextNode(str))
    return div.innerHTML
  }

  function loadLikes() {
    var stored = localStorage.getItem('dpblast_likes')
    return stored ? JSON.parse(stored) : {}
  }

  function saveLikes(likes) {
    localStorage.setItem('dpblast_likes', JSON.stringify(likes))
  }

  function handleLike(blastId, btn) {
    var likes = loadLikes()
    var span = btn.querySelector('.count')
    var heart = btn.querySelector('.heart')
    var currentCount = parseInt(span.textContent, 10)

    if (likes[blastId]) {
      likes[blastId] = false
      btn.classList.remove('liked')
      heart.textContent = '♡'
      span.textContent = Math.max(0, currentCount - 1)
      saveLikes(likes)
    } else {
      likes[blastId] = true
      btn.classList.add('liked')
      heart.textContent = '♥'
      span.textContent = currentCount + 1
      saveLikes(likes)
      supabase.rpc('increment_likes', { p_blast_id: blastId })
    }
  }

  function renderBlasts() {
    loading.style.display = 'block'
    empty.style.display = 'none'

    supabase
      .from('dp_blasts')
      .select('id, title, slug, frame_url, likes')
      .order('created_at', { ascending: false })
      .then(function (result) {
        loading.style.display = 'none'
        if (result.error) {
          grid.innerHTML = '<div class="empty"><p>Failed to load blasts</p></div>'
          return
        }

        var blasts = result.data || []
        if (blasts.length === 0) {
          empty.style.display = 'block'
          return
        }

        grid.innerHTML = ''
        var userLikes = loadLikes()

        blasts.forEach(function (b) {
          var card = createBlastCard(b)
          var likeBtn = card.querySelector('.like-btn')
          var span = likeBtn.querySelector('.count')
          var heart = likeBtn.querySelector('.heart')
          span.textContent = b.likes || 0

          if (userLikes[b.id]) {
            likeBtn.classList.add('liked')
            heart.textContent = '♥'
          } else {
            heart.textContent = '♡'
          }

          grid.appendChild(card)
        })
      })
  }

  renderBlasts()
})()
