import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Search,
  Send,
  TimerReset
} from 'lucide-react'
import DashboardHeader, { dashboardHeaderPrimaryAction, dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import {
  NOTE_MARKERS,
  fetchComplaints,
  fetchNotes,
  formatDaysRemaining,
  getComplaintCode,
  getDaysRemaining,
  getSlaLabel,
  hasNoteMarker,
  isComplaintClosed,
  isComplaintOverdue,
  latestMarkedNote,
  normalizeKey
} from '../../lib/complaintWorkflow'

const priorityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
}

function stripWorkflowNote(note = '') {
  return String(note || '')
    .replace(NOTE_MARKERS.investigation, '')
    .replace(NOTE_MARKERS.affairsReview, '')
    .replace(NOTE_MARKERS.adminRequest, '')
    .replace(NOTE_MARKERS.adminResponse, '')
    .replace('TRUE.', '')
    .replace('NEEDS MORE INVESTIGATION.', '')
    .trim()
}

function statusOf(complaint) {
  return complaint?.effective_status || complaint?.status || ''
}

function sortByPriorityAndDue(a, b) {
  const rankDiff = (priorityRank[normalizeKey(a.priority)] ?? 9) - (priorityRank[normalizeKey(b.priority)] ?? 9)
  if (rankDiff !== 0) return rankDiff
  return (getDaysRemaining(a) ?? 999) - (getDaysRemaining(b) ?? 999)
}

function noteTime(note) {
  return new Date(note?.created_at || note?.createdAt || 0).getTime()
}

export default function AffairsDashboard() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [tableMode, setTableMode] = useState('review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [complaintData, noteData] = await Promise.all([fetchComplaints(), fetchNotes()])
      setComplaints(complaintData)
      setNotes(noteData)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Could not load Affairs dashboard.')
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(false), 10000)
    return () => clearInterval(interval)
  }, [])

  const investigatedComplaints = useMemo(
    () => complaints.filter((item) => hasNoteMarker(notes, item.id, NOTE_MARKERS.investigation)),
    [complaints, notes]
  )

  const waitingReview = useMemo(
    () =>
      investigatedComplaints
        .filter((item) => {
          if (isComplaintClosed(item)) return false
          if (hasNoteMarker(notes, item.id, NOTE_MARKERS.adminRequest)) return false
          const investigation = latestMarkedNote(notes, item.id, NOTE_MARKERS.investigation)
          const review = latestMarkedNote(notes, item.id, NOTE_MARKERS.affairsReview)
          return Boolean(investigation) && (!review || noteTime(investigation) > noteTime(review))
        })
        .sort(sortByPriorityAndDue),
    [investigatedComplaints, notes]
  )

  const approvedComplaints = useMemo(
    () =>
      complaints.filter((item) => {
        const investigation = latestMarkedNote(notes, item.id, NOTE_MARKERS.investigation)
        const review = latestMarkedNote(notes, item.id, NOTE_MARKERS.affairsReview)
        return review?.note?.includes('TRUE') && (!investigation || noteTime(review) >= noteTime(investigation))
      }),
    [complaints, notes]
  )

  const needsInvestigation = useMemo(
    () =>
      complaints.filter((item) => {
        const investigation = latestMarkedNote(notes, item.id, NOTE_MARKERS.investigation)
        const review = latestMarkedNote(notes, item.id, NOTE_MARKERS.affairsReview)
        return review?.note?.includes('NEEDS MORE INVESTIGATION') && (!investigation || noteTime(review) >= noteTime(investigation))
      }),
    [complaints, notes]
  )

  const sentToAdmin = useMemo(
    () => complaints.filter((item) => hasNoteMarker(notes, item.id, NOTE_MARKERS.adminRequest)),
    [complaints, notes]
  )

  const adminAnswered = useMemo(
    () => complaints.filter((item) => hasNoteMarker(notes, item.id, NOTE_MARKERS.adminResponse)),
    [complaints, notes]
  )

  const overdueComplaints = useMemo(
    () => complaints.filter((item) => isComplaintOverdue(item)).sort(sortByPriorityAndDue),
    [complaints]
  )

  const highRiskComplaints = useMemo(
    () =>
      complaints
        .filter(
          (item) =>
            !isComplaintClosed(item) &&
            (isComplaintOverdue(item) || ['critical', 'high'].includes(normalizeKey(item.priority)))
        )
        .sort(sortByPriorityAndDue),
    [complaints]
  )

  const allOpen = useMemo(
    () => complaints.filter((item) => !isComplaintClosed(item)),
    [complaints]
  )

  const tableConfig = {
    review: { label: 'Waiting review', rows: waitingReview },
    overdue: { label: 'Over SLA', rows: overdueComplaints },
    returned: { label: 'Needs investigation', rows: needsInvestigation },
    admin: { label: 'Sent to admin', rows: sentToAdmin },
    answered: { label: 'Admin answered', rows: adminAnswered },
    open: { label: 'All open', rows: allOpen }
  }

  const visibleRows = useMemo(() => {
    const rows = tableConfig[tableMode].rows
    const term = search.trim().toLowerCase()
    if (!term) return rows

    return rows.filter((complaint) =>
      `${getComplaintCode(complaint)} ${complaint.title || ''} ${complaint.description || ''} ${complaint.category || ''} ${complaint.priority || ''} ${statusOf(complaint)}`
        .toLowerCase()
        .includes(term)
    )
  }, [search, tableConfig, tableMode])

  const latestQueue = waitingReview.slice(0, 5)
  const urgentQueue = highRiskComplaints.slice(0, 4)

  if (loading) {
    return <div className="text-sm text-gray-500">Loading Affairs dashboard...</div>
  }

  return (
    <div className="space-y-7">
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {urgentQueue.length > 0 ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Affairs attention</p>
              <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-gray-900">
                <AlertTriangle className="text-red-600" size={24} />
                High priority or overdue complaints
              </h2>
            </div>
            <Link
              to="/affairs/complaints"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Open review page
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {urgentQueue.map((complaint) => (
              <div key={complaint.id} className="rounded-xl bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</p>
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                  {complaint.title || complaint.description}
                </p>
                <p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${
                  isComplaintOverdue(complaint) ? 'text-red-600' : 'text-amber-700'
                }`}>
                  {formatDaysRemaining(complaint)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DashboardHeader
        eyebrow="Affairs Dashboard"
        title="Student Affairs Review Desk"
        description={
          lastUpdated
            ? `Live review board for investigated complaints, overdue SLA cases, returned investigations, and admin escalation follow-up. Last updated ${lastUpdated.toLocaleTimeString()}.`
            : 'Live review board for investigated complaints, overdue SLA cases, returned investigations, and admin escalation follow-up.'
        }
        actions={
          <>
            <Link to="/affairs/complaints" className={dashboardHeaderPrimaryAction}>
              <ClipboardList size={17} />
              Review complaints
            </Link>
            <Link to="/affairs/reminders" className={dashboardHeaderSecondaryAction}>
              <Bell size={17} />
              Reminders
            </Link>
            <button onClick={() => loadData(false)} className={dashboardHeaderSecondaryAction}>
              <RefreshCw size={17} />
              Refresh
            </button>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Open complaints', allOpen.length, ClipboardList, 'text-gray-900'],
          ['Waiting review', waitingReview.length, TimerReset, 'text-[#2B85B7]'],
          ['Approved true', approvedComplaints.length, CheckCircle2, 'text-emerald-700'],
          ['Sent admin', sentToAdmin.length, Send, 'text-indigo-700'],
          ['Over SLA', overdueComplaints.length, AlertTriangle, 'text-red-600']
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

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Next to review</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900">Results sent to Affairs</h2>
            </div>
            <Link to="/affairs/complaints" className="text-sm font-semibold text-[#2B85B7]">
              Open
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {latestQueue.map((complaint) => {
              const investigation = latestMarkedNote(notes, complaint.id, NOTE_MARKERS.investigation)
              return (
                <div key={complaint.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</p>
                    <PriorityBadge priority={complaint.priority} />
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm text-gray-700">{complaint.title || complaint.description}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                    {stripWorkflowNote(investigation?.note) || 'Support officer sent this result to Affairs.'}
                  </p>
                </div>
              )
            })}
            {latestQueue.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                No investigated complaints are waiting for Affairs review.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dynamic work table</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900">{tableConfig[tableMode].label}</h2>
            </div>
            <div className="relative w-full sm:w-80">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#2B85B7]"
                placeholder="Search complaints"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(tableConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setTableMode(key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tableMode === key
                    ? 'bg-[#2B85B7] text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {config.label} ({config.rows.length})
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Complaint</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((complaint) => (
                  <tr key={complaint.id}>
                    <td className="font-semibold text-gray-900">{getComplaintCode(complaint)}</td>
                    <td>
                      <p className="font-medium text-gray-900">{complaint.title || 'Untitled complaint'}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-gray-500">{complaint.description}</p>
                    </td>
                    <td>{complaint.category || 'Other'}</td>
                    <td><PriorityBadge priority={complaint.priority} /></td>
                    <td><StatusPill status={statusOf(complaint)} /></td>
                    <td>{getSlaLabel(complaint)}</td>
                    <td className={isComplaintOverdue(complaint) ? 'font-semibold text-red-600' : ''}>
                      {isComplaintClosed(complaint) ? 'Solved' : formatDaysRemaining(complaint)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                No complaints found in this view.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
