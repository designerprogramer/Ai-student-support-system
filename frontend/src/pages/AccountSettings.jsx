import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import DashboardHeader from '../components/DashboardHeader'
import api from '../lib/api'
import { getAuthSession, getDashboardRouteForRole, updateAuthSessionUser } from '../lib/auth'

function displayName(user, profile) {
  return (
    profile?.full_name ||
    user?.full_name ||
    user?.first_name ||
    user?.username ||
    ''
  )
}

export default function AccountSettings() {
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState(null)
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [profileImage, setProfileImage] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const session = getAuthSession()
    if (!session?.user?.id) {
      navigate('/login', { replace: true })
      return
    }

    setUser(session.user)
    setFormData({
      full_name: displayName(session.user, null),
      email: session.user.email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
    setProfileImagePreview(session.user.profile_image_url || '')

    const loadProfile = async () => {
      try {
        const response = await api.get('/profiles/')
        const rows = Array.isArray(response.data) ? response.data : response.data?.results || []
        const profile = rows.find((row) => Number(row.user?.id || row.user) === Number(session.user.id))
        if (!profile) return
        setProfileId(profile.id)
        setFormData({
          full_name: displayName(session.user, profile),
          email: session.user.email || '',
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
        setProfileImagePreview(profile.profile_image_url || session.user.profile_image_url || '')
      } catch (requestError) {
        console.error(requestError)
      }
    }

    loadProfile()
  }, [navigate])

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile picture must be 2MB or smaller.')
      return
    }
    setError('')
    setProfileImage(file)
    setProfileImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const fullName = formData.full_name.trim()
    const email = formData.email.trim()
    const wantsPasswordChange =
      formData.current_password || formData.new_password || formData.confirm_password
    if (!fullName || !email) {
      setError('Full name and email are required.')
      setSaving(false)
      return
    }

    try {
      const profilePayload = new FormData()
      profilePayload.append('full_name', fullName)
      if (profileImage) profilePayload.append('profile_image', profileImage)

      let savedProfile = null
      if (profileId) {
        const response = await api.patch(`/profiles/${profileId}/`, profilePayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        savedProfile = response.data
      } else {
        profilePayload.append('user', user.id)
        const response = await api.post('/profiles/', profilePayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        savedProfile = response.data
        setProfileId(response.data.id)
      }

      await api.patch('/auth/me/email/', { email })
      if (wantsPasswordChange) {
        await api.post('/auth/me/password/', {
          current_password: formData.current_password,
          new_password: formData.new_password,
          confirm_password: formData.confirm_password
        })
      }
      updateAuthSessionUser({
        first_name: fullName,
        full_name: fullName,
        name: fullName,
        email,
        profile_image_url: savedProfile?.profile_image_url || profileImagePreview
      })

      navigate(getDashboardRouteForRole(getAuthSession()?.role), { replace: true })
    } catch (requestError) {
      const payload = requestError?.response?.data || {}
      const firstError =
        payload.email ||
        payload.current_password ||
        payload.confirm_password ||
        payload.new_password ||
        payload.detail
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const initial = (formData.full_name?.[0] || user?.username?.[0] || 'U').toUpperCase()

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Account"
        title="Profile Settings"
        description="Update your name, registered email, and profile picture."
      />

      <form className="rounded-2xl border border-gray-100 bg-white p-7" onSubmit={handleSubmit}>
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {profileImagePreview ? (
              <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#2B85B7]">
                {initial}
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              <Camera size={17} />
              Set picture
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            <p className="mt-2 text-xs text-gray-500">JPG or PNG, maximum 2MB.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-600">Full name</label>
            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
              value={formData.full_name}
              onChange={(event) => setFormData((current) => ({ ...current, full_name: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-600">Registered email</label>
            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-7">
          <h3 className="text-lg font-semibold text-gray-900">Change password</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">Current password</label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                type="password"
                value={formData.current_password}
                onChange={(event) => setFormData((current) => ({ ...current, current_password: event.target.value }))}
                placeholder="Current password"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">New password</label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                type="password"
                value={formData.new_password}
                onChange={(event) => setFormData((current) => ({ ...current, new_password: event.target.value }))}
                placeholder="New password"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">Confirm new password</label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                type="password"
                value={formData.confirm_password}
                onChange={(event) => setFormData((current) => ({ ...current, confirm_password: event.target.value }))}
                placeholder="Confirm password"
              />
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-[#2B85B7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Updating...' : 'Update Profile'}
          </button>
          <Link
            to={getDashboardRouteForRole(getAuthSession()?.role)}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
