const AUTH_STORAGE_KEY = 'student_support_auth'
const getAuthStorage = () => (typeof window !== 'undefined' ? window.sessionStorage : null)
const getLocalStorage = () => (typeof window !== 'undefined' ? window.localStorage : null)

const clearSharedAuthCopies = () => {
  if (typeof document === 'undefined') return
  getLocalStorage()?.removeItem(AUTH_STORAGE_KEY)
  document.cookie = `${AUTH_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`
}

const ROLE_ALIASES = {
  student: ['student'],
  support_officer: ['support_officer', 'support_offcier', 'support officer', 'support'],
  affairs: ['affairs', 'affairs_officer', 'affairs officer', 'student_affairs'],
  admin: ['admin', 'administrator']
}

const ROLE_DASHBOARD_ROUTES = {
  student: '/student/dashboard',
  support_officer: '/support/dashboard',
  affairs: '/affairs/dashboard',
  admin: '/admin/dashboard'
}

const ROLE_LOGIN_ROUTES = {
  student: '/student/login',
  support_officer: '/support/login',
  affairs: '/affairs/login',
  admin: '/admin/login'
}

const normalizeRole = (role = '') =>
  role
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

const isLikelyJwt = (token = '') => {
  if (typeof token !== 'string') {
    return false
  }
  return token.split('.').length === 3
}

const decodeJwtPayload = (token = '') => {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) {
      return null
    }
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

const isTokenExpired = (token = '') => {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) {
    return false
  }
  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now
}

export const canonicalizeRole = (role = '') => {
  const normalizedRole = normalizeRole(role)

  for (const [canonicalRole, aliases] of Object.entries(ROLE_ALIASES)) {
    if (aliases.map(normalizeRole).includes(normalizedRole)) {
      return canonicalRole
    }
  }

  return normalizedRole
}

export const saveAuthSession = (payload) => {
  const role = canonicalizeRole(payload.role)
  const authPayload = {
    access: payload.access,
    refresh: payload.refresh,
    role,
    roles: payload.roles || [],
    user: payload.user || null
  }

  getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(authPayload))
  clearSharedAuthCopies()
  return authPayload
}

export const persistAuthSession = (session) => {
  if (!session?.access) return null
  getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  clearSharedAuthCopies()
  return session
}

export const getAuthSession = () => {
  const storage = getAuthStorage()
  let raw = storage?.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.access || !isLikelyJwt(parsed.access)) {
      storage?.removeItem(AUTH_STORAGE_KEY)
      clearSharedAuthCopies()
      return null
    }

    const normalizedRole = canonicalizeRole(parsed.role)
    const normalizedRoles = Array.isArray(parsed.roles)
      ? parsed.roles.map(canonicalizeRole).filter(Boolean)
      : []
    const resolvedRole = normalizedRoles.length > 0 && !normalizedRoles.includes(normalizedRole)
      ? normalizedRoles[0]
      : normalizedRole

    return {
      ...parsed,
      role: resolvedRole,
      roles: normalizedRoles,
      accessExpired: isTokenExpired(parsed.access),
      refreshExpired: parsed.refresh ? isTokenExpired(parsed.refresh) : true
    }
  } catch {
    return null
  }
}

export const clearAuthSession = () => {
  getAuthStorage()?.removeItem(AUTH_STORAGE_KEY)
  clearSharedAuthCopies()
}

export const logout = clearAuthSession

export const updateAuthSessionUser = (userPatch = {}) => {
  const session = getAuthSession()
  if (!session) {
    return null
  }

  const nextSession = {
    ...session,
    user: {
      ...(session.user || {}),
      ...userPatch
    }
  }
  getAuthStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
  clearSharedAuthCopies()
  return nextSession
}

export const getCurrentRole = () => {
  const session = getAuthSession()
  if (!session) {
    return null
  }

  const role = canonicalizeRole(session.role)
  const roleList = Array.isArray(session.roles) ? session.roles.map(canonicalizeRole) : []
  if (roleList.length > 0 && !roleList.includes(role)) {
    return roleList[0] || null
  }

  return role || null
}

export const getAccessToken = () => getAuthSession()?.access || null

export const isAllowedRole = (role, allowedRoles = []) => {
  const canonicalRole = canonicalizeRole(role)
  const allowedSet = new Set(allowedRoles.map(canonicalizeRole))
  return allowedSet.has(canonicalRole)
}

export const getDashboardRouteForRole = (role) =>
  ROLE_DASHBOARD_ROUTES[canonicalizeRole(role)] || '/'

export const getLoginRouteForRole = (role) =>
  ROLE_LOGIN_ROUTES[canonicalizeRole(role)] || '/student/login'
