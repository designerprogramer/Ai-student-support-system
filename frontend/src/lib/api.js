import axios from 'axios'
import { clearAuthSession, getAuthSession, persistAuthSession } from './auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
})

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

let refreshPromise = null

export const refreshAuthToken = async () => {
  const session = getAuthSession()
  if (!session) {
    setAuthToken(null)
    return null
  }

  if (!session.accessExpired) {
    setAuthToken(session.access)
    return session.access
  }

  if (!session.refresh || session.refreshExpired) {
    clearAuthSession()
    setAuthToken(null)
    return null
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh: session.refresh })
      .then((response) => {
        const nextSession = persistAuthSession({
          ...session,
          access: response.data.access,
          refresh: response.data.refresh || session.refresh
        })
        setAuthToken(nextSession.access)
        return nextSession.access
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {}
    const statusCode = error?.response?.status
    const payload = error?.response?.data || {}
    const detailMessage = `${payload?.detail || ''}`.toLowerCase()
    const tokenErrorCode = payload?.code

    const hasInvalidTokenError =
      statusCode === 401 &&
      (tokenErrorCode === 'token_not_valid' ||
        detailMessage.includes('token not valid') ||
        detailMessage.includes('given token'))

    if (hasInvalidTokenError) {
      if (!originalRequest._retry) {
        originalRequest._retry = true
        const nextAccess = await refreshAuthToken()
        if (nextAccess) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${nextAccess}`
          }
          return api(originalRequest)
        }
      }
      clearAuthSession()
      setAuthToken(null)
    }

    return Promise.reject(error)
  }
)

export default api
