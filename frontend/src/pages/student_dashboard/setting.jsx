import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import DashboardHeader from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession, updateAuthSessionUser } from '../../lib/auth'

export default function Settings() {
  const navigate = useNavigate()

  const [profileId, setProfileId] = useState(null)
  const [sessionUser, setSessionUser] = useState(null)
  const [profileImage, setProfileImage] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState('')

  const [formData, setFormData] = useState({
    student_id: '',
    first_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const getUserId = (userValue) => {
    if (!userValue) return null

    if (typeof userValue === 'object') {
      return userValue.id
    }

    return userValue
  }

  const looksLikeStudentId = (value, studentId) => {
    const text = String(value || '').trim()
    const idText = String(studentId || '').trim()

    if (!text) return true
    if (idText && text === idText) return true

    // If value is only numbers, treat it as ID, not name
    if (/^\d+$/.test(text)) return true

    // If value looks like student number/code, treat it as ID
    if (/^[A-Z0-9-_]+$/i.test(text) && /\d/.test(text) && text.length >= 4) {
      return true
    }

    return false
  }

  const getCleanName = (user, profile, studentId) => {
    const possibleNames = [
      user?.first_name,
      user?.full_name,
      user?.name,
      profile?.full_name,
      profile?.first_name
    ]

    const cleanName = possibleNames.find((name) => {
      const text = String(name || '').trim()
      return text && !looksLikeStudentId(text, studentId)
    })

    return cleanName || ''
  }

  useEffect(() => {
    const session = getAuthSession()

    if (!session?.user?.id) {
      navigate('/login')
      return
    }

    setSessionUser(session.user)

    const fallbackStudentId = String(
      session.user.student_number ||
      session.user.student_id ||
      session.user.username ||
      ''
    ).trim()

    setFormData({
      student_id: fallbackStudentId,
      first_name: getCleanName(session.user, null, fallbackStudentId),
      email: session.user.email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
    setProfileImagePreview(session.user.profile_image_url || '')

    const fetchProfile = async () => {
      try {
        const response = await api.get('/profiles/')
        const profileRows = Array.isArray(response.data)
          ? response.data
          : response.data?.results || []

        const profile = profileRows.find((row) => {
          const rowUserId = getUserId(row.user)
          return Number(rowUserId) === Number(session.user.id)
        })

        if (!profile) return

        const profileStudentId = String(
          profile.student_number ||
          fallbackStudentId ||
          ''
        ).trim()

        const profileName = getCleanName(session.user, profile, profileStudentId)

        setProfileId(profile.id)

        setFormData({
          student_id: profileStudentId,
          first_name: profileName,
          email: session.user.email || '',
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
        setProfileImagePreview(profile.profile_image_url || session.user.profile_image_url || '')
      } catch (fetchError) {
        console.error('Error fetching profile:', fetchError)
      }
    }

    fetchProfile()
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

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
    setError('')
    setIsSubmitting(true)

    const firstName = formData.first_name.trim()
    const studentId = formData.student_id.trim()
    const email = formData.email.trim()
    const wantsPasswordChange =
      formData.current_password || formData.new_password || formData.confirm_password

    if (!firstName) {
      setError('First name is required.')
      setIsSubmitting(false)
      return
    }

    if (!email) {
      setError('Email is required for OTP login and password reset.')
      setIsSubmitting(false)
      return
    }

    if (looksLikeStudentId(firstName, studentId)) {
      setError('First name cannot be the same as Student ID.')
      setIsSubmitting(false)
      return
    }

    try {
      const profilePayload = new FormData()
      profilePayload.append('full_name', firstName)
      profilePayload.append('student_number', studentId)
      if (profileImage) {
        profilePayload.append('profile_image', profileImage)
      }

      let savedProfile = null
      if (profileId) {
        const response = await api.patch(`/profiles/${profileId}/`, profilePayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        savedProfile = response.data
      } else {
        profilePayload.append('user', sessionUser.id)
        const response = await api.post('/profiles/', profilePayload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (response?.data?.id) {
          setProfileId(response.data.id)
        }
        savedProfile = response.data
      }

      await api.patch('/auth/me/email/', { email })

      if (wantsPasswordChange) {
        await api.post('/auth/me/password/', {
          current_password: formData.current_password,
          new_password: formData.new_password,
          confirm_password: formData.confirm_password
        })
      }
      const savedImageUrl = savedProfile?.profile_image_url || profileImagePreview

      updateAuthSessionUser({
        first_name: firstName,
        full_name: firstName,
        name: firstName,
        student_number: studentId,
        email,
        profile_image_url: savedImageUrl
      })

      navigate('/student/dashboard')
    } catch (submitError) {
      const payload = submitError?.response?.data || {}
      const firstError =
        payload.email ||
        payload.current_password ||
        payload.confirm_password ||
        payload.new_password ||
        payload.detail
      setError(Array.isArray(firstError) ? firstError[0] : firstError || 'Failed to update profile. Please try again.')
      console.error('Error updating profile:', submitError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Settings"
        title="Profile Settings"
        description="Update your display name and registered email. Your email is used for OTP login and password reset."
      />

      <form
        className="rounded-2xl border border-gray-100 bg-white p-7"
        onSubmit={handleSubmit}
      >
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#2B85B7]">
                {(formData.first_name?.[0] || 'S').toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              <Camera size={17} />
              Set picture
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">JPG or PNG, maximum 2MB.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-600">
              Student ID
            </label>

            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500 outline-none"
              name="student_id"
              value={formData.student_id}
              disabled
              placeholder="Your student ID"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-600">
              First name
            </label>

            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="Enter your first name"
              required
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-600">
              Registered email
            </label>

            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-7">
          <h3 className="text-lg font-semibold text-gray-900">Change password</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">
                Current password
              </label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                name="current_password"
                type="password"
                value={formData.current_password}
                onChange={handleChange}
                placeholder="Current password"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">
                New password
              </label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                name="new_password"
                type="password"
                value={formData.new_password}
                onChange={handleChange}
                placeholder="New password"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-600">
                Confirm new password
              </label>
              <input
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
                name="confirm_password"
                type="password"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Confirm password"
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-[#2B85B7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Profile'}
          </button>

          <Link
            to="/student/dashboard"
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
