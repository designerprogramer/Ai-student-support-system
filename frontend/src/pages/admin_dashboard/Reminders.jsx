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
import {
  fetchComplaints,
  fetchNotes,
  fetchNotifications,
  getComplaintCode,
  getDueDate,
  getDaysRemaining,
  getSlaLabel,
  isAdminVisibleComplaint,
  isComplaintClosed,
  isComplaintOverdue
} from '../../lib/complaintWorkflow'

const VISIBLE_NOTIFICATION_COUNT = 4

export default function AdminReminders() {
  const [complaints, setComplaints] = useState([])
  const [notes, setNotes] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'unread'
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  const loadData = async () => {
    try {
      const [complaintData, noteData, notificationData] = await Promise.all([
        fetchComplaints(),
        fetchNotes(),
        fetchNotifications()
      ])
      setComplaints(complaintData)
      setNotes(noteData)
      setNotifications(notificationData)
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

  const adminComplaints = useMemo(() => {
    return complaints.filter((c) => isAdminVisibleComplaint(notes, c))
  }, [complaints, notes])

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
        eyebrow="System Administrator Panel"
        title="Reminders & Notifications"
        description="Monitor admin escalations and critical response SLAs, track unread system logs and workflow notifications."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Notification Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-[32px] border border-gray-200/70 p-6 shadow-[0_24px_90px_-40px_rgba(15,23,42,0.25)] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#E4F4EB] bg-[#F5FBF7] p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-[#0F6A4B] flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#168055]" />
                Admin Notification Feed
              </h2>
              <p className="text-sm text-gray-500 mt-1">Real-time system events styled with your brand palette.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full bg-white border border-gray-200 p-1 shadow-sm">
                <button
                  onClick={() => {
                    setActiveTab('all')
                    setShowAllNotifications(false)
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeTab === 'all'
                      ? 'bg-[#168055] text-white shadow-lg'
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
                  className={`relative rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeTab === 'unread'
                      ? 'bg-[#168055] text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Unread
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4 max-h-[620px] overflow-y-auto pr-2">
            {visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`group flex items-start gap-4 rounded-[32px] border p-5 transition duration-200 ${
                  notif.is_read
                    ? 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    : 'border-[#D8F0E2] bg-[#F4FBF6] shadow-sm hover:shadow-md'
                }`}
              >
                <div className={`rounded-3xl p-3 ${notif.is_read ? 'bg-white text-gray-400' : 'bg-white shadow-sm'}`}>
                  {getNotificationIcon(notif.payload?.title, notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                      {notif.payload?.title || 'System Alert'}
                    </p>
                    <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold shrink-0">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${notif.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                    {notif.payload?.message}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {notif.payload?.complaint_code && (
                      <span className="inline-flex items-center rounded-full bg-[#E9F9EE] px-3 py-1 text-[11px] font-semibold text-[#0F6A4B] shadow-sm">
                        {notif.payload.complaint_code}
                      </span>
                    )}
                    {notif.type && (
                      <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-gray-600 border border-gray-200">
                        {notif.type}
                      </span>
                    )}
                  </div>
                </div>

                {!notif.is_read && (
                  <div className="h-3 w-3 rounded-full bg-[#168055] self-center shrink-0 shadow-lg"></div>
                )}
              </div>
            ))}

            {hiddenNotificationCount > 0 ? (
              <button
                onClick={handleSeeAllNotifications}
                className="w-full rounded-[28px] bg-[#168055] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f6a4b]"
              >
                See all {filteredNotifications.length} messages
              </button>
            ) : null}

            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-[#F5F9F4] p-5 border border-[#E8F3EA]">
                  <Inbox className="h-8 w-8 text-[#168055]" />
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">All caught up!</h3>
                <p className="mt-2 text-sm text-gray-500">You have no new notifications.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: SLA Deadlines / Reminders (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-[32px] border border-gray-200/70 p-6 shadow-[0_24px_90px_-40px_rgba(15,23,42,0.25)] flex flex-col">
          <div className="rounded-[28px] border border-[#E4F4EB] bg-[#F5FBF7] p-5 shadow-sm">
            <h2 className="text-xl font-bold text-[#0F6A4B] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#168055]" />
              Escalation SLA Targets
            </h2>
            <p className="text-sm text-gray-500 mt-1">Complaints requiring admin support.</p>
          </div>

          <div className="mt-5 space-y-4 max-h-[620px] overflow-y-auto pr-2">
            {adminComplaints.map((complaint) => {
              const dueDate = getDueDate(complaint)
              return (
                <div
                  key={complaint.id}
                  className="rounded-[28px] border border-gray-150 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#168055] bg-[#E9F9EE] rounded-full px-2.5 py-1.5">
                      {getComplaintCode(complaint)}
                    </span>
                    <div className="flex gap-1.5">
                      <PriorityBadge priority={complaint.priority} />
                      <StatusPill status={complaint.status} />
                    </div>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-gray-900 line-clamp-1">{complaint.title || 'Untitled Complaint'}</h3>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2 leading-relaxed">{complaint.description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className={`flex flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${getReminderTone(complaint)}`}>
                      {isComplaintOverdue(complaint) ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 animate-bounce" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0" />
                      )}
                      <span>{getReminderLabel(complaint)}</span>
                    </div>
                  </div>

                  {!isComplaintClosed(complaint) && dueDate && (
                    <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-500">
                      <div className="flex items-center justify-between gap-2">
                        <span>Response SLA target</span>
                        <span className="text-gray-700 font-semibold">{dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {adminComplaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-gray-50 p-4 border border-gray-100">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-gray-900">No active escalations</h3>
                <p className="mt-1 text-xs text-gray-500">No complaints currently require admin visibility.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
