import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  Bell,
  CheckCircle2,
  ClipboardList,
  History,
  MessageSquareReply,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  UserCheck
} from 'lucide-react'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import DashboardHeader, { dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import {
  NOTE_MARKERS,
  addComplaintNote,
  assignComplaint,
  fetchComplaints,
  fetchNotes,
  fetchPriorities,
  fetchStatusHistory,
  fetchStatuses,
  fetchTransfers,
  fetchUsers,
  formatDaysRemaining,
  getComplaintCode,
  getDueDate,
  hasNoteMarker,
  isAdminVisibleComplaint,
  isComplaintClosed,
  isComplaintOverdue,
  latestMarkedNote,
  normalizeKey,
  notesForComplaint,
  setComplaintPriorityByName,
  setComplaintStatusByName,
  transferComplaint
} from '../../lib/complaintWorkflow'

const DEFAULT_STATUSES = ['Pending', 'In Progress', 'Escalated', 'Resolved', 'Closed']
const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

function mergeOptions(defaults, apiItems) {
  const seen = new Set()
  return [...defaults, ...apiItems]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = normalizeKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function textValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.name || value.title || value.label || String(value.id || '')
}

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString()
}

function stripMarker(note = '') {
  return String(note)
    .replace(NOTE_MARKERS.investigation, '')
    .replace(NOTE_MARKERS.affairsReview, '')
    .replace(NOTE_MARKERS.adminRequest, '')
    .replace(NOTE_MARKERS.adminResponse, '')
    .replace('[PRIORITY CHANGE]', '')
    .replace('[ADMIN INTERNAL]', '')
    .replace('[ADMIN RETURNED TO AFFAIRS]', '')
    .replace('[AUTO CATEGORY UPDATE]', '')
    .replace('TRUE.', '')
    .replace('NEEDS MORE INVESTIGATION.', '')
    .trim()
}

function userName(user) {
  return (
    user.profile?.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username
  )
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [transfers, setTransfers] = useState([])
  const [history, setHistory] = useState([])
  const [users, setUsers] = useState([])
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES)
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: ''
  })
  const [actionForm, setActionForm] = useState({
    status: 'Resolved',
    priority: '',
    assignedTo: '',
    publicReply: '',
    internalNote: '',
    returnReason: ''
  })

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [
        complaintData,
        noteData,
        transferData,
        historyData,
        userData,
        statusData,
        priorityData
      ] = await Promise.all([
        fetchComplaints(),
        fetchNotes(),
        fetchTransfers(),
        fetchStatusHistory(),
        fetchUsers(),
        fetchStatuses(),
        fetchPriorities()
      ])

      setComplaints(complaintData)
      setNotes(noteData)
      setTransfers(transferData)
      setHistory(historyData)
      setUsers(userData)
      setStatuses(mergeOptions(DEFAULT_STATUSES, statusData.map((item) => item.name)))
      setPriorities(mergeOptions(DEFAULT_PRIORITIES, priorityData.map((item) => item.name)))
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Could not load admin complaints.')
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
    if (!message && !error) return undefined
    const timeout = setTimeout(() => {
      setMessage('')
      setError('')
    }, 4000)
    return () => clearTimeout(timeout)
  }, [message, error])

  const adminComplaints = useMemo(
    () => complaints.filter((complaint) => isAdminVisibleComplaint(notes, complaint)),
    [complaints, notes]
  )

  const filteredComplaints = useMemo(() => {
    return adminComplaints.filter((complaint) => {
      const searchText = `${getComplaintCode(complaint)} ${complaint.title || ''} ${complaint.description || ''} ${complaint.category || ''}`.toLowerCase()
      const matchesSearch = !filters.search || searchText.includes(filters.search.toLowerCase())
      const matchesStatus = !filters.status || normalizeKey(complaint.effective_status || complaint.status) === normalizeKey(filters.status)
      const matchesPriority = !filters.priority || normalizeKey(complaint.priority) === normalizeKey(filters.priority)
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [adminComplaints, filters])

  useEffect(() => {
    if (!selectedId && filteredComplaints[0]) {
      setSelectedId(filteredComplaints[0].id)
    }
    if (selectedId && filteredComplaints.length && !filteredComplaints.some((item) => Number(item.id) === Number(selectedId))) {
      setSelectedId(filteredComplaints[0].id)
    }
  }, [filteredComplaints, selectedId])

  const selectedComplaint = adminComplaints.find((item) => Number(item.id) === Number(selectedId))
  const selectedNotes = selectedComplaint ? notesForComplaint(notes, selectedComplaint.id) : []
  const selectedTransfers = selectedComplaint
    ? transfers.filter((item) => Number(item.complaint) === Number(selectedComplaint.id))
    : []
  const selectedHistory = selectedComplaint
    ? history.filter((item) => Number(item.complaint) === Number(selectedComplaint.id))
    : []

  const adminRequest = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.adminRequest)
    : null
  const investigation = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.investigation)
    : null
  const affairsReview = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.affairsReview)
    : null
  const adminResponse = selectedComplaint
    ? latestMarkedNote(notes, selectedComplaint.id, NOTE_MARKERS.adminResponse)
    : null

  const staffUsers = users.filter((user) => {
    const roles = user.roles || []
    return user.is_active && roles.some((role) => ['support_officer', 'support_offcier', 'affairs', 'admin'].includes(normalizeKey(role)))
  })

  const escalationCount = adminComplaints.filter(
    (complaint) =>
      !hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse) &&
      isComplaintOverdue(complaint)
  ).length
  const closedCount = adminComplaints.filter(isComplaintClosed).length

  const updateActionForm = (key, value) => {
    setActionForm((current) => ({ ...current, [key]: value }))
    setMessage('')
  }

  const runAction = async (actionName, action) => {
    if (!selectedComplaint) return
    setSavingAction(actionName)
    setMessage('')
    setError('')
    try {
      await action()
      await loadData()
      setMessage('Action completed successfully.')
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Action failed. Please try again.')
    } finally {
      setSavingAction('')
    }
  }

  const handleFinalResponse = (forcedStatus = '') =>
    runAction('final', async () => {
      if (actionForm.publicReply.trim()) {
        await addComplaintNote(
          selectedComplaint.id,
          NOTE_MARKERS.adminResponse,
          actionForm.publicReply,
          'response'
        )
      }
      await setComplaintStatusByName(
        selectedComplaint.id,
        forcedStatus || actionForm.status || 'Resolved',
        actionForm.publicReply || 'Final admin action completed.'
      )
      setActionForm((current) => ({ ...current, publicReply: '' }))
    })

  const handleInternalNote = () =>
    runAction('note', async () => {
      await addComplaintNote(selectedComplaint.id, '[ADMIN INTERNAL]', actionForm.internalNote, 'internal')
      setActionForm((current) => ({ ...current, internalNote: '' }))
    })

  const handleReturnToAffairs = () =>
    runAction('return', async () => {
      await transferComplaint(selectedComplaint.id, {
        target_role: 'affairs',
        reason: actionForm.returnReason || 'Admin returned this complaint to Affairs for more review.'
      })
      await addComplaintNote(
        selectedComplaint.id,
        '[ADMIN RETURNED TO AFFAIRS]',
        actionForm.returnReason || 'More Affairs review is required.',
        'internal'
      )
      await setComplaintStatusByName(selectedComplaint.id, 'In Progress', 'Returned to Affairs by admin.')
      setActionForm((current) => ({ ...current, returnReason: '' }))
    })

  const handlePriorityChange = () =>
    runAction('priority', async () => {
      await setComplaintPriorityByName(
        selectedComplaint.id,
        actionForm.priority,
        'Priority corrected by admin.'
      )
    })

  const handleAssignment = () =>
    runAction('assign', async () => {
      await assignComplaint(selectedComplaint.id, actionForm.assignedTo)
      setActionForm((current) => ({ ...current, assignedTo: '' }))
    })

  if (loading) {
    return <div className="text-sm text-gray-500">Loading admin complaints...</div>
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Admin complaints"
        title="Complaint control center"
        description="Review escalated cases, answer students, close complaints, return cases to Affairs, assign work, and track the full history."
        actions={
          <button
            onClick={loadData}
            className={dashboardHeaderSecondaryAction}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-4">
        {[
          ['Admin cases', adminComplaints.length, ClipboardList, 'text-gray-900'],
          ['Escalated/overdue', escalationCount, ShieldAlert, 'text-red-700'],
          ['Closed/resolved', closedCount, CheckCircle2, 'text-emerald-700'],
          ['Visible after Affairs', adminComplaints.length - escalationCount, Bell, 'text-[#2B85B7]']
        ].map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_160px_160px_auto]">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#2B85B7]"
                placeholder="Search complaint"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
            <select
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#2B85B7]"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All status</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#2B85B7]"
              value={filters.priority}
              onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="">All priority</option>
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
            <button
              onClick={() => setFilters({ search: '', status: '', priority: '' })}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <RotateCcw size={16} />
              Clear
            </button>
          </div>

          <div className="mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredComplaints.map((complaint) => {
              const dueDate = getDueDate(complaint)
              const active = Number(complaint.id) === Number(selectedId)
              return (
                <button
                  key={complaint.id}
                  onClick={() => setSelectedId(complaint.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active ? 'border-[#2B85B7] bg-[#EAF5FB]' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</p>
                    <div className="flex flex-wrap gap-2">
                      <PriorityBadge priority={complaint.priority} />
                      <StatusPill status={complaint.effective_status || complaint.status} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-900">{complaint.title || 'Untitled complaint'}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{complaint.description}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-gray-500">
                    <span>{complaint.category || 'Other'}</span>
                    <span>{dueDate ? `Due ${dueDate.toLocaleDateString()}` : 'No due date'}</span>
                    <span className={isComplaintOverdue(complaint) ? 'text-red-700' : 'text-gray-500'}>
                      {formatDaysRemaining(complaint)}
                    </span>
                  </div>
                </button>
              )
            })}
            {filteredComplaints.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm leading-6 text-gray-600">
                No complaints are ready for admin yet. A complaint appears here after Affairs sends it to admin or after it becomes overdue.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          {selectedComplaint ? (
            <>
              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Selected complaint</p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">{getComplaintCode(selectedComplaint)}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{selectedComplaint.title || selectedComplaint.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority={selectedComplaint.priority} />
                    <StatusPill status={selectedComplaint.effective_status || selectedComplaint.status} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{selectedComplaint.category || 'Other'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Student</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{selectedComplaint.student_name || selectedComplaint.student_number || selectedComplaint.student}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formatDate(selectedComplaint.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Student satisfaction</p>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">Feedback after resolution</h3>
                  </div>
                  {selectedComplaint.feedback_rating ? (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          size={20}
                          className={value <= selectedComplaint.feedback_rating ? 'text-amber-500' : 'text-gray-300'}
                          fill={value <= selectedComplaint.feedback_rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
                      No rating yet
                    </span>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-7 text-gray-600">
                  {selectedComplaint.feedback_comment || 'Student has not added a suggestion yet.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <MessageSquareReply size={17} />
                    Final admin action
                  </div>
                  <span className="rounded-full bg-[#eaf5fb] px-3 py-1 text-xs font-semibold text-[#2B85B7]">
                    Student visible
                  </span>
                </div>
                <textarea
                  value={actionForm.publicReply}
                  onChange={(event) => updateActionForm('publicReply', event.target.value)}
                  className="mt-4 min-h-40 w-full rounded-xl border border-gray-200 p-5 text-sm leading-7 outline-none transition focus:border-[#2B85B7] focus:ring-2 focus:ring-[#2B85B7]/10"
                  placeholder="Write the public final response for the student."
                />
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <select
                    value={actionForm.status}
                    onChange={(event) => updateActionForm('status', event.target.value)}
                    className="h-12 min-w-56 rounded-xl border border-gray-200 bg-white px-4 text-sm outline-none transition focus:border-[#2B85B7] focus:ring-2 focus:ring-[#2B85B7]/10"
                  >
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <button
                    onClick={() => handleFinalResponse()}
                    disabled={savingAction === 'final' || !actionForm.publicReply.trim()}
                    className="inline-flex h-12 min-w-44 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#2B85B7] px-6 text-sm font-semibold text-white transition hover:bg-[#2376A4] disabled:opacity-50"
                  >
                    <CheckCircle2 size={17} />
                    {savingAction === 'final' ? 'Saving...' : 'Save response'}
                  </button>
                  <button
                    onClick={() => handleFinalResponse('Closed')}
                    disabled={savingAction === 'final' || !actionForm.publicReply.trim()}
                    className="inline-flex h-12 min-w-32 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <ArrowDownUp size={17} />
                    Priority and assignment
                  </div>
                  <select
                    value={actionForm.priority}
                    onChange={(event) => updateActionForm('priority', event.target.value)}
                    className="mt-4 h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#2B85B7]"
                  >
                    <option value="">Choose priority</option>
                    {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                  <button
                    onClick={handlePriorityChange}
                    disabled={savingAction === 'priority' || !actionForm.priority}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Update priority
                  </button>

                  <select
                    value={actionForm.assignedTo}
                    onChange={(event) => updateActionForm('assignedTo', event.target.value)}
                    className="mt-5 h-12 w-full rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#2B85B7]"
                  >
                    <option value="">Assign to staff</option>
                    {staffUsers.map((user) => <option key={user.id} value={user.id}>{userName(user)}</option>)}
                  </select>
                  <button
                    onClick={handleAssignment}
                    disabled={savingAction === 'assign' || !actionForm.assignedTo}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <UserCheck size={16} />
                    Assign complaint
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <RotateCcw size={17} />
                    Return or internal note
                  </div>
                  <textarea
                    value={actionForm.returnReason}
                    onChange={(event) => updateActionForm('returnReason', event.target.value)}
                    className="mt-4 min-h-24 w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-[#2B85B7]"
                    placeholder="Reason for returning this complaint to Affairs."
                  />
                  <button
                    onClick={handleReturnToAffairs}
                    disabled={savingAction === 'return'}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-amber-200 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    Return to Affairs
                  </button>
                  <textarea
                    value={actionForm.internalNote}
                    onChange={(event) => updateActionForm('internalNote', event.target.value)}
                    className="mt-5 min-h-24 w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-[#2B85B7]"
                    placeholder="Private admin note hidden from students."
                  />
                  <button
                    onClick={handleInternalNote}
                    disabled={savingAction === 'note' || !actionForm.internalNote.trim()}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Save internal note
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  <History size={17} />
                  Complaint history
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-4">
                  {[
                    ['Affairs request', adminRequest?.note],
                    ['Support investigation', investigation?.note],
                    ['Affairs review', affairsReview?.note],
                    ['Admin response', adminResponse?.note]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-gray-700">{value ? stripMarker(value) : 'No record yet.'}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 2xl:grid-cols-[1.45fr_0.85fr]">
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">All notes</p>
                      <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
                        {selectedNotes.length}
                      </span>
                    </div>

                    <div className="mt-4 max-h-[680px] space-y-4 overflow-y-auto pr-2">
                      {selectedNotes.map((note) => (
                        <div key={note.id} className="rounded-xl bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-gray-600">
                              {note.note_type || 'note'}
                            </span>
                            <span className="text-xs font-medium text-gray-400">
                              {formatDate(note.created_at)}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                            {stripMarker(note.note)}
                          </p>
                        </div>
                      ))}
                      {selectedNotes.length === 0 ? (
                        <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                          No notes recorded for this complaint.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">Status timeline</p>
                        <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
                          {selectedHistory.length}
                        </span>
                      </div>

                      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
                        {selectedHistory.map((item) => (
                          <div key={item.id} className="border-l-2 border-[#2B85B7] pl-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              {formatDate(item.changed_at)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              Status #{item.status}
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-sm leading-6 text-gray-600">{item.note}</p>
                            ) : null}
                          </div>
                        ))}
                        {selectedHistory.length === 0 ? (
                          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                            No status history.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">Transfers</p>
                        <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
                          {selectedTransfers.length}
                        </span>
                      </div>

                      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
                        {selectedTransfers.map((item) => (
                          <div key={item.id} className="rounded-xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              {formatDate(item.created_at)}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-gray-900">
                              {item.transferred_by_name} to {item.transferred_to_role_name || item.transferred_to_name || 'target'}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                              {item.reason || 'No reason provided.'}
                            </p>
                          </div>
                        ))}
                        {selectedTransfers.length === 0 ? (
                          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                            No transfers.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
              Select a complaint to manage.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
