async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  return session
}

async function requireRole(role) {
  const session = await requireAuth()
  const profile = await getProfile(session.user.id)
  if (profile.role !== role) {
    window.location.href = 'dashboard.html'
    return
  }
  return { session, profile }
}
