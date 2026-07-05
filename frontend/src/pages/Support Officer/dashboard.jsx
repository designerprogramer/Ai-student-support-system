import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Send,
  ShieldAlert
} from 'lucide-react'

import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import DashboardHeader from '../../components/DashboardHeader'

import {
  NOTE_MARKERS,
  addComplaintNote,
  canSubmitInvestigation,
  fetchComplaints,
  fetchNotes,
  getComplaintCode,
  getDaysRemaining,
  getSlaLabel,
  hasNoteMarker,
  isComplaintOverdue,
  latestMarkedNote,
  needsMoreInvestigation
} from '../../lib/complaintWorkflow'

export default function SupportOfficerDashboard() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])

  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState('active') // 'active', 'under_review', 'closed'

  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true)

    try {
      const [complaintData, noteData] = await Promise.all([
        fetchComplaints(),
        fetchNotes()
      ])

      setComplaints(complaintData || [])
      setNotes(noteData || [])

      setSelectedId((current) => current || complaintData?.[0]?.id || null)
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const interval = setInterval(() => {
      loadData(false)
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!message) return undefined
    const timeout = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timeout)
  }, [message])

  // FIXED PROCESSING
  const processedComplaints = useMemo(() => {
    return complaints.map((complaint) => {
      const isInvestigated = hasNoteMarker(
        notes,
        complaint.id,
        NOTE_MARKERS.investigation
      )

      const isReturned = needsMoreInvestigation(
        notes,
        complaint.id
      )

      const isClosed =
        complaint.status?.toLowerCase() === 'closed' ||
        complaint.status?.toLowerCase() === 'resolved'

      let group = 'active'

      if (isClosed) {
        group = 'closed'
      } else if (isInvestigated && !isReturned) {
        group = 'under_review'
      }

      return {
        ...complaint,
        isInvestigated,
        isReturned,
        isClosed,
        group
      }
    })
  }, [complaints, notes])

  const selectedComplaint = processedComplaints.find(
    (item) => Number(item.id) === Number(selectedId)
  )

  const filteredComplaints = useMemo(() => {
    return processedComplaints.filter((c) => c.group === activeTab)
  }, [processedComplaints, activeTab])

  // COUNTS
  const activeCount = useMemo(() => {
    return processedComplaints.filter(
      (c) => c.group === 'active'
    ).length
  }, [processedComplaints])

  const investigatedCount = useMemo(() => {
    return processedComplaints.filter(
      (c) => c.isInvestigated
    ).length
  }, [processedComplaints])

  const underReviewCount = useMemo(() => {
    return processedComplaints.filter(
      (c) => c.group === 'under_review'
    ).length
  }, [processedComplaints])

  const closedCount = useMemo(() => {
    return processedComplaints.filter(
      (c) => c.group === 'closed'
    ).length
  }, [processedComplaints])

  const returnedCount = useMemo(() => {
    return processedComplaints.filter(
      (c) => c.isReturned
    ).length
  }, [processedComplaints])

  const overdueCount = useMemo(() => {
    return processedComplaints.filter((c) =>
      isComplaintOverdue(c)
    ).length
  }, [processedComplaints])

  // Auto-selection on tab switch
  useEffect(() => {
    if (filteredComplaints.length > 0) {
      const exists = filteredComplaints.some((item) => Number(item.id) === Number(selectedId))
      if (!exists) {
        setSelectedId(filteredComplaints[0].id)
      }
    } else {
      setSelectedId(null)
    }
  }, [activeTab, filteredComplaints])

  const affairsReview = selectedComplaint
    ? latestMarkedNote(
        notes,
        selectedComplaint.id,
        NOTE_MARKERS.affairsReview
      )
    : null

  const latestInvestigation = selectedComplaint
    ? latestMarkedNote(
        notes,
        selectedComplaint.id,
        NOTE_MARKERS.investigation
      )
    : null

  const canInvestigateSelected = selectedComplaint
    ? selectedComplaint.group === 'active' && canSubmitInvestigation(notes, selectedComplaint.id)
    : false

  const handleSubmitInvestigation = async () => {
    if (!selectedComplaint || !canInvestigateSelected || !result.trim()) return

    setSaving(true)
    setMessage('')

    try {
      await addComplaintNote(
        selectedComplaint.id,
        NOTE_MARKERS.investigation,
        result,
        'internal'
      )

      setResult('')
      setMessage('Investigation result sent successfully.')

      await loadData()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Support Officer Dashboard"
        title="Complaint investigations"
        description="Review active student complaints, investigate returned or pending cases, then send the result back to Affairs."
      />

      {/* STATS */}
      <div className="grid gap-5 md:grid-cols-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">
            Active Complaints
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            {activeCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">
            Investigated
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900">
            {investigatedCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">
            Returned
          </p>

          <p className="mt-2 text-3xl font-bold text-amber-700">
            {returnedCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">
            Over SLA
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {overdueCount}
          </p>
        </div>
      </div>

      {/* MAIN */}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {/* LEFT */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <ClipboardCheck size={18} />
              Complaint Queue
            </div>

            <button
              onClick={loadData}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-50"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* TABS SELECTOR */}
          <div className="mt-4 flex rounded-xl bg-gray-50 p-1">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'active'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('under_review')}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'under_review'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Under Review ({underReviewCount})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'closed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Closed ({closedCount})
            </button>
          </div>

          <div className="mt-5 space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {filteredComplaints.map((complaint) => (
              <button
                key={complaint.id}
                onClick={() => setSelectedId(complaint.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  Number(selectedId) === Number(complaint.id)
                    ? 'border-[#2B85B7] bg-[#EAF5FB]'
                    : 'border-gray-100 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {getComplaintCode(complaint)}
                  </span>

                  <div className="flex items-center gap-2">
                    {complaint.isInvestigated ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                        <CheckCircle2 size={14} />
                        Investigated
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">
                        Pending
                      </span>
                    )}

                    {complaint.isReturned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <AlertCircle size={14} />
                        Returned
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-600">
                  {complaint.title || complaint.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <PriorityBadge priority={complaint.priority} />
                  <StatusPill status={complaint.status} />
                </div>
              </button>
            ))}

            {filteredComplaints.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
                No complaints found in this tab.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {selectedComplaint ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                    Selected Complaint
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-gray-900">
                    {getComplaintCode(selectedComplaint)}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={selectedComplaint.priority} />
                  <StatusPill status={selectedComplaint.status} />
                </div>
              </div>

              <p className="mt-6 text-sm leading-7 text-gray-600">
                {selectedComplaint.description}
              </p>

              {/* INFO */}
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Category
                  </p>

                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {selectedComplaint.category || 'Other'}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    SLA
                  </p>

                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {getSlaLabel(selectedComplaint)}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Remaining
                  </p>

                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {getDaysRemaining(selectedComplaint)} days
                  </p>
                </div>
              </div>

              {/* STATUS ALERT BANNER */}
              {selectedComplaint.group !== 'active' && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e8e7ff] bg-[#f9f8ff] p-5">
                  <CheckCircle2 className="mt-0.5 text-[#2B85B7] flex-shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Investigation Note Submitted</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      {selectedComplaint.group === 'closed'
                        ? 'This complaint has been resolved and closed. No further changes can be made.'
                        : 'Your investigation has been submitted. It is currently under review by Student Affairs.'}
                    </p>
                  </div>
                </div>
              )}

              {/* AFFAIRS REVIEW */}
              {affairsReview && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-900">
                    Latest Affairs Review
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    {affairsReview.note}
                  </p>
                </div>
              )}

              {/* OVER SLA */}
              {isComplaintOverdue(selectedComplaint) && (
                <div className="mt-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <ShieldAlert size={18} />

                  Complaint exceeded SLA response time.
                </div>
              )}

              {/* FORM */}
              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Investigation Result
                </label>

                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  disabled={!canInvestigateSelected}
                  placeholder={
                    canInvestigateSelected
                      ? "Write your investigation result..."
                      : "Investigation result already submitted for review."
                  }
                  className="min-h-40 w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-[#2B85B7] disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              {message && (
                <p className="mt-3 text-sm font-medium text-green-700">
                  {message}
                </p>
              )}

              <button
                onClick={handleSubmitInvestigation}
                disabled={saving || !result.trim() || !canInvestigateSelected}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#2B85B7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-50"
              >
                <Send size={17} />

                {saving
                  ? 'Sending...'
                  : canInvestigateSelected
                    ? 'Send Result to Affairs'
                    : 'Investigation already sent'}
              </button>

              {/* INVESTIGATION */}
              {latestInvestigation && (
                <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-sm font-semibold text-gray-900">
                    Latest Investigation
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {latestInvestigation.note
                      .replace(
                        NOTE_MARKERS.investigation,
                        ''
                      )
                      .trim()}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Select complaint
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
