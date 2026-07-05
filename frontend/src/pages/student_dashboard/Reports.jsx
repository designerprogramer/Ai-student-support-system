import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  TrendingUp
} from 'lucide-react'

import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import DashboardHeader, { dashboardHeaderPrimaryAction } from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession } from '../../lib/auth'

const statusOrder = ['Pending', 'In Progress', 'Escalated', 'Resolved', 'Closed']

function getText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value.name || value.title || value.label || String(value.id || '')
  return String(value)
}

function normalizeKey(value) {
  return getText(value).trim().toLowerCase().replace(/\s+/g, '_')
}

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatComplaintCode(item) {
  if (item?.complaint_code) return item.complaint_code
  if (item?.code) return item.code
  return `CMP-${item?.id || 'N/A'}`
}

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const label = getText(getter(item)) || 'Unknown'
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
}

function StatCard({ title, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-gray-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, total, color = 'bg-[#2B85B7]' }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{value} ({percent}%)</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export default function Reports() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const session = getAuthSession()
        if (!session?.user?.id) return

        const response = await api.get(`/complaints/?student=${session.user.id}`)
        setComplaints(response.data.results || response.data || [])
      } catch (error) {
        console.error('Error fetching complaints:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchComplaints()
  }, [])

  const report = useMemo(() => {
    const total = complaints.length
    const resolved = complaints.filter((item) => ['resolved', 'closed'].includes(normalizeKey(item.effective_status || item.status))).length
    const pending = complaints.filter((item) => ['pending', 'open'].includes(normalizeKey(item.effective_status || item.status))).length
    const inProgress = complaints.filter((item) => ['in_progress', 'under_review'].includes(normalizeKey(item.effective_status || item.status))).length
    const escalated = complaints.filter((item) => normalizeKey(item.effective_status || item.status) === 'escalated').length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    const categoryRows = Object.entries(countBy(complaints, (item) => item.category))
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    const priorityRows = Object.entries(countBy(complaints, (item) => item.priority))
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    const statusRows = statusOrder.map((label) => ({
      label,
      count: complaints.filter((item) => normalizeKey(item.effective_status || item.status) === normalizeKey(label)).length
    })).filter((row) => row.count > 0)

    const recent = [...complaints]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 6)

    return {
      total,
      resolved,
      pending,
      inProgress,
      escalated,
      active: Math.max(0, total - resolved),
      resolutionRate,
      categoryRows,
      priorityRows,
      statusRows,
      recent
    }
  }, [complaints])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-7">
          <div className="h-7 w-56 rounded-lg bg-gray-100" />
          <div className="mt-4 h-4 w-96 rounded-lg bg-gray-100" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-gray-100" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Student Reports"
        title="Complaint insights"
        description="Review your complaint activity, resolution progress, common categories, and recent updates."
        actions={
          <Link
            to="/student/complaints/new"
            className={dashboardHeaderPrimaryAction}
          >
            <Plus size={18} />
            New Complaint
          </Link>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Complaints" value={report.total} icon={FileText} tone="bg-[#EAF5FB] text-[#2B85B7]" />
        <StatCard title="Active" value={report.active} icon={Activity} tone="bg-blue-50 text-blue-600" />
        <StatCard title="Escalated" value={report.escalated} icon={AlertCircle} tone="bg-red-50 text-red-600" />
        <StatCard title="Resolution Rate" value={`${report.resolutionRate}%`} icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Status breakdown</h2>
              <p className="mt-1 text-sm text-gray-500">How your complaints are distributed now.</p>
            </div>
            <BarChart3 size={20} className="text-gray-400" />
          </div>

          <div className="mt-6 space-y-5">
            <ProgressRow label="Resolved or closed" value={report.resolved} total={report.total} color="bg-emerald-500" />
            <ProgressRow label="In progress" value={report.inProgress} total={report.total} color="bg-blue-500" />
            <ProgressRow label="Pending" value={report.pending} total={report.total} color="bg-amber-500" />
            <ProgressRow label="Escalated" value={report.escalated} total={report.total} color="bg-red-500" />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Current statuses</h2>
              <p className="mt-1 text-sm text-gray-500">Live status count from your records.</p>
            </div>
            <CheckCircle2 size={20} className="text-gray-400" />
          </div>

          <div className="mt-5 space-y-3">
            {report.statusRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <StatusPill status={row.label} />
                <span className="text-sm font-bold text-gray-800">{row.count}</span>
              </div>
            ))}
            {report.statusRows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No status data yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-800">Top categories</h2>
          <div className="mt-5 space-y-4">
            {report.categoryRows.slice(0, 6).map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.count} total={report.total} />
            ))}
            {report.categoryRows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No category data yet.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-800">Priority mix</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {report.priorityRows.map((row) => (
              <div key={row.label} className="rounded-xl bg-gray-50 p-4">
                <PriorityBadge priority={row.label} />
                <p className="mt-3 text-2xl font-bold text-gray-800">{row.count}</p>
                <p className="mt-1 text-xs text-gray-500">complaints</p>
              </div>
            ))}
            {report.priorityRows.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No priority data yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Recent report activity</h2>
            <p className="mt-0.5 text-sm text-gray-500">Your latest complaint updates.</p>
          </div>
          <Link to="/student/complaints" className="text-sm font-semibold text-[#2B85B7]">
            View all
          </Link>
        </div>

        {report.recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <FileText size={28} className="text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">No report data yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">Submit a complaint to start building your report history.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Complaint</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.recent.map((item) => (
                  <tr key={item.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">{formatComplaintCode(item)}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-800">{item.title || 'Untitled Complaint'}</p>
                      <p className="mt-1 max-w-md truncate text-xs text-gray-500">{item.description}</p>
                    </td>
                    <td className="px-6 py-4"><PriorityBadge priority={getText(item.priority)} /></td>
                    <td className="px-6 py-4"><StatusPill status={getText(item.effective_status || item.status)} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <CalendarDays size={15} />
                        {formatDate(item.updated_at || item.created_at)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gray-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2B85B7]">
            <Clock3 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Report note</h3>
            <p className="mt-1 text-sm text-gray-600">
              These numbers update from your complaint records. Resolved and closed complaints count toward the resolution rate.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
