var currentSession = null
var pendingSlug = null
var pendingFrameDataUrl = null
var pendingTitle = null
var pendingDesc = ''
var pendingLink = ''
var pendingAnon = false
var pendingFileName = null
var testPhotoImg = null
var testState = { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, isDragging: false }

var OUTPUT_SIZE = 512
var canvas = document.getElementById('testCanvas')
var ctx = canvas.getContext('2d')
canvas.width = OUTPUT_SIZE
canvas.height = OUTPUT_SIZE

async function initCreate() {
  var session = await getSession()
  if (!session) {
    document.getElementById('stepForm').querySelector('form').style.display = 'none'
    document.getElementById('cancelBtn').style.display = 'none'
    var msg = document.getElementById('createMsg')
    msg.className = 'msg error'
    msg.innerHTML = 'You need to sign up or log in to create DP Blasts.' +
      '<div class="mt-12 flex gap-8">' +
      '<a href="signup.html" class="btn btn-primary btn-sm">Sign Up</a>' +
      '<a href="login.html" class="btn btn-outline btn-sm">Log In</a></div>'
    return
  }
  currentSession = session
  document.getElementById('createForm').addEventListener('submit', handleFormSubmit)
  document.getElementById('cancelBtn').addEventListener('click', function () {
    window.location.href = 'dashboard.html'
  })
  document.getElementById('testPhoto').addEventListener('change', handleTestPhoto)
  document.getElementById('publishBtn').addEventListener('click', handlePublish)
  document.getElementById('cancelTestBtn').addEventListener('click', function () {
    window.location.href = 'dashboard.html'
  })
  setupDrag()
  document.getElementById('zoomSlider').addEventListener('input', function () {
    testState.scale = parseFloat(this.value)
    document.getElementById('zoomLabel').textContent = testState.scale.toFixed(1) + 'x'
    renderTest()
  })
  document.getElementById('rotateSlider').addEventListener('input', function () {
    testState.rotation = parseFloat(this.value)
    document.getElementById('rotateLabel').textContent = testState.rotation + '\u00B0'
    renderTest()
  })
}

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60) || 'blast'
}

function handleFormSubmit(e) {
  e.preventDefault()
  var title = document.getElementById('titleInput').value.trim()
  var file = document.getElementById('frameInput').files[0]
  var msgEl = document.getElementById('createMsg')
  msgEl.className = 'msg'

  if (!title || !file) {
    msgEl.textContent = 'Enter a title and select a frame PNG.'
    msgEl.className = 'msg error'
    return
  }
  if (!file.type.startsWith('image/')) {
    msgEl.textContent = 'Frame must be an image.'
    msgEl.className = 'msg error'
    return
  }

  var desc = document.getElementById('descInput').value.trim()
  var link = document.getElementById('linkInput').value.trim()
  var anon = document.getElementById('anonCheck').checked

  var slug = generateSlug(title)
  var ext = file.name.split('.').pop() || 'png'
  var fileName = slug + '-' + Date.now() + '.' + ext

  pendingSlug = slug
  pendingTitle = title
  pendingDesc = desc
  pendingLink = link
  pendingAnon = anon
  pendingFileName = fileName

  var reader = new FileReader()
  reader.onload = function (ev) {
    pendingFrameDataUrl = ev.target.result
    showTestStep()
  }
  reader.readAsDataURL(file)
}

function showTestStep() {
  document.getElementById('stepForm').style.display = 'none'
  document.getElementById('stepTest').style.display = 'block'

  var img = new Image()
  img.onload = function () {
    testState.frame = img
    renderTest()
  }
  img.src = pendingFrameDataUrl
}

function handleTestPhoto(e) {
  var file = e.target.files[0]
  if (!file) return
  var reader = new FileReader()
  reader.onload = function (ev) {
    var img = new Image()
    img.onload = function () {
      testPhotoImg = img
      testState.offsetX = 0
      testState.offsetY = 0
      testState.scale = 1
      testState.rotation = 0
      document.getElementById('zoomSlider').value = 1
      document.getElementById('zoomLabel').textContent = '1.0x'
      document.getElementById('rotateSlider').value = 0
      document.getElementById('rotateLabel').textContent = '0\u00B0'
      renderTest()
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

function renderTest() {
  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  if (testPhotoImg) {
    var photoSize = OUTPUT_SIZE * testState.scale
    var px = (OUTPUT_SIZE - photoSize) / 2 + testState.offsetX
    var py = (OUTPUT_SIZE - photoSize) / 2 + testState.offsetY
    var cx = px + photoSize / 2
    var cy = py + photoSize / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.translate(cx, cy)
    ctx.rotate(testState.rotation * Math.PI / 180)
    ctx.drawImage(testPhotoImg, -photoSize / 2, -photoSize / 2, photoSize, photoSize)
    ctx.restore()
  }

  if (testState.frame) {
    ctx.drawImage(testState.frame, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  }
}

function setupDrag() {
  var wrap = document.getElementById('testCanvasWrap')
  var dragStartX, dragStartY, dragOffsetX, dragOffsetY

  function getCoords(cx, cy) {
    var r = canvas.getBoundingClientRect()
    return { x: (cx - r.left) * (OUTPUT_SIZE / r.width), y: (cy - r.top) * (OUTPUT_SIZE / r.height) }
  }

  function onDown(cx, cy) {
    if (!testPhotoImg) return
    testState.isDragging = true
    var c = getCoords(cx, cy)
    dragStartX = c.x
    dragStartY = c.y
    dragOffsetX = testState.offsetX
    dragOffsetY = testState.offsetY
    wrap.style.cursor = 'grabbing'
  }

  function onMove(cx, cy) {
    if (!testState.isDragging) return
    var c = getCoords(cx, cy)
    testState.offsetX = dragOffsetX + (c.x - dragStartX)
    testState.offsetY = dragOffsetY + (c.y - dragStartY)
    renderTest()
  }

  function onUp() {
    if (testState.isDragging) {
      testState.isDragging = false
      wrap.style.cursor = 'grab'
    }
  }

  wrap.addEventListener('mousedown', function (e) { onDown(e.clientX, e.clientY) })
  window.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY) })
  window.addEventListener('mouseup', onUp)
  wrap.addEventListener('touchstart', function (e) { var t = e.touches[0]; onDown(t.clientX, t.clientY); e.preventDefault() }, { passive: false })
  wrap.addEventListener('touchmove', function (e) { var t = e.touches[0]; onMove(t.clientX, t.clientY); e.preventDefault() }, { passive: false })
  wrap.addEventListener('touchend', function (e) { onUp(); e.preventDefault() }, { passive: false })
}

async function handlePublish() {
  var msgEl = document.getElementById('testMsg')
  var btn = document.getElementById('publishBtn')
  msgEl.className = 'msg'
  btn.disabled = true
  btn.textContent = 'Publishing...'

  try {
    var blob = await (await fetch(pendingFrameDataUrl)).blob()
    await supabase.storage.from('frames').upload(pendingFileName, blob, {
      cacheControl: '3600', upsert: false,
    })
    var urlData = supabase.storage.from('frames').getPublicUrl(pendingFileName)
    var frameUrl = urlData.data.publicUrl

    await supabase.from('dp_blasts').insert({
      title: pendingTitle,
      slug: pendingSlug,
      description: pendingDesc,
      link_url: pendingLink,
      anonymous: pendingAnon,
      frame_url: frameUrl,
      owner: currentSession.user.id,
    })

    msgEl.textContent = 'Published! Redirecting...'
    msgEl.className = 'msg success'
    setTimeout(function () {
      window.location.href = '/' + pendingSlug
    }, 1000)
  } catch (err) {
    msgEl.textContent = err.message || 'Failed to publish.'
    msgEl.className = 'msg error'
    btn.disabled = false
    btn.textContent = 'It works!'
  }
}

document.addEventListener('DOMContentLoaded', initCreate)
