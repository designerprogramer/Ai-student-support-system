import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, Search, ShieldAlert } from 'lucide-react'
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
  isAdminVisibleComplaint,
  isComplaintClosed,
  isComplaintOverdue,
  normalizeKey
} from '../../lib/complaintWorkflow'

const priorityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
}

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [tableMode, setTableMode] = useState('difficult')

  useEffect(() => {
    const loadData = async () => {
      const [complaintData, noteData] = await Promise.all([fetchComplaints(), fetchNotes()])
      setComplaints(complaintData)
      setNotes(noteData)
    }
    loadData()
  }, [])

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

  const highEscalations = escalations.filter((item) => ['critical', 'high'].includes(normalizeKey(item.priority)))
  const adminComplaints = useMemo(
    () => complaints.filter((complaint) => isAdminVisibleComplaint(notes, complaint)),
    [complaints, notes]
  )
  const solvedComplaints = useMemo(
    () =>
      adminComplaints.filter(
        (complaint) =>
          isComplaintClosed(complaint) || hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse)
      ),
    [adminComplaints, notes]
  )
  const difficultComplaints = useMemo(
    () =>
      adminComplaints.filter(
        (complaint) =>
          ['critical', 'high'].includes(normalizeKey(complaint.priority)) ||
          isComplaintOverdue(complaint) ||
          isAdminVisibleComplaint(notes, complaint)
      ),
    [adminComplaints, notes]
  )
  const recurrentGroups = useMemo(() => {
    const groups = adminComplaints.reduce((acc, complaint) => {
      const key = `${complaint.category || 'Other'}-${complaint.student || 'unknown'}`
      if (!acc[key]) {
        acc[key] = {
          id: key,
          category: complaint.category || 'Other',
          student: complaint.student || 'Unknown',
          count: 0,
          latest: complaint,
          highCount: 0
        }
      }
      acc[key].count += 1
      if (['critical', 'high'].includes(normalizeKey(complaint.priority))) {
        acc[key].highCount += 1
      }
      if (new Date(complaint.created_at || 0) > new Date(acc[key].latest.created_at || 0)) {
        acc[key].latest = complaint
      }
      return acc
    }, {})

    return Object.values(groups)
      .filter((group) => group.count > 1)
      .sort((a, b) => b.count - a.count)
  }, [adminComplaints])
  const treatedComplaints = useMemo(
    () =>
      adminComplaints.filter(
        (complaint) =>
          hasNoteMarker(notes, complaint.id, NOTE_MARKERS.investigation) ||
          isAdminVisibleComplaint(notes, complaint) ||
          hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse) ||
          ['in_progress', 'escalated', 'resolved', 'closed'].includes(normalizeKey(complaint.status))
      ),
    [adminComplaints, notes]
  )

  const tableConfig = {
    solved: { label: 'Solved complaints', rows: solvedComplaints },
    difficult: { label: 'Most difficult complaints', rows: difficultComplaints },
    recurrent: { label: 'Recurrent complaints', rows: recurrentGroups },
    treated: { label: 'Solved or treated complaints', rows: treatedComplaints }
  }

  const dashboardRows = useMemo(() => {
    const rows = tableConfig[tableMode].rows
    const term = search.trim().toLowerCase()
    if (!term) return rows

    return rows.filter((row) => {
      if (tableMode === 'recurrent') {
        return `${row.category} ${row.student} ${getComplaintCode(row.latest)}`.toLowerCase().includes(term)
      }
      return `${getComplaintCode(row)} ${row.title || ''} ${row.description || ''} ${row.category || ''}`
        .toLowerCase()
        .includes(term)
    })
  }, [search, tableConfig, tableMode])

  return (
    <div className="space-y-7">
      {highEscalations.length > 0 ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-red-600">Escalated priority high</p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold text-gray-900">
                <ShieldAlert className="text-red-600" size={28} />
                Must solve now
              </h1>
            </div>
            <Link
              to="/admin/escalations"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Open escalations
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {highEscalations.slice(0, 4).map((complaint) => (
              <div key={complaint.id} className="rounded-xl bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{getComplaintCode(complaint)}</p>
                  <PriorityBadge priority={complaint.priority} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{complaint.title || complaint.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-600">
                  {formatDaysRemaining(complaint)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DashboardHeader
        eyebrow="Admin Dashboard"
        title="Welcome, Administrator"
        description="Start with the complaint list, then open escalations when Affairs sends a case or the response time is missed."
        actions={
          <>
            <Link
              to="/admin/complaints"
              className={dashboardHeaderPrimaryAction}
            >
              <ClipboardList size={17} />
              Open complaints
            </Link>
            <Link
              to="/admin/reminders"
              className={dashboardHeaderSecondaryAction}
            >
              <Bell size={17} />
              Reminders
            </Link>
            <Link
              to="/admin/reports"
              className={dashboardHeaderSecondaryAction}
            >
              <BarChart3 size={17} />
              Reports
            </Link>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Open Complaints</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{adminComplaints.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Active Escalations</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{escalations.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">High Priority Escalations</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{highEscalations.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Solved / Treated</p>
          <p className="mt-2 text-3xl font-bold text-green-700">{treatedComplaints.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Dashboard work table</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">{tableConfig[tableMode].label}</h2>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#2B85B7]"
              placeholder="Search table"
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
              {tableMode === 'recurrent' ? (
                <tr>
                  <th>Category</th>
                  <th>Student</th>
                  <th>Repeated</th>
                  <th>High Priority</th>
                  <th>Latest Complaint</th>
                  <th>Latest Status</th>
                </tr>
              ) : (
                <tr>
                  <th>Code</th>
                  <th>Complaint</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Time left</th>
                </tr>
              )}
            </thead>
            <tbody>
              {dashboardRows.map((row) =>
                tableMode === 'recurrent' ? (
                  <tr key={row.id}>
                    <td className="font-semibold text-gray-900">{row.category}</td>
                    <td>{row.student}</td>
                    <td>{row.count} times</td>
                    <td>{row.highCount}</td>
                    <td className="font-semibold text-gray-900">{getComplaintCode(row.latest)}</td>
                    <td><StatusPill status={row.latest.status} /></td>
                  </tr>
                ) : (
                  <tr key={row.id}>
                    <td className="font-semibold text-gray-900">{getComplaintCode(row)}</td>
                    <td>
                      <p className="font-medium text-gray-900">{row.title || 'Untitled complaint'}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-gray-500">{row.description}</p>
                    </td>
                    <td>{row.category || 'Other'}</td>
                    <td><PriorityBadge priority={row.priority} /></td>
                    <td><StatusPill status={row.status} /></td>
                    <td>{getSlaLabel(row)}</td>
                    <td>{isComplaintClosed(row) ? 'Solved' : formatDaysRemaining(row)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {dashboardRows.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
              No complaints found for this view.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
