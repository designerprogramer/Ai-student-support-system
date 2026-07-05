import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, RefreshCw, Send, XCircle } from 'lucide-react'
import DashboardHeader from '../../components/DashboardHeader'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import {
  NOTE_MARKERS,
  addComplaintNote,
  fetchComplaints,
  fetchNotes,
  getComplaintCode,
  formatDaysRemaining,
  getSlaLabel,
  hasNoteMarker,
  isComplaintOverdue,
  latestMarkedNote,
  transferComplaint
} from '../../lib/complaintWorkflow'

function cleanWorkflowNote(note = '') {
  return String(note || '')
    .replace(NOTE_MARKERS.investigation, '')
    .replace(NOTE_MARKERS.affairsReview, '')
    .replace(NOTE_MARKERS.adminRequest, '')
    .replace(NOTE_MARKERS.adminResponse, '')
    .replace('TRUE.', '')
    .replace('NEEDS MORE INVESTIGATION.', '')
    .trim()
}

export default function AffairsComplaintReview() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [reviewText, setReviewText] = useState('')
  const [sentAdminIds, setSentAdminIds] = useState(new Set())
  const [approvedIds, setApprovedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const [complaintData, noteData] = await Promise.all([fetchComplaints(), fetchNotes()])
      setComplaints(complaintData)
      setNotes(noteData)
      setSelectedId((current) => current || complaintData[0]?.id || null)
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

  const selectedComplaint = complaints.find((item) => Number(item.id) === Number(selectedId))
  const getComplaintStatus = (complaint) => complaint?.effective_status || complaint?.status
  const investigatedComplaints = useMemo(
    () => complaints.filter((item) => hasNoteMarker(notes, item.id, NOTE_MARKERS.investigation)),
    [complaints, notes]
  )
  const sentToAdminCount = useMemo(
    () => complaints.filter((item) => hasNoteMarker(notes, item.id, NOTE_MARKERS.adminRequest)).length,
    [complaints, notes]
  )
  const overdueCount = useMemo(() => complaints.filter(isComplaintOverdue).length, [complaints])

  const handleReview = async (isValid) => {
    if (!selectedComplaint) return
    if (sentToAdmin) return

    const alreadyApproved =
      isValid &&
      (isTrueReview || approvedIds.has(Number(selectedComplaint.id)))

    if (alreadyApproved) return

    setSavingAction(isValid ? 'valid' : 'invalid')
    setMessage('')
    try {
      const verdict = isValid ? 'TRUE' : 'NEEDS MORE INVESTIGATION'
      await addComplaintNote(
        selectedComplaint.id,
        NOTE_MARKERS.affairsReview,
        `${verdict}. ${reviewText || 'Reviewed by Affairs.'}`,
        'internal'
      )
      if (isValid) {
        setApprovedIds((current) => new Set([...current, Number(selectedComplaint.id)]))
      }
      setReviewText('')
      setMessage(isValid ? 'Complaint marked true and ready for admin.' : 'Complaint sent back for more investigation.')
      await loadData()
    } finally {
      setSavingAction('')
    }
  }

  const handleSendToAdmin = async () => {
    if (!selectedComplaint) return
    const alreadySent =
      sentToAdmin ||
      sentAdminIds.has(Number(selectedComplaint.id)) ||
      selectedComplaint.effective_status_reason === 'sent_to_admin'

    if (alreadySent) return

    setSavingAction('admin')
    setMessage('')
    try {
      await transferComplaint(selectedComplaint.id, {
        target_role: 'admin',
        reason: reviewText || 'Affairs verified this complaint and requests admin reflection.'
      })
      setSentAdminIds((current) => new Set([...current, Number(selectedComplaint.id)]))
      setReviewText('')
      setMessage('Complaint sent to admin.')
      await loadData()
    } finally {
      setSavingAction('')
    }
  }

  const investigation = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.investigation)
    : null
  const affairsReview = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.affairsReview)
    : null
  const adminResponse = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.adminResponse)
    : null
  const isTrueReview = Boolean(
    affairsReview?.note?.includes('TRUE') || approvedIds.has(Number(selectedComplaint?.id))
  )
  const sentToAdmin = selectedComplaint
    ? hasNoteMarker(notes, selectedComplaint.id, NOTE_MARKERS.adminRequest) ||
      sentAdminIds.has(Number(selectedComplaint.id)) ||
      selectedComplaint.effective_status_reason === 'sent_to_admin'
    : false

  if (loading) {
    return <div className="text-sm text-gray-500">Loading complaint review...</div>
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Affairs Complaint Page"
        title="Review investigated complaints"
        description="Affairs can see student complaints, check the support officer investigation, then either confirm it or send it to admin."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Investigated</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{investigatedComplaints.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Sent to Admin</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{sentToAdminCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Over SLA</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{overdueCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <ClipboardList size={18} />
              Student complaints
            </div>
            <button onClick={loadData} className="rounded-lg p-2 text-gray-500 hover:bg-gray-50" title="Refresh">
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {complaints.map((complaint) => {
              const investigated = hasNoteMarker(notes, complaint.id, NOTE_MARKERS.investigation)
              return (
                <button
                  key={complaint.id}
                  onClick={() => setSelectedId(complaint.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    Number(selectedId) === Number(complaint.id)
                      ? 'border-[#2B85B7] bg-[#EAF5FB]'
                      : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</span>
                    {investigated ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <CheckCircle2 size={14} />
                        Result sent to Affairs
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">Waiting result</span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{complaint.title || complaint.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PriorityBadge priority={complaint.priority} />
                    <StatusPill status={getComplaintStatus(complaint)} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {selectedComplaint ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Selected complaint</p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">{getComplaintCode(selectedComplaint)}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={selectedComplaint.priority} />
                  <StatusPill status={getComplaintStatus(selectedComplaint)} />
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-gray-600">{selectedComplaint.description}</p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SLA</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{getSlaLabel(selectedComplaint)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remaining</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{formatDaysRemaining(selectedComplaint)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{sentToAdmin ? 'Sent' : 'Not sent'}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Result sent to Affairs</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {investigation?.note ? cleanWorkflowNote(investigation.note) : 'No investigation result has been sent yet.'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Admin response</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                    {adminResponse?.note ? cleanWorkflowNote(adminResponse.note) : 'Admin has not responded yet.'}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Affairs decision note</label>
                <textarea
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="min-h-32 w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-[#2B85B7]"
                  placeholder="Write your review before confirming or sending to admin."
                />
              </div>

              {message ? <p className="mt-3 text-sm font-medium text-green-700">{message}</p> : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => handleReview(true)}
                  disabled={!investigation || isTrueReview || sentToAdmin || savingAction !== ''}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={17} />
                  {savingAction === 'valid' ? 'Checking...' : sentToAdmin ? 'Sent to admin' : isTrueReview ? 'Already approved' : 'Complaint true'}
                </button>
                <button
                  onClick={() => handleReview(false)}
                  disabled={sentToAdmin || savingAction !== ''}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  <XCircle size={17} />
                  {sentToAdmin ? 'Locked' : 'Need investigation'}
                </button>
                <button
                  onClick={handleSendToAdmin}
                  disabled={!isTrueReview || sentToAdmin || savingAction !== ''}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2B85B7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-50"
                >
                  <Send size={17} />
                  {savingAction === 'admin' ? 'Sending...' : 'Send to admin'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a complaint to review.</p>
          )}
        </div>
      </div>
    </div>
  )
}
