(function () {
  var stored = localStorage.getItem('dpblast_dark')
  if (stored === '1') {
    document.body.classList.add('dark')
  }

  var btn = document.getElementById('darkToggle')
  if (!btn) return

  if (document.body.classList.contains('dark')) {
    btn.textContent = '\u2600\uFE0F'
  }

  btn.addEventListener('click', function () {
    document.body.classList.toggle('dark')
    var isDark = document.body.classList.contains('dark')
    localStorage.setItem('dpblast_dark', isDark ? '1' : '0')
    btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'
  })
})()
