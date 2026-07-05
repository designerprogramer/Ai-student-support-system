import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import api, { setAuthToken } from '../lib/api'
import {
  canonicalizeRole,
  getAuthSession,
  getDashboardRouteForRole,
  saveAuthSession
} from '../lib/auth'
import logo from '../assets/image.png'

const STAFF_ROLE_OPTIONS = [
  { value: 'support_officer', label: 'Support Officer', endpoint: 'support' },
  { value: 'affairs', label: 'Affairs', endpoint: 'affairs' },
  { value: 'admin', label: 'Admin', endpoint: 'admin' }
]

const STAFF_ROLES = new Set(STAFF_ROLE_OPTIONS.map((option) => option.value))
function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function getRoleErrorMessage(error) {
  if (error?.response?.data?.detail) {
    return error.response.data.detail
  }

  const serializerErrors = error?.response?.data?.non_field_errors
  if (Array.isArray(serializerErrors) && serializerErrors.length > 0) {
    return serializerErrors[0]
  }

  return 'Login failed. Please check your credentials and try again.'
}

export default function StaffLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleFromUrl = canonicalizeRole(searchParams.get('role') || 'support_officer')
  const initialRole = STAFF_ROLES.has(roleFromUrl) ? roleFromUrl : 'support_officer'

  const [role, setRole] = useState(initialRole)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeSession = getAuthSession()

  useEffect(() => {
    if (activeSession?.access) {
      navigate(getDashboardRouteForRole(activeSession.role), { replace: true })
    }
  }, [activeSession?.access, activeSession?.role, navigate])

  const selectedRole = useMemo(
    () => STAFF_ROLE_OPTIONS.find((option) => option.value === role) || STAFF_ROLE_OPTIONS[0],
    [role]
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await api.post(`/auth/login/${selectedRole.endpoint}/`, {
        username: username.trim(),
        password
      })

      const session = saveAuthSession(response.data)
      setAuthToken(session.access)
      navigate(response.data?.dashboard_route || getDashboardRouteForRole(session.role), { replace: true })
    } catch (requestError) {
      setError(getRoleErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gray-50 px-6 py-6 overflow-hidden flex flex-col justify-between">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(59,113,202,0.08),transparent_50%)] pointer-events-none animate-pulse-glow" />

      <header className="relative z-10">
        <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white transition shadow-sm border border-gray-100">
          <ArrowLeftIcon />
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-xl text-center animate-fade-in-up">
          
          {/* University Logo and Header */}
          <div className="text-center mb-8">
            <img 
              src={logo} 
              alt="Hormuud University Logo" 
              className="mx-auto max-h-24 w-auto object-contain mb-6" 
            />
            <h1 className="text-3xl md:text-4xl font-semibold text-green-800 tracking-tight">Welcome back!</h1>
            <p className="mt-2 text-gray-500">
              Login to access your dashboard and manage complaints. 
            </p>
          </div>

          <form className="mt-10 space-y-6 text-left" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                autoComplete="username"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-400"
                placeholder="Enter your username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-400"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#3b71ca] py-3 text-sm font-semibold text-white btn-animate-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer spacer */}
      <footer className="h-6" />
    </div>
  )
}
