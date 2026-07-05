import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Clock3,
  CheckCircle2,
  TrendingUp,
  Plus,
  ChevronRight,
  Activity
} from 'lucide-react'

import StatusPill from '../../components/StatusPill'
import PriorityBadge from '../../components/PriorityBadge'
import DashboardHeader, { dashboardHeaderPrimaryAction } from '../../components/DashboardHeader'
import api from '../../lib/api'
import { getAuthSession } from '../../lib/auth'

export default function Dashboard() {
  const [complaints, setComplaints] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  const formatComplaintId = (item) => {
    if (item?.complaint_code) return item.complaint_code
    if (item?.code) return item.code
    if (item?.id === null || item?.id === undefined) return 'N/A'
    return `CMP-${String(item.id).padStart(6, '0')}`
  }

  const getComplaintStatus = (item) => item?.effective_status || item?.status

  useEffect(() => {
    const fetchData = async () => {
      try {
        const session = getAuthSession()
        if (!session?.user?.id) return
        const preferredName =
          session.user.first_name ||
          session.user.full_name ||
          session.user.name ||
          session.user.username ||
          session.user.email?.split('@')[0] ||
          'Student'
        setUserName(preferredName)

        const response = await api.get(`/complaints/?student=${session.user.id}`)
        const userComplaints = response.data.results || response.data || []

        setComplaints(userComplaints.slice(0, 5))

        const total = userComplaints.length
        const resolved = userComplaints.filter(c => ['Resolved', 'Closed'].includes(getComplaintStatus(c))).length
        const pending = userComplaints.filter(c => ['Pending', 'Open'].includes(getComplaintStatus(c))).length
        const inProgress = userComplaints.filter(c => ['In Progress', 'Under Review'].includes(getComplaintStatus(c))).length

        setStats([
          { title: 'Total Complaints', value: total, icon: AlertCircle, tone: 'primary' },
          { title: 'Pending', value: pending, icon: Clock3, tone: 'pending' },
          { title: 'In Progress', value: inProgress, icon: Activity, tone: 'active' },
          { title: 'Resolved', value: resolved, icon: CheckCircle2, tone: 'resolved' }
        ])
      } catch (error) {
        console.error('Error fetching complaints:', error)
        setStats([
          { title: 'Total Complaints', value: '—', icon: AlertCircle, tone: 'primary' },
          { title: 'Pending', value: '—', icon: Clock3, tone: 'pending' },
          { title: 'In Progress', value: '—', icon: Activity, tone: 'active' },
          { title: 'Resolved', value: '—', icon: CheckCircle2, tone: 'resolved' }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded-lg mb-4"></div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
          <div className="mt-6 h-96 bg-gray-100 rounded-2xl"></div>
        </div>
      </div>
    )
  }

  const statTones = {
    primary: 'bg-[#EAF5FB] text-[#2B85B7]',
    pending: 'bg-amber-50 text-amber-600',
    active: 'bg-[#EAF5FB] text-[#2B85B7]',
    resolved: 'bg-emerald-50 text-emerald-600'
  }

  const getStatTone = (item) => {
    if (item.tone) return item.tone
    if (item.title === 'Pending') return 'pending'
    if (item.title === 'In Progress') return 'active'
    if (item.title === 'Resolved') return 'resolved'
    return 'primary'
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Welcome back"
        title={userName}
        description="Track your complaints, monitor progress, and get support all in one place."
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

      {/* Stats Grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats?.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-gray-200 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {item.title}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {item.value}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${statTones[getStatTone(item)]}`}>
                <item.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      
      {/* Recent Complaints Table - 12 COLUMNS (Full Width) */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Recent Complaints
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Your latest support requests
            </p>
          </div>
          <Link
            to="/student/complaints"
            className="flex items-center gap-1 text-sm font-medium text-[#2B85B7] hover:gap-2 transition-all"
          >
            View all
            <ChevronRight size={16} />
          </Link>
        </div>

        {complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <AlertCircle size={28} className="text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">No complaints yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Submit your first complaint to get started
            </p>
            <Link
              to="/student/complaints/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2B85B7] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={16} />
              New Complaint
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {complaints.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/student/complaints/${item.id}`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatComplaintId(item)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">
                        {item.title || item.subject || 'Untitled'}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                          {item.description.slice(0, 60)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={getComplaintStatus(item)} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.created_at 
                        ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary & Quick Actions - 6 COLUMNS EACH */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Left Column - Summary (6 columns) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Summary</h3>
            <TrendingUp size={18} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">Resolution rate</span>
              <span className="text-sm font-semibold text-gray-800">
                {stats && stats[3]?.value !== '—' && stats[0]?.value !== '—' && stats[0]?.value > 0
                  ? `${Math.round((stats[3].value / stats[0].value) * 100)}%`
                  : '—'
                }
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">Active complaints</span>
              <span className="text-sm font-semibold text-gray-800">
                {stats && stats[1]?.value !== '—' && stats[2]?.value !== '—'
                  ? (Number(stats[1].value) + Number(stats[2].value))
                  : '—'
                }
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Avg. response time</span>
              <span className="text-sm font-semibold text-gray-800">—</span>
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions (6 columns) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link 
              to="/student/complaints/new" 
              className="flex items-center justify-between w-full rounded-xl bg-[#2B85B7] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2376A4]"
            >
              <span>New Complaint</span>
              <Plus size={16} />
            </Link>
            <Link 
              to="/student/complaints" 
              className="flex items-center justify-between w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <span>My Complaints</span>
              <ChevronRight size={16} className="text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer - Support Contact Info */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h3 className="font-bold text-gray-800 mb-2">
          Need help?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Contact support team for urgent assistance
        </p>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1">
            <p className="text-xs text-gray-500">Email</p>
            <p className="font-medium text-gray-700">support@hormuud.edu</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Hours</p>
            <p className="font-medium text-gray-700">9AM - 5PM</p>
          </div>
        </div>
      </div>
    </div>
  )
}
