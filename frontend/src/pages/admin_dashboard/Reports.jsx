import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, ShieldAlert } from 'lucide-react'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import DashboardHeader, { dashboardHeaderPrimaryAction, dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import {
  NOTE_MARKERS,
  fetchComplaints,
  fetchNotes,
  fetchReportSummary,
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

const countBy = (items, getter) =>
  items.reduce((acc, item) => {
    const key = getter(item) || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

const toRows = (counts) =>
  Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

export default function AdminReports() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [reportSummary, setReportSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('all')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [complaintData, noteData, summaryData] = await Promise.all([
          fetchComplaints(),
          fetchNotes(),
          fetchReportSummary()
        ])
        setComplaints(complaintData)
        setNotes(noteData)
        setReportSummary(summaryData)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredComplaints = useMemo(() => {
    const adminComplaints = complaints.filter((complaint) => isAdminVisibleComplaint(notes, complaint))
    if (range === 'all') return adminComplaints
    const days = range === 'week' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return adminComplaints.filter((complaint) => new Date(complaint.created_at || 0) >= cutoff)
  }, [complaints, notes, range])

  const escalatedComplaints = useMemo(
    () => filteredComplaints.filter(isComplaintOverdue),
    [filteredComplaints]
  )
  const solvedComplaints = useMemo(
    () =>
      filteredComplaints.filter(
        (complaint) =>
          isComplaintClosed(complaint) || hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse)
      ),
    [filteredComplaints, notes]
  )
  const treatedComplaints = useMemo(
    () =>
      filteredComplaints.filter(
        (complaint) =>
          hasNoteMarker(notes, complaint.id, NOTE_MARKERS.investigation) ||
          isAdminVisibleComplaint(notes, complaint) ||
          hasNoteMarker(notes, complaint.id, NOTE_MARKERS.adminResponse) ||
          ['in_progress', 'escalated', 'resolved', 'closed'].includes(normalizeKey(complaint.status))
      ),
    [filteredComplaints, notes]
  )
  const overdueComplaints = useMemo(() => filteredComplaints.filter(isComplaintOverdue), [filteredComplaints])
  const difficultComplaints = useMemo(
    () =>
      filteredComplaints.filter(
        (complaint) =>
          ['critical', 'high'].includes(normalizeKey(complaint.priority)) ||
          isAdminVisibleComplaint(notes, complaint) ||
          isComplaintOverdue(complaint)
      ),
    [filteredComplaints, notes]
  )
  const recurrentRows = useMemo(() => {
    const groups = filteredComplaints.reduce((acc, complaint) => {
      const key = `${complaint.category || 'Other'}-${complaint.student || 'unknown'}`
      if (!acc[key]) {
        acc[key] = {
          id: key,
          category: complaint.category || 'Other',
          student: complaint.student || 'Unknown',
          count: 0,
          latest: complaint
        }
      }
      acc[key].count += 1
      if (new Date(complaint.created_at || 0) > new Date(acc[key].latest.created_at || 0)) {
        acc[key].latest = complaint
      }
      return acc
    }, {})

    return Object.values(groups)
      .filter((group) => group.count > 1)
      .sort((a, b) => b.count - a.count)
  }, [filteredComplaints])

  const categoryRows = toRows(countBy(filteredComplaints, (item) => item.category || 'Other'))
  const priorityRows = toRows(countBy(filteredComplaints, (item) => item.priority || 'Unknown'))
  const statusRows = toRows(countBy(filteredComplaints, (item) => item.status || 'Unknown'))
  const maxCategoryCount = Math.max(1, ...categoryRows.map((row) => row.count))
  const stats = reportSummary?.stats || {}
  const transferredRows = reportSummary?.transferred_complaints || []

  const exportCsv = () => {
    const header = ['Code', 'Title', 'Category', 'Priority', 'Status', 'SLA', 'Days Remaining']
    const rows = filteredComplaints.map((complaint) => [
      getComplaintCode(complaint),
      complaint.title || '',
      complaint.category || '',
      complaint.priority || '',
      complaint.status || '',
      getSlaLabel(complaint),
      formatDaysRemaining(complaint)
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${`${cell ?? ''}`.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `admin-complaint-report-${range}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading reports...</div>
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Admin reports"
        title="Complaint performance report"
        description="Live report for solved, treated, recurrent, difficult, overdue, and escalated complaints."
        actions={
          <>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-12 rounded-xl border border-white/30 bg-white px-4 text-sm text-[#2B85B7] outline-none"
            >
              <option value="all">All time</option>
              <option value="month">Last 30 days</option>
              <option value="week">Last 7 days</option>
            </select>
            <button
              onClick={exportCsv}
              className={dashboardHeaderSecondaryAction}
            >
              <Download size={17} />
              Export CSV
            </button>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Submitted', stats.submitted ?? filteredComplaints.length, 'text-gray-900'],
          ['Solved', stats.solved ?? solvedComplaints.length, 'text-green-700'],
          ['Treated', stats.treated ?? treatedComplaints.length, 'text-[#2B85B7]'],
          ['Transferred', stats.transferred ?? transferredRows.length, 'text-indigo-700'],
          ['Overdue', stats.overdue ?? overdueComplaints.length, 'text-red-600']
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900">Transferred complaints</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>From</th>
                <th>To role</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transferredRows.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="font-semibold text-gray-900">{transfer.complaint_code}</td>
                  <td>{transfer.transferred_by_name || 'Staff'}</td>
                  <td>{transfer.transferred_to_role_name || transfer.transferred_to_name || 'Manager'}</td>
                  <td className="max-w-md truncate">{transfer.reason || 'Higher-level review'}</td>
                  <td>{transfer.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transferredRows.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No transferred complaints yet.</div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Category report</h2>
          <div className="mt-5 space-y-4">
            {categoryRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{row.label}</span>
                  <span className="text-gray-500">{row.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-[#2B85B7]"
                    style={{ width: `${(row.count / maxCategoryCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {categoryRows.length === 0 ? <p className="text-sm text-gray-500">No category data.</p> : null}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Priority</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {priorityRows.map((row) => (
                <div key={row.label} className="rounded-xl bg-gray-50 p-3">
                  <PriorityBadge priority={row.label} />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{row.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {statusRows.map((row) => (
                <div key={row.label} className="rounded-xl bg-gray-50 p-3">
                  <StatusPill status={row.label} />
                  <p className="mt-2 text-2xl font-bold text-gray-900">{row.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Most difficult complaints</h2>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Time left</th>
                </tr>
              </thead>
              <tbody>
                {difficultComplaints.slice(0, 8).map((complaint) => (
                  <tr key={complaint.id}>
                    <td className="font-semibold text-gray-900">{getComplaintCode(complaint)}</td>
                    <td><PriorityBadge priority={complaint.priority} /></td>
                    <td><StatusPill status={complaint.status} /></td>
                    <td>{isComplaintClosed(complaint) ? 'Solved' : formatDaysRemaining(complaint)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Recurrent complaints</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Student</th>
                  <th>Repeated</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {recurrentRows.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-gray-900">{row.category}</td>
                    <td>{row.student}</td>
                    <td>{row.count} times</td>
                    <td>{getComplaintCode(row.latest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recurrentRows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No recurrent complaint patterns found.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
