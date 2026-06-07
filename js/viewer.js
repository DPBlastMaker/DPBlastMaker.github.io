(function () {
  var OUTPUT_SIZE = 512

  var state = {
    photo: null,
    frame: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
    minScale: 0.5,
    maxScale: 3,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    loaded: false,
  }

  var canvas = document.getElementById('previewCanvas')
  var ctx = canvas.getContext('2d')
  var wrap = document.getElementById('canvasWrap')
  var uploadInput = document.getElementById('photoInput')
  var zoomSlider = document.getElementById('zoomSlider')
  var zoomLabel = document.getElementById('zoomLabel')
  var rotateSlider = document.getElementById('rotateSlider')
  var rotateLabel = document.getElementById('rotateLabel')
  var downloadBtn = document.getElementById('downloadBtn')
  var resetBtn = document.getElementById('resetBtn')
  var msgEl = document.getElementById('viewer-msg')
  var hint = document.getElementById('drag-hint')

  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  var params = new URLSearchParams(window.location.search)
  var blastId = params.get('blast_id')
  var slug = params.get('slug')

  if (!blastId && !slug) {
    showError('No DP Blast specified.')
    return
  }

  if (blastId) {
    loadBlast('id', blastId)
  } else {
    loadBlast('slug', slug)
  }

  function loadBlast(field, value) {
    var q = supabase.from('dp_blasts').select('*').eq(field, value).single()
    q.then(function (result) {
        if (result.error || !result.data) {
          showError('DP Blast not found.')
          return
        }
        var blast = result.data
        document.getElementById('blast-title').textContent = blast.title
        document.getElementById('blast-slug').textContent = '/' + blast.slug

        var img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = function () {
          state.frame = img
          state.loaded = true
          render()
          document.getElementById('viewer-loading').style.display = 'none'
          document.getElementById('viewer-content').style.display = 'block'
        }
        img.onerror = function () {
          showError('Failed to load frame image.')
        }
        img.src = blast.frame_url
      })
      .catch(function (err) {
        showError(err.message || 'Failed to load DP Blast.')
      })
  }

  function showError(msg) {
    document.getElementById('viewer-loading').style.display = 'none'
    document.getElementById('viewer-content').style.display = 'none'
    document.getElementById('viewer-error').style.display = 'block'
    document.getElementById('error-text').textContent = msg
  }

  function render() {
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    if (state.photo) {
      var photoSize = OUTPUT_SIZE * state.scale
      var px = (OUTPUT_SIZE - photoSize) / 2 + state.offsetX
      var py = (OUTPUT_SIZE - photoSize) / 2 + state.offsetY
      var cx = px + photoSize / 2
      var cy = py + photoSize / 2
      var rad = state.rotation * Math.PI / 180
      ctx.save()
      ctx.beginPath()
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.translate(cx, cy)
      ctx.rotate(rad)
      ctx.drawImage(state.photo, -photoSize / 2, -photoSize / 2, photoSize, photoSize)
      ctx.restore()
    }

    if (state.frame) {
      ctx.drawImage(state.frame, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    }
  }

  function loadPhoto(file) {
    var reader = new FileReader()
    reader.onload = function (e) {
      var img = new Image()
      img.onload = function () {
        state.photo = img
        state.offsetX = 0
        state.offsetY = 0
        state.scale = 1
        state.rotation = 0
        zoomSlider.value = 1
        zoomLabel.textContent = '1.0x'
        rotateSlider.value = 0
        rotateLabel.textContent = '0\u00B0'
        downloadBtn.disabled = false
        showHint()
        render()
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  var hintTimeout = null
  function showHint() {
    hint.style.opacity = '1'
    clearTimeout(hintTimeout)
    hintTimeout = setTimeout(function () {
      hint.style.opacity = '0'
    }, 2500)
  }

  uploadInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      loadPhoto(this.files[0])
    }
  })

  zoomSlider.addEventListener('input', function () {
    state.scale = parseFloat(this.value)
    zoomLabel.textContent = state.scale.toFixed(1) + 'x'
    render()
  })

  rotateSlider.addEventListener('input', function () {
    state.rotation = parseFloat(this.value)
    rotateLabel.textContent = state.rotation + '\u00B0'
    render()
  })

  resetBtn.addEventListener('click', function () {
    state.offsetX = 0
    state.offsetY = 0
    state.scale = 1
    state.rotation = 0
    zoomSlider.value = 1
    zoomLabel.textContent = '1.0x'
    rotateSlider.value = 0
    rotateLabel.textContent = '0\u00B0'
    render()
  })

  function getCanvasCoords(clientX, clientY) {
    var rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (OUTPUT_SIZE / rect.width),
      y: (clientY - rect.top) * (OUTPUT_SIZE / rect.height),
    }
  }

  function onPointerDown(clientX, clientY) {
    if (!state.photo) return
    state.isDragging = true
    var coords = getCanvasCoords(clientX, clientY)
    state.dragStartX = coords.x
    state.dragStartY = coords.y
    state.dragOffsetX = state.offsetX
    state.dragOffsetY = state.offsetY
    wrap.style.cursor = 'grabbing'
  }

  function onPointerMove(clientX, clientY) {
    if (!state.isDragging) return
    var coords = getCanvasCoords(clientX, clientY)
    state.offsetX = state.dragOffsetX + (coords.x - state.dragStartX)
    state.offsetY = state.dragOffsetY + (coords.y - state.dragStartY)
    render()
  }

  function onPointerUp() {
    if (state.isDragging) {
      state.isDragging = false
      wrap.style.cursor = 'grab'
    }
  }

  wrap.addEventListener('mousedown', function (e) {
    onPointerDown(e.clientX, e.clientY)
  })

  window.addEventListener('mousemove', function (e) {
    onPointerMove(e.clientX, e.clientY)
  })

  window.addEventListener('mouseup', onPointerUp)

  wrap.addEventListener('touchstart', function (e) {
    var touch = e.touches[0]
    onPointerDown(touch.clientX, touch.clientY)
    e.preventDefault()
  }, { passive: false })

  wrap.addEventListener('touchmove', function (e) {
    var touch = e.touches[0]
    onPointerMove(touch.clientX, touch.clientY)
    e.preventDefault()
  }, { passive: false })

  wrap.addEventListener('touchend', function (e) {
    onPointerUp()
    e.preventDefault()
  }, { passive: false })

  downloadBtn.addEventListener('click', function () {
    var link = document.createElement('a')
    link.download = 'dp-blast.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  })
})()
