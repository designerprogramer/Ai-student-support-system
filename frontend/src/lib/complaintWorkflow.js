import api from './api'

/* =========================
   CONFIG
========================= */

const PRIORITY_DAYS = {
  critical: 2,
  high: 2,
  medium: 5,
  low: 7
}

export const NOTE_MARKERS = {
  investigation: '[INVESTIGATION RESULT]',
  affairsReview: '[AFFAIRS REVIEW]',
  adminRequest: '[SEND TO ADMIN]',
  adminResponse: '[ADMIN RESPONSE]'
}

/* =========================
   HELPERS
========================= */

export const normalizeText = (value = '') => `${value || ''}`.trim()

export const normalizeKey = (value = '') =>
  normalizeText(value).toLowerCase().replace(/\s+/g, '_')

const getNoteText = (note) =>
  normalizeText(
    note?.note ||
    note?.content ||
    note?.text ||
    note?.message
  )

const getComplaintId = (note) =>
  note?.complaint?.id ||
  note?.complaint ||
  note?.complaint_id ||
  null

/* =========================
   COMPLAINT CORE
========================= */

export const getComplaintCode = (complaint) =>
  complaint?.complaint_code ||
  complaint?.code ||
  `CMP-${complaint?.id}`

export const getPriorityDays = (priority) =>
  PRIORITY_DAYS[normalizeKey(priority)] || 7

export const getDueDate = (complaint) => {
  if (isComplaintClosed(complaint)) return null
  if (!complaint?.created_at) return null
  const dueDate = new Date(complaint.created_at)
  dueDate.setDate(dueDate.getDate() + getPriorityDays(complaint.priority))
  return dueDate
}

export const getDaysRemaining = (complaint) => {
  const dueDate = getDueDate(complaint)
  if (!dueDate) return null
  return Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
}

export const formatDaysRemaining = (complaint) => {
  const daysRemaining = getDaysRemaining(complaint)
  if (daysRemaining === null) return 'No due date'
  const absDays = Math.abs(daysRemaining)
  const dayLabel = absDays === 1 ? 'day' : 'days'

  if (daysRemaining < 0) return `Overtime ${absDays} ${dayLabel}`
  if (daysRemaining === 0) return 'Due today'
  return `${daysRemaining} ${dayLabel} left`
}

export const isComplaintClosed = (complaint) => {
  const status = normalizeKey(complaint?.effective_status || complaint?.status)
  return ['resolved', 'closed'].includes(status)
}

export const isComplaintOverdue = (complaint) => {
  const daysRemaining = getDaysRemaining(complaint)
  return !isComplaintClosed(complaint) && daysRemaining !== null && daysRemaining < 0
}

export const getSlaLabel = (complaint) => {
  const days = getPriorityDays(complaint?.priority)
  if (days === 2) return '2 days'
  if (days === 5) return '5 days'
  return '1 week'
}

/* =========================
   NOTE LOGIC (FIXED)
========================= */

export const notesForComplaint = (notes = [], complaintId) =>
  notes.filter(
    (note) => Number(getComplaintId(note)) === Number(complaintId)
  )

export const hasNoteMarker = (notes = [], complaintId, marker) =>
  notesForComplaint(notes, complaintId).some((note) =>
    getNoteText(note).includes(marker)
  )

export const latestMarkedNote = (notes = [], complaintId, marker) =>
  notesForComplaint(notes, complaintId)
    .filter((note) => getNoteText(note).includes(marker))
    .sort(
      (a, b) =>
        new Date(b.created_at || b.createdAt || 0).getTime() -
        new Date(a.created_at || a.createdAt || 0).getTime()
    )[0]

export const noteTime = (note) =>
  new Date(note?.created_at || note?.createdAt || 0).getTime()

export const needsMoreInvestigation = (notes = [], complaintId) =>
  (() => {
    const review = latestMarkedNote(notes, complaintId, NOTE_MARKERS.affairsReview)
    const investigation = latestMarkedNote(notes, complaintId, NOTE_MARKERS.investigation)

    return (
      getNoteText(review).includes('NEEDS MORE INVESTIGATION') &&
      (!investigation || noteTime(review) >= noteTime(investigation))
    )
  })()

export const canSubmitInvestigation = (notes = [], complaintId) => {
  const investigation = latestMarkedNote(notes, complaintId, NOTE_MARKERS.investigation)
  if (!investigation) return true

  const review = latestMarkedNote(notes, complaintId, NOTE_MARKERS.affairsReview)
  return (
    getNoteText(review).includes('NEEDS MORE INVESTIGATION') &&
    noteTime(review) > noteTime(investigation)
  )
}

export const isAffairsApproved = (notes = [], complaintId) =>
  getNoteText(
    latestMarkedNote(notes, complaintId, NOTE_MARKERS.affairsReview)
  ).includes('TRUE')

export const isAdminVisibleComplaint = (notes, complaintOrId) => {
  const complaintId =
    typeof complaintOrId === 'object'
      ? complaintOrId?.id
      : complaintOrId

  return (
    hasNoteMarker(notes, complaintId, NOTE_MARKERS.adminRequest) ||
    (typeof complaintOrId === 'object' &&
      isComplaintOverdue(complaintOrId))
  )
}

/* =========================
   API HELPERS
========================= */

export const getApiList = async (path) => {
  const results = []
  let nextPath = path

  while (nextPath) {
    const response = await api.get(nextPath)
    const payload = response.data || []

    if (!payload.results) {
      return payload
    }

    results.push(...payload.results)
    nextPath = payload.next
      ? payload.next.replace(api.defaults.baseURL, '')
      : ''
  }

  return results
}

export const fetchComplaints = () => getApiList('/complaints/')
export const fetchNotes = () => getApiList('/notes/')
export const fetchAssignments = () => getApiList('/assignments/')
export const fetchTransfers = () => getApiList('/transfers/')
export const fetchNotifications = () => getApiList('/notifications/')
export const fetchLoginAuditLogs = () => getApiList('/login-audit-logs/')
export const fetchLoginSecurityStates = () => getApiList('/login-security/')
export const fetchUsers = () => getApiList('/users/')
export const fetchStatuses = () => getApiList('/statuses/')
export const fetchPriorities = () => getApiList('/priorities/')
export const fetchStatusHistory = () => getApiList('/status-history/')
export const fetchReportSummary = async () => {
  const response = await api.get('/reports/summary/')
  return response.data
}

/* =========================
   ACTIONS
========================= */

export const addComplaintNote = (
  complaintId,
  marker,
  text,
  noteType = 'internal'
) =>
  api.post(`/complaints/${complaintId}/add_note/`, {
    note_type: noteType,
    note: `${marker} ${normalizeText(text)}`
  })

export const setComplaintStatusByName = async (
  complaintId,
  statusName,
  note = ''
) => {
  const statuses = await getApiList('/statuses/')
  let status = statuses.find(
    (item) => normalizeKey(item.name) === normalizeKey(statusName)
  )

  if (!status) {
    const response = await api.post('/statuses/', { name: statusName })
    status = response.data
  }

  const response = await api.post(
    `/complaints/${complaintId}/set_status/`,
    {
      status: status.id,
      note
    }
  )

  return response.data
}

export const transferComplaint = (complaintId, payload) =>
  api.post(`/complaints/${complaintId}/transfer/`, payload)

export const assignComplaint = (complaintId, assignedTo, autoAssigned = false) =>
  api.post(`/complaints/${complaintId}/assign/`, {
    assigned_to: assignedTo,
    auto_assigned: autoAssigned
  })

export const setComplaintPriorityByName = async (
  complaintId,
  priorityName,
  note = ''
) => {
  const priorities = await fetchPriorities()
  const priority = priorities.find(
    (item) => normalizeKey(item.name) === normalizeKey(priorityName)
  )

  if (!priority) return null

  const response = await api.post(
    `/complaints/${complaintId}/set_priority/`,
    {
      priority: priority.id,
      note
    }
  )

  return response.data
}

/* =========================
   NOTIFICATIONS
========================= */

export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}/`, { is_read: true })

export const markAllNotificationsRead = () =>
  api.post('/notifications/mark_all_read/')
