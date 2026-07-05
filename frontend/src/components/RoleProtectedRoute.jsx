import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  getAuthSession,
  getCurrentRole,
  getDashboardRouteForRole,
  getLoginRouteForRole,
  isAllowedRole
} from '../lib/auth'
import { refreshAuthToken } from '../lib/api'

export default function RoleProtectedRoute({ allowedRoles, children }) {
  const [checkingRefresh, setCheckingRefresh] = useState(false)
  const session = getAuthSession()
  const currentRole = getCurrentRole()

  useEffect(() => {
    if (session?.accessExpired && !session?.refreshExpired) {
      setCheckingRefresh(true)
      refreshAuthToken().finally(() => setCheckingRefresh(false))
    }
  }, [session?.accessExpired, session?.refreshExpired])

  if (!session) {
    return <Navigate to={getLoginRouteForRole(allowedRoles?.[0])} replace />
  }

  if (checkingRefresh || (session.accessExpired && !session.refreshExpired)) {
    return <div className="p-6 text-sm text-gray-500">Restoring session...</div>
  }

  if (session.accessExpired && session.refreshExpired) {
    return <Navigate to={getLoginRouteForRole(allowedRoles?.[0])} replace />
  }

  if (!isAllowedRole(currentRole, allowedRoles)) {
    return <Navigate to={getDashboardRouteForRole(currentRole)} replace />
  }

  return children
}
