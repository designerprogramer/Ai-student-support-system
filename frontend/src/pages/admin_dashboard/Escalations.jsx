import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquareReply, ShieldAlert } from 'lucide-react'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import {
  NOTE_MARKERS,
  addComplaintNote,
  fetchComplaints,
  fetchNotes,
  formatDaysRemaining,
  getComplaintCode,
  getDaysRemaining,
  hasNoteMarker,
  isAdminVisibleComplaint,
  isComplaintOverdue,
  latestMarkedNote,
  normalizeKey,
  setComplaintStatusByName
} from '../../lib/complaintWorkflow'

const priorityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
}

export default function AdminEscalations() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const [complaintData, noteData] = await Promise.all([fetchComplaints(), fetchNotes()])
      setComplaints(complaintData)
      setNotes(noteData)
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(false), 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!message) return undefined
    const timeout = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timeout)
  }, [message])

  const escalations = useMemo(() => {
    return complaints
      .filter((complaint) => {
        const sentByAffairs = isAdminVisibleComplaint(notes, complaint)
        const answered = hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse)
        return sentByAffairs && !answered && isComplaintOverdue(complaint)
      })
      .sort((a, b) => {
        const rankDiff = (priorityRank[normalizeKey(a.priority)] ?? 9) - (priorityRank[normalizeKey(b.priority)] ?? 9)
        if (rankDiff !== 0) return rankDiff
        return getDaysRemaining(a) - getDaysRemaining(b)
      })
  }, [complaints, notes])

  useEffect(() => {
    setSelectedId((current) => current || escalations[0]?.id || null)
  }, [escalations])

  const selectedComplaint = escalations.find((item) => Number(item.id) === Number(selectedId))
  const adminRequest = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.adminRequest)
    : null
  const investigation = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.investigation)
    : null

  const handleAdminResponse = async () => {
    if (!selectedComplaint || !responseText.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await addComplaintNote(selectedComplaint.id, NOTE_MARKERS.adminResponse, responseText, 'response')
      await setComplaintStatusByName(selectedComplaint.id, 'Resolved', 'Admin response submitted.')
      setResponseText('')
      setMessage('Admin response saved and complaint marked resolved.')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading escalations...</div>
  }

  return (
    <div className="space-y-7">
      <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-red-950 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
              Escalated priority
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              <ShieldAlert className="text-red-600" size={32} />
              Admin escalation queue
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-red-800">
              {`${escalations.length} active escalation${escalations.length === 1 ? '' : 's'} needs administrator review. High priority complaints must be answered within 2 days, medium within 5 days, and low within 1 week.`}
            </p>
          </div>
          <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Active</p>
            <p className="mt-1 text-3xl font-bold text-red-700">{escalations.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ShieldAlert size={18} />
            Must solve first
          </div>
          <div className="mt-4 space-y-3">
            {escalations.map((complaint) => (
              <button
                key={complaint.id}
                onClick={() => setSelectedId(complaint.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  Number(selectedId) === Number(complaint.id)
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-100 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</span>
                  <span className="text-xs font-semibold text-red-700">{formatDaysRemaining(complaint)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{complaint.title || complaint.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PriorityBadge priority={complaint.priority} />
                  <StatusPill status={complaint.status} />
                </div>
              </button>
            ))}
            {escalations.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                No active escalations. Admin responses are up to date.
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {selectedComplaint ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Admin action</p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">{getComplaintCode(selectedComplaint)}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={selectedComplaint.priority} />
                  <StatusPill status={selectedComplaint.status} />
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-gray-600">{selectedComplaint.description}</p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Affairs request</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{adminRequest?.note || 'Sent by Affairs.'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Investigation result</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{investigation?.note || 'No investigation note found.'}</p>
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Admin reflection / answer</label>
                <textarea
                  value={responseText}
                  onChange={(event) => setResponseText(event.target.value)}
                  className="min-h-40 w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-red-400"
                  placeholder="Write the admin decision, answer, or corrective action."
                />
              </div>

              {message ? <p className="mt-3 text-sm font-medium text-green-700">{message}</p> : null}

              <button
                onClick={handleAdminResponse}
                disabled={saving || !responseText.trim()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <CheckCircle2 size={17} /> : <MessageSquareReply size={17} />}
                {saving ? 'Saving...' : 'Send admin response'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Select an escalation to answer.</p>
          )}
        </div>
      </div>
    </div>
  )
}
