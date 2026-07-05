import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Clock,
  ShieldAlert,
  CheckCircle2,
  MessageSquare,
  PlusCircle,
  UserCheck,
  RefreshCw,
  TrendingUp,
  Inbox
} from 'lucide-react'
import PriorityBadge from '../../components/PriorityBadge'
import StatusPill from '../../components/StatusPill'
import DashboardHeader from '../../components/DashboardHeader'
import { getAuthSession } from '../../lib/auth'
import {
  fetchComplaints,
  fetchNotifications,
  fetchAssignments,
  getComplaintCode,
  getDueDate,
  getDaysRemaining,
  getSlaLabel,
  isComplaintClosed,
  isComplaintOverdue
} from '../../lib/complaintWorkflow'

const VISIBLE_NOTIFICATION_COUNT = 4

export default function SupportOfficerReminders() {
  const [complaints, setComplaints] = useState([])
  const [assignments, setAssignments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'unread'
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  const currentUser = useMemo(() => getAuthSession()?.user, [])

  const loadData = async () => {
    try {
      const [complaintData, notificationData, assignmentData] = await Promise.all([
        fetchComplaints(),
        fetchNotifications(),
        fetchAssignments()
      ])
      setComplaints(complaintData)
      setNotifications(notificationData)
      setAssignments(assignmentData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSeeAllNotifications = async () => {
    setShowAllNotifications(true)
    setActiveTab('all')
  }

  const myAssignedComplaints = useMemo(() => {
    if (!currentUser?.id) return []
    const myAssignedIds = new Set(
      assignments
        .filter((a) => Number(a.assigned_to) === Number(currentUser.id) && !a.unassigned_at)
        .map((a) => Number(a.complaint))
    )
    return complaints.filter((c) => myAssignedIds.has(Number(c.id)))
  }, [complaints, assignments, currentUser])

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.is_read)
    }
    return notifications
  }, [notifications, activeTab])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])
  const visibleNotifications = showAllNotifications
    ? filteredNotifications
    : filteredNotifications.slice(0, VISIBLE_NOTIFICATION_COUNT)
  const hiddenNotificationCount = Math.max(filteredNotifications.length - visibleNotifications.length, 0)

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  const getNotificationIcon = (title = '', type = '') => {
    const text = (title + ' ' + type).toLowerCase()
    if (text.includes('assign') || text.includes('officer')) {
      return <UserCheck className="h-5 w-5 text-indigo-500" />
    }
    if (text.includes('submit') || text.includes('new')) {
      return <PlusCircle className="h-5 w-5 text-green-500" />
    }
    if (text.includes('review') || text.includes('note') || text.includes('response') || text.includes('comment')) {
      return <MessageSquare className="h-5 w-5 text-blue-500" />
    }
    if (text.includes('escalat') || text.includes('admin')) {
      return <TrendingUp className="h-5 w-5 text-[#2B85B7]" />
    }
    if (text.includes('status') || text.includes('updat')) {
      return <RefreshCw className="h-5 w-5 text-amber-500" />
    }
    return <Bell className="h-5 w-5 text-gray-500" />
  }

  const getReminderTone = (complaint) => {
    const daysRemaining = getDaysRemaining(complaint)
    if (isComplaintClosed(complaint)) return 'bg-emerald-50 border border-emerald-100 text-emerald-800'
    if (daysRemaining === null || daysRemaining <= 1) return 'bg-rose-50 border border-rose-100 text-rose-800'
    if (daysRemaining <= 3) return 'bg-amber-50 border border-amber-100 text-amber-800'
    return 'bg-slate-50 border border-slate-100 text-slate-800'
  }

  const getReminderLabel = (complaint) => {
    const daysRemaining = getDaysRemaining(complaint)
    if (isComplaintClosed(complaint)) return 'Resolved'
    if (daysRemaining === null) return 'No due date'
    if (daysRemaining < 0) return 'Overdue response'
    if (daysRemaining === 0) return 'Response due today'
    if (daysRemaining === 1) return 'Response due tomorrow'
    return `${daysRemaining} days left`
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <span className="ml-3 text-sm text-gray-500 font-medium">Loading reminders...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <DashboardHeader
        eyebrow="Support Officer Panel"
        title="Reminders & Alerts"
        description="Monitor and prioritize your assigned complaints, track upcoming SLA resolution deadlines, and receive instant activity alerts."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Notification Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#2B85B7]" />
                Support Notification Feed
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Real-time action and assign items</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-100">
                <button
                  onClick={() => {
                    setActiveTab('all')
                    setShowAllNotifications(false)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'all'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setActiveTab('unread')
                    setShowAllNotifications(false)
                  }}
                  className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'unread'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Unread
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`group flex items-start gap-4 rounded-2xl border p-4 transition duration-200 ${
                  notif.is_read
                    ? 'border-gray-50 bg-gray-50/50 hover:bg-gray-50'
                    : 'border-indigo-100 bg-[#F9F8FF] hover:bg-[#F3F0FF] shadow-sm'
                }`}
              >
                <div className={`rounded-xl p-2.5 transition ${
                  notif.is_read ? 'bg-white text-gray-400' : 'bg-white shadow-sm'
                }`}>
                  {getNotificationIcon(notif.payload?.title, notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold truncate ${
                      notif.is_read ? 'text-gray-600' : 'text-gray-900'
                    }`}>
                      {notif.payload?.title || 'System Alert'}
                    </p>
                    <span className="text-xs text-gray-400 font-medium shrink-0">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs leading-relaxed ${
                    notif.is_read ? 'text-gray-500' : 'text-gray-700'
                  }`}>
                    {notif.payload?.message}
                  </p>
                  {notif.payload?.complaint_code && (
                    <span className="mt-2 inline-flex items-center rounded-md bg-white border border-gray-150 px-2 py-0.5 text-[10px] font-bold text-indigo-600 shadow-sm">
                      {notif.payload.complaint_code}
                    </span>
                  )}
                </div>

                {!notif.is_read && (
                  <div className="h-2 w-2 rounded-full bg-indigo-500 self-center shrink-0 animate-pulse"></div>
                )}
              </div>
            ))}

            {hiddenNotificationCount > 0 ? (
              <button
                onClick={handleSeeAllNotifications}
                className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
              >
                See all {filteredNotifications.length} messages
              </button>
            ) : null}

            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-gray-50 p-4 border border-gray-100">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-gray-900">All caught up!</h3>
                <p className="mt-1 text-xs text-gray-500">You have no new notifications.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: SLA Deadlines / Reminders (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="border-b border-gray-100 pb-5">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#2B85B7]" />
              My Active SLAs
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Complaints assigned to you</p>
          </div>

          <div className="mt-5 space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {myAssignedComplaints.map((complaint) => {
              const dueDate = getDueDate(complaint)
              return (
                <div
                  key={complaint.id}
                  className="rounded-2xl border border-gray-150 bg-white p-4 shadow-sm hover:shadow-md transition duration-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-indigo-600">{getComplaintCode(complaint)}</span>
                    <div className="flex gap-1.5">
                      <PriorityBadge priority={complaint.priority} />
                      <StatusPill status={complaint.status} />
                    </div>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-gray-900 line-clamp-1">{complaint.title || 'Untitled Complaint'}</h3>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">{complaint.description}</p>

                  <div className="mt-4 flex items-center gap-2">
                    <div className={`flex flex-1 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${getReminderTone(complaint)}`}>
                      {isComplaintOverdue(complaint) ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 animate-bounce" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0" />
                      )}
                      <span>{getReminderLabel(complaint)}</span>
                    </div>
                  </div>

                  {!isComplaintClosed(complaint) && dueDate && (
                    <div className="mt-3 border-t border-gray-50 pt-3 flex items-center justify-between text-[11px] text-gray-400 font-medium">
                      <span>Response SLA target:</span>
                      <span className="text-gray-600 font-bold">{dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              )
            })}

            {myAssignedComplaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-gray-50 p-4 border border-gray-100">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-gray-900">No active complaints</h3>
                <p className="mt-1 text-xs text-gray-500">No complaints currently assigned to you.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
