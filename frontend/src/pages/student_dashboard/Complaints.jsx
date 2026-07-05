import { Link, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import {
  AlertCircle,
  Clock3,
  CheckCircle2,
  Activity,
  Search,
  Filter,
  Plus,
  RotateCcw,
  ChevronRight,
  CalendarDays
} from 'lucide-react'

import StatusPill from '../../components/StatusPill'
import PriorityBadge from '../../components/PriorityBadge'
import DashboardHeader, { dashboardHeaderPrimaryAction } from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession } from '../../lib/auth'

const DEFAULT_STATUSES = ['Pending', 'In Progress', 'Escalated', 'Resolved']
const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-gray-200 hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
        </div>

        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function TrackingSteps({ status }) {
  const steps = DEFAULT_STATUSES
  const normalizedStatus = getText(status)
  const currentIndex = steps.findIndex((step) => getText(step) === normalizedStatus)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const active = currentIndex >= 0 && index <= currentIndex

        return (
          <div key={step} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? 'bg-[#2B85B7] text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {index + 1}
            </span>

            <span
              className={`text-xs font-medium ${
                active ? 'text-gray-800' : 'text-gray-400'
              }`}
            >
              {step}
            </span>

            {index < steps.length - 1 && (
              <span className="hidden h-px w-8 bg-gray-200 sm:block" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function getText(value) {
  return String(value || '').trim().toLowerCase()
}

export default function Complaints() {
  const navigate = useNavigate()

  const [complaints, setComplaints] = useState([])
  const [filteredComplaints, setFilteredComplaints] = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [priorityOptions, setPriorityOptions] = useState([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  })

  const formatComplaintId = (item) => {
    if (item?.complaint_code) return item.complaint_code
    if (item?.code) return item.code
    if (item?.id === null || item?.id === undefined) return 'N/A'

    const year = item.created_at
      ? new Date(item.created_at).getFullYear()
      : new Date().getFullYear()

    return `CMP-${year}-${String(item.id).padStart(6, '0')}`
  }

  const getTextValue = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      return value.name || value.title || value.label || String(value.id || '')
    }
    return String(value)
  }

  const getComplaintStatus = (item) => getTextValue(item?.effective_status || item?.status)

  const normalizeValue = (value) => getTextValue(value).trim().toLowerCase()

  const normalizeKey = (value) => normalizeValue(value).replace(/[^a-z0-9]/g, '')

  const statusMatches = (itemStatus, selectedStatus) => {
    const status = normalizeKey(itemStatus)
    const selected = normalizeKey(selectedStatus)

    if (!selected) return true

    const statusGroups = {
      pending: ['pending', 'open', 'new', 'submitted'],
      inprogress: ['inprogress', 'underreview', 'review', 'investigating', 'assigned'],
      escalated: ['escalated', 'escalat', 'senttoadmin', 'adminreview'],
      resolved: ['resolved', 'closed', 'complete', 'completed']
    }

    const allowedStatuses = statusGroups[selected] || [selected]
    return allowedStatuses.some((allowedStatus) => status.includes(allowedStatus))
  }

  const priorityMatches = (itemPriority, selectedPriority) => {
    const priority = normalizeKey(itemPriority)
    const selected = normalizeKey(selectedPriority)

    if (!selected) return true
    if (selected === 'critical') {
      return ['critical', 'urgent', 'emergency'].some((allowedPriority) =>
        priority.includes(allowedPriority)
      )
    }

    return priority === selected || priority.includes(selected)
  }

  const uniqueNames = (items) => {
    const seen = new Set()

    return items
      .map(getTextValue)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  const fetchAllPages = async (url) => {
    const allItems = []
    let nextUrl = url

    while (nextUrl) {
      const response = await api.get(nextUrl)
      const payload = response.data

      if (Array.isArray(payload)) {
        allItems.push(...payload)
        nextUrl = null
      } else {
        allItems.push(...(payload.results || []))
        nextUrl = payload.next
      }
    }

    return allItems
  }

  const formatDate = (date) => {
    if (!date) return '—'

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatShortDate = (date) => {
    if (!date) return '—'

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const session = getAuthSession()

        if (!session?.user?.id) {
          setLoading(false)
          return
        }

        const data = await fetchAllPages(`/complaints/?student=${session.user.id}`)
        const [statusesResult, prioritiesResult] = await Promise.allSettled([
          fetchAllPages('/statuses/'),
          fetchAllPages('/priorities/')
        ])

        setComplaints(data)
        setFilteredComplaints(data)
        setStatusOptions(
          statusesResult.status === 'fulfilled' ? uniqueNames(statusesResult.value) : []
        )
        setPriorityOptions(
          prioritiesResult.status === 'fulfilled' ? uniqueNames(prioritiesResult.value) : []
        )
      } catch (error) {
        console.error('Error fetching complaints:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchComplaints()
  }, [])

  useEffect(() => {
    let filtered = complaints

    if (filters.status) {
      filtered = filtered.filter((item) => statusMatches(getComplaintStatus(item), filters.status))
    }

    if (filters.priority) {
      filtered = filtered.filter((item) => priorityMatches(item.priority, filters.priority))
    }

    if (filters.search) {
      const searchText = filters.search.toLowerCase()

      filtered = filtered.filter((item) => {
        const complaintId = formatComplaintId(item).toLowerCase()
        const title = getTextValue(item.title).toLowerCase()
        const description = getTextValue(item.description).toLowerCase()
        const category = getTextValue(item.category).toLowerCase()

        return (
          complaintId.includes(searchText) ||
          title.includes(searchText) ||
          description.includes(searchText) ||
          category.includes(searchText)
        )
      })
    }

    setFilteredComplaints(filtered)
  }, [complaints, filters])

  const availableStatuses = useMemo(() => {
    const fromComplaints = uniqueNames(complaints.map(getComplaintStatus))
    return uniqueNames([...DEFAULT_STATUSES, ...statusOptions, ...fromComplaints])
  }, [complaints, statusOptions])

  const availablePriorities = useMemo(() => {
    const fromComplaints = uniqueNames(complaints.map((item) => item.priority))
    return uniqueNames([...DEFAULT_PRIORITIES, ...priorityOptions, ...fromComplaints])
  }, [complaints, priorityOptions])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const total = complaints.length
  const pending = complaints.filter((item) => {
    const status = normalizeValue(getComplaintStatus(item))
    return status === 'pending' || status === 'open'
  }).length

  const inProgress = complaints.filter((item) => {
    const status = normalizeValue(getComplaintStatus(item))
    return status === 'in progress' || status === 'under review'
  }).length

  const resolved = complaints.filter((item) => {
    const status = normalizeValue(getComplaintStatus(item))
    return status === 'resolved' || status === 'closed'
  }).length

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      search: ''
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-7">
          <div className="h-7 w-52 rounded-lg bg-gray-100" />
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
        eyebrow="Student Complaint Tracking"
        title="My Complaints"
        description="View your submitted complaints, track progress, and follow every update from one place."
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

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Complaints"
          value={total}
          icon={AlertCircle}
          color="#2B85B7"
        />

        <StatCard
          title="Pending"
          value={pending}
          icon={Clock3}
          color="#F59E0B"
        />

        <StatCard
          title="In Progress"
          value={inProgress}
          icon={Activity}
          color="#3B82F6"
        />

        <StatCard
          title="Resolved"
          value={resolved}
          icon={CheckCircle2}
          color="#10B981"
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
          <Filter size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-800">
            Filter Complaints
          </h2>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
              placeholder="Search by complaint code, title, description, or category..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          <select
            className="h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700 outline-none transition focus:border-[#2B85B7] focus:bg-white"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="">All Priority</option>
            {availablePriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-800">
              {filteredComplaints.length}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-800">
              {total}
            </span>{' '}
            complaints
          </p>

          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <RotateCcw size={15} />
            Clear
          </button>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Complaint List
            </h2>

            <p className="mt-0.5 text-sm text-gray-500">
              Click any complaint to view more details.
            </p>
          </div>
        </div>

        {filteredComplaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <AlertCircle size={28} className="text-gray-400" />
            </div>

            <h3 className="text-base font-semibold text-gray-700">
              No complaints found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-gray-500">
              You have not submitted any complaint yet, or no complaint matches your current filters.
            </p>

            <Link
              to="/student/complaints/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2B85B7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2376A4]"
            >
              <Plus size={16} />
              Submit Complaint
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Code
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Complaint
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Category
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Priority
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Date
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {filteredComplaints.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/student/complaints/${item.id}`)}
                      className="cursor-pointer transition hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatComplaintId(item)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="max-w-sm">
                          <p className="text-sm font-semibold text-gray-800">
                            {item.title || item.subject || 'Untitled Complaint'}
                          </p>

                          {item.description && (
                            <p className="mt-1 truncate text-xs text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getTextValue(item.category) || '—'}
                      </td>

                      <td className="px-6 py-4">
                        <PriorityBadge priority={getTextValue(item.priority)} />
                      </td>

                      <td className="px-6 py-4">
                        <StatusPill status={getComplaintStatus(item)} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays size={15} />
                          {formatShortDate(item.created_at)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/student/complaints/${item.id}`)
                          }}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#2B85B7]"
                        >
                          View
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 p-4 lg:hidden">
              {filteredComplaints.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/student/complaints/${item.id}`)}
                  className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-gray-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#2B85B7]">
                        {formatComplaintId(item)}
                      </p>

                      <h3 className="mt-2 text-base font-bold text-gray-800">
                        {item.title || item.subject || 'Untitled Complaint'}
                      </h3>
                    </div>

                    <ChevronRight size={18} className="text-gray-400" />
                  </div>

                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <PriorityBadge priority={getTextValue(item.priority)} />
                    <StatusPill status={getComplaintStatus(item)} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Category: {getTextValue(item.category) || '—'}</span>
                    <span>Created: {formatDate(item.created_at)}</span>
                  </div>

                  <TrackingSteps status={getComplaintStatus(item)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-gray-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2B85B7]">
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Need immediate assistance?</h3>
            <p className="mt-1 text-sm text-gray-600">
              For urgent issues, please contact the support desk directly at{' '}
              <a href="tel:+252614142187" className="text-[#2B85B7] hover:underline">+252 614 142 187</a>
              {' '}or visit the student support office during working hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
