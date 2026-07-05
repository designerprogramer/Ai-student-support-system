import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { setAuthToken } from '../lib/api'
import { getAuthSession, getDashboardRouteForRole, saveAuthSession } from '../lib/auth'
import logo from '../assets/image.png'

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getErrorMessage(error) {
  if (error?.response?.data?.detail) return error.response.data.detail
  const serializerErrors = error?.response?.data?.non_field_errors
  if (Array.isArray(serializerErrors) && serializerErrors.length > 0) return serializerErrors[0]
  return 'Login failed. Please check your credentials and try again.'
}

export default function SecureRoleLogin({ role, title, description }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeSession = getAuthSession()

  useEffect(() => {
    if (activeSession?.access) {
      navigate(getDashboardRouteForRole(activeSession.role), { replace: true })
    }
  }, [activeSession?.access, activeSession?.role, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await api.post(`/auth/login/${role}/`, {
        username: username.trim(),
        password
      })

      if (response.data?.otp_required) {
        setChallenge(response.data)
        setPassword('')
        setMode('otp')
        setMessage(`OTP sent to ${response.data.email_hint || 'the registered email'}.`)
        return
      }

      const session = saveAuthSession(response.data)
      setAuthToken(session.access)
      navigate(response.data?.dashboard_route || getDashboardRouteForRole(session.role), { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const response = await api.post('/auth/login/verify-otp/', {
        challenge_id: challenge?.challenge_id,
        otp
      })
      const session = saveAuthSession(response.data)
      setAuthToken(session.access)
      navigate(response.data?.dashboard_route || getDashboardRouteForRole(session.role), { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetRequest = async () => {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await api.post('/auth/password-reset/request/', { email: resetEmail.trim() })
      setMessage('If the account exists, a password reset OTP was sent to the registered email.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetConfirm = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      await api.post('/auth/password-reset/confirm/', {
        email: resetEmail.trim(),
        otp: resetOtp,
        new_password: newPassword
      })
      setMode('login')
      setResetOtp('')
      setNewPassword('')
      setMessage('Password reset successful. Login with your new password.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50 px-4 py-4 sm:px-6">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,129,84,0.07),rgba(255,255,255,0)_34%)]" />

      <header className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 active:border-emerald-700 active:bg-emerald-100"
        >
          <ArrowLeftIcon />
          Back to home
        </Link>
        <img
          src={logo}
          alt="Hormuud University Logo"
          className="mx-auto h-auto w-full max-w-[300px] object-contain sm:max-w-[390px]"
        />
        <div className="hidden w-[137px] sm:block" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl justify-center pt-8 sm:pt-10">
        <div className="w-full animate-fade-in-up">
          <div className="mb-4 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Secure Login</p>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
          </div>

          {mode === 'otp' ? (
            <form className="space-y-3 text-left" onSubmit={handleOtpSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Email OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
                  placeholder="Enter 6 digit code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">The code expires, works once, and failed attempts are limited.</p>
              </div>
              {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full rounded-2xl bg-emerald-700 py-3.5 text-white font-medium btn-animate active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setChallenge(null)
                  setOtp('')
                  setError('')
                }}
                className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Back to login
              </button>
            </form>
          ) : mode === 'forgot' ? (
            <form className="space-y-3 text-left" onSubmit={handleResetConfirm}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Registered email</label>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  required
                />
              </div>
              <button
                type="button"
                onClick={handleResetRequest}
                disabled={isSubmitting || !resetEmail.trim()}
                className="w-full rounded-2xl border border-emerald-200 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
              >
                Send reset OTP
              </button>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Reset OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
                  value={resetOtp}
                  onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">New password</label>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting || resetOtp.length !== 6 || !newPassword}
                className="w-full rounded-2xl bg-emerald-700 py-3.5 text-white font-medium btn-animate active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Resetting...' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError('')
                  setMessage('')
                }}
                className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Back to login
              </button>
            </form>
          ) : (
            <form className="space-y-3 text-left" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
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
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white active:border-emerald-500"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-emerald-700 py-3.5 text-white font-medium btn-animate active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError('')
                  setMessage('')
                }}
                className="w-full text-center text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition"
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
