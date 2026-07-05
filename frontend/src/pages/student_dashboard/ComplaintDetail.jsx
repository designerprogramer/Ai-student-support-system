import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  FileText,
  MessageSquareText,
  Star,
  UserRound,
  XCircle
} from 'lucide-react'

import StatusPill from '../../components/StatusPill'
import PriorityBadge from '../../components/PriorityBadge'
import DashboardHeader from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession } from '../../lib/auth'

function getTextValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return value.name || value.title || value.label || String(value.id || '')
  }
  return String(value)
}

function getComplaintStatus(item) {
  return getTextValue(item?.effective_status || item?.status)
}

function isResolvedStatus(status) {
  return ['resolved', 'closed'].includes(String(status || '').trim().toLowerCase())
}

function isClosedStatus(status) {
  return String(status || '').trim().toLowerCase() === 'closed'
}

function looksLikeStudentId(value, studentId) {
  const text = getTextValue(value).trim()
  const idText = getTextValue(studentId).trim()

  if (!text) return true
  if (idText && text === idText) return true
  if (/^\d+$/.test(text)) return true
  return /^[A-Z0-9-_]+$/i.test(text) && /\d/.test(text) && text.length >= 4
}

function getStudentNumber(complaint) {
  const sessionUser = getAuthSession()?.user || {}
  const sessionStudentNumber = getTextValue(
    sessionUser.student_number ||
    sessionUser.student_id ||
    sessionUser.username
  )

  return getTextValue(complaint?.student_number) || sessionStudentNumber || 'N/A'
}

function getStudentName(complaint) {
  const sessionUser = getAuthSession()?.user || {}
  const studentNumber = getStudentNumber(complaint)
  const sessionName = getTextValue(
    sessionUser.full_name ||
    sessionUser.first_name ||
    sessionUser.name
  )
  const complaintName = getTextValue(complaint?.student_name)

  if (complaintName && !looksLikeStudentId(complaintName, studentNumber)) {
    return complaintName
  }
  if (sessionName && !looksLikeStudentId(sessionName, studentNumber)) {
    return sessionName
  }

  return ''
}

function formatComplaintId(item) {
  if (item?.complaint_code) return item.complaint_code
  if (item?.code) return item.code
  if (item?.id === null || item?.id === undefined) return 'N/A'

  const year = item.created_at
    ? new Date(item.created_at).getFullYear()
    : new Date().getFullYear()

  return `CMP-${year}-${String(item.id).padStart(6, '0')}`
}

function formatDateTime(date) {
  if (!date) return 'N/A'

  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function DetailCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon size={15} className="text-[#2B85B7]" />
        {label}
      </div>
      <div className="mt-3 text-base font-semibold text-gray-800">{value || 'N/A'}</div>
    </div>
  )
}

function ActivityTimeline({ items }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2B85B7]">
              <CircleDot size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{item.time}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.note}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function getEscalationActivity(complaint) {
  if (getComplaintStatus(complaint).toLowerCase() !== 'escalated') return null

  if (complaint.effective_status_reason === 'sent_to_admin') {
    return {
      title: 'Escalated for further review',
      time: formatDateTime(complaint.updated_at || complaint.created_at),
      note: 'This complaint was escalated for additional review.'
    }
  }

  if (complaint.effective_status_reason === 'overdue') {
    return {
      title: 'Escalated because overdue',
      time: formatDateTime(complaint.updated_at || complaint.created_at),
      note: 'This complaint passed its response time, so it was escalated automatically.'
    }
  }

  return {
    title: 'Complaint escalated',
    time: formatDateTime(complaint.updated_at || complaint.created_at),
    note: 'This complaint has been escalated for additional review.'
  }
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [resolutionSaving, setResolutionSaving] = useState('')
  const [resolutionMessage, setResolutionMessage] = useState('')
  const [resolutionError, setResolutionError] = useState('')

  useEffect(() => {
    const fetchComplaint = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await api.get(`/complaints/${id}/`)
        setComplaint(response.data)
        setRating(Number(response.data?.feedback_rating || 0))
        setFeedbackComment(response.data?.feedback_comment || '')
      } catch (err) {
        console.error('Error fetching complaint:', err)
        setError('Complaint could not be loaded.')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchComplaint()
  }, [id])

  useEffect(() => {
    if (!feedbackMessage && !feedbackError && !resolutionMessage && !resolutionError) return undefined
    const timeout = setTimeout(() => {
      setFeedbackMessage('')
      setFeedbackError('')
      setResolutionMessage('')
      setResolutionError('')
    }, 4000)
    return () => clearTimeout(timeout)
  }, [feedbackMessage, feedbackError, resolutionMessage, resolutionError])

  const handleConfirmResolution = async () => {
    if (!complaint) return

    setResolutionSaving('confirm')
    setResolutionMessage('')
    setResolutionError('')
    try {
      const response = await api.post(`/complaints/${complaint.id}/confirm_resolution/`, {
        note: 'Student confirmed the complaint is solved.'
      })
      setComplaint(response.data)
      setResolutionMessage('Thank you. This complaint has been closed.')
    } catch (requestError) {
      setResolutionError(requestError?.response?.data?.detail || 'Could not confirm this complaint.')
    } finally {
      setResolutionSaving('')
    }
  }

  const handleReopenComplaint = async () => {
    if (!complaint || !reopenReason.trim()) {
      setResolutionError('Please explain why the problem is not solved.')
      return
    }

    setResolutionSaving('reopen')
    setResolutionMessage('')
    setResolutionError('')
    try {
      const response = await api.post(`/complaints/${complaint.id}/reopen/`, {
        reason: reopenReason
      })
      setComplaint(response.data)
      setReopenReason('')
      setResolutionMessage('Your complaint has been reopened for review.')
    } catch (requestError) {
      setResolutionError(
        requestError?.response?.data?.reason ||
        requestError?.response?.data?.detail ||
        'Could not reopen this complaint.'
      )
    } finally {
      setResolutionSaving('')
    }
  }

  const handleFeedbackSubmit = async () => {
    if (!complaint || !rating) {
      setFeedbackError('Please choose a star rating before submitting.')
      return
    }

    setFeedbackSaving(true)
    setFeedbackMessage('')
    setFeedbackError('')
    try {
      const response = await api.post(`/complaints/${complaint.id}/feedback/`, {
        rating,
        comment: feedbackComment
      })
      setComplaint((current) => ({
        ...current,
        feedback_rating: response.data.rating,
        feedback_comment: response.data.comment,
        feedback_created_at: response.data.created_at,
        feedback_updated_at: response.data.updated_at
      }))
      setFeedbackMessage('Thank you. Your feedback has been submitted.')
    } catch (requestError) {
      setFeedbackError(requestError?.response?.data?.detail || 'Could not submit feedback.')
    } finally {
      setFeedbackSaving(false)
    }
  }

  const timelineItems = useMemo(() => {
    if (!complaint) return []

    const items = [
      {
        title: 'Complaint submitted',
        time: formatDateTime(complaint.created_at),
        note: 'Your complaint was received by the support system.'
      }
    ]

    if (complaint.updated_at && complaint.updated_at !== complaint.created_at) {
      items.push({
        title: `Status: ${getComplaintStatus(complaint) || 'Updated'}`,
        time: formatDateTime(complaint.updated_at),
        note: 'The complaint record has been updated.'
      })
    }

    const escalationActivity = getEscalationActivity(complaint)
    if (escalationActivity) {
      items.push(escalationActivity)
    }

    if (complaint.resolved_at) {
      items.push({
        title: 'Complaint resolved',
        time: formatDateTime(complaint.resolved_at),
        note: 'This complaint has been marked as resolved.'
      })
    }

    return items
  }, [complaint])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-7">
          <div className="h-4 w-28 rounded bg-gray-100" />
          <div className="mt-4 h-8 w-72 rounded bg-gray-100" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="h-80 rounded-2xl bg-gray-100" />
          <div className="h-80 rounded-2xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (error || !complaint) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center md:px-7">
        <h2 className="text-xl font-semibold text-gray-800">{error || 'Complaint not found.'}</h2>
        <button
          onClick={() => navigate('/student/complaints')}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2B85B7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2376A4]"
        >
          <ArrowLeft size={16} />
          Back to complaints
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/student/complaints"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#2B85B7]"
      >
        <ArrowLeft size={16} />
        Back to complaints
      </Link>
      <DashboardHeader
        eyebrow="Complaint Details"
        title={formatComplaintId(complaint)}
        description={complaint.title || 'Untitled Complaint'}
        actions={
          <>
            <StatusPill status={getComplaintStatus(complaint)} />
            <PriorityBadge priority={getTextValue(complaint.priority)} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="text-xl font-bold text-gray-800">Issue summary</h3>
          <p className="mt-4 whitespace-pre-line rounded-2xl bg-gray-50 p-5 text-sm leading-7 text-gray-600">
            {complaint.description || 'No description provided.'}
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <DetailCard icon={UserRound} label="Student ID" value={getStudentNumber(complaint)} />
            {getStudentName(complaint) ? (
              <DetailCard icon={UserRound} label="Student name" value={getStudentName(complaint)} />
            ) : null}
            <DetailCard icon={FileText} label="Category" value={getTextValue(complaint.category)} />
            <DetailCard icon={MessageSquareText} label="Source" value={getTextValue(complaint.source)} />
            <DetailCard icon={CalendarDays} label="Submitted" value={formatDateTime(complaint.created_at)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Tracking</p>
          <h3 className="mt-2 text-xl font-bold text-gray-800">Latest activity</h3>
          <div className="mt-6">
            <ActivityTimeline items={timelineItems} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-xl font-bold text-gray-800">Analysis details</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <DetailCard icon={FileText} label="Detected language" value={complaint.detected_language} />
          <DetailCard icon={MessageSquareText} label="Sentiment" value={complaint.sentiment} />
          <DetailCard icon={CalendarDays} label="Last updated" value={formatDateTime(complaint.updated_at)} />
        </div>
      </div>

      {isResolvedStatus(getComplaintStatus(complaint)) ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2B85B7]">Close Confirmation</p>
              <h3 className="mt-2 text-xl font-bold text-gray-800">Is the problem solved?</h3>
              <p className="mt-1 text-sm text-gray-500">
                Confirm the solution or reopen the complaint if the issue still exists.
              </p>
            </div>
            {isClosedStatus(getComplaintStatus(complaint)) ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                Confirmed solved
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleConfirmResolution}
              disabled={resolutionSaving !== '' || isClosedStatus(getComplaintStatus(complaint))}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 size={17} />
              {resolutionSaving === 'confirm' ? 'Closing...' : 'Yes, solved'}
            </button>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              If not solved, explain what is still wrong
            </label>
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-gray-200 p-4 text-sm leading-7 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="Example: The payment is still not updated, or I still cannot access the portal."
            />
            <button
              onClick={handleReopenComplaint}
              disabled={resolutionSaving !== '' || !reopenReason.trim()}
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={17} />
              {resolutionSaving === 'reopen' ? 'Reopening...' : 'No, reopen'}
            </button>
          </div>

          {resolutionError ? <p className="mt-3 text-sm font-medium text-red-600">{resolutionError}</p> : null}
          {resolutionMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{resolutionMessage}</p> : null}
        </div>
      ) : null}

      {isResolvedStatus(getComplaintStatus(complaint)) ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2B85B7]">Student Feedback</p>
              <h3 className="mt-2 text-xl font-bold text-gray-800">Rate this complaint handling</h3>
              <p className="mt-1 text-sm text-gray-500">
                Share how happy you are with the solution and add a suggestion if needed.
              </p>
            </div>
            {complaint.feedback_rating ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                Feedback sent
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => {
              const active = value <= (hoverRating || rating)
              return (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    setRating(value)
                    setFeedbackError('')
                  }}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${
                    active
                      ? 'border-amber-300 bg-amber-50 text-amber-500'
                      : 'border-gray-200 bg-white text-gray-300 hover:bg-gray-50'
                  }`}
                  aria-label={`Rate ${value} stars`}
                >
                  <Star size={22} fill={active ? 'currentColor' : 'none'} />
                </button>
              )
            })}
          </div>

          <textarea
            value={feedbackComment}
            onChange={(event) => setFeedbackComment(event.target.value)}
            className="mt-5 min-h-28 w-full rounded-xl border border-gray-200 p-4 text-sm leading-7 outline-none transition focus:border-[#2B85B7] focus:ring-2 focus:ring-[#2B85B7]/10"
            placeholder="Write a suggestion or tell us what could be improved."
          />

          {feedbackError ? <p className="mt-3 text-sm font-medium text-red-600">{feedbackError}</p> : null}
          {feedbackMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{feedbackMessage}</p> : null}

          <button
            onClick={handleFeedbackSubmit}
            disabled={feedbackSaving || !rating}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#2B85B7] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-50"
          >
            {feedbackSaving ? 'Submitting...' : complaint.feedback_rating ? 'Update feedback' : 'Submit feedback'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
