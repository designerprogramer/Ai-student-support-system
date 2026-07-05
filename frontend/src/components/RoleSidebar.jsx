import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import {
  BellRing,
  ChartColumn,
  Home,
  ListChecks,
  LogOut,
  Settings,
  Users,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react'
import { getAuthSession, logout, canonicalizeRole } from '../lib/auth'
import { fetchNotifications } from '../lib/complaintWorkflow'

const ROLE_THEMES = {
  admin: {
    color: '#4f46e5', // Indigo
    bgSoft: 'bg-indigo-50/55',
    textActive: 'text-indigo-600',
    bgActive: 'bg-indigo-50',
    borderActive: 'bg-indigo-600',
    hover: 'hover:bg-indigo-50/50 hover:text-indigo-600',
    label: 'Administrator'
  },
  affairs: {
    color: '#138154', // Brand green
    bgSoft: 'bg-[#138154]/5',
    textActive: 'text-[#138154]',
    bgActive: 'bg-[#138154]/5',
    borderActive: 'bg-[#138154]',
    hover: 'hover:bg-[#138154]/5 hover:text-[#138154]',
    label: 'Student Affairs'
  },
  support_officer: {
    color: '#2B85B7', // Brand blue
    bgSoft: 'bg-[#2B85B7]/5',
    textActive: 'text-[#2B85B7]',
    bgActive: 'bg-[#2B85B7]/5',
    borderActive: 'bg-[#2B85B7]',
    hover: 'hover:bg-[#2B85B7]/5 hover:text-[#2B85B7]',
    label: 'Support Officer'
  }
}

const adminNavItems = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: Home },
  { label: 'Complaints', to: '/admin/complaints', icon: ListChecks },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Escalations', to: '/admin/escalations', icon: AlertTriangle },
  { label: 'Reminders', to: '/admin/reminders', icon: BellRing },
  { label: 'Reports', to: '/admin/reports', icon: ChartColumn },
  { label: 'Security Logs', to: '/admin/security-logs', icon: ShieldAlert },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

const affairsNavItems = [
  { label: 'Dashboard', to: '/affairs/dashboard', icon: Home },
  { label: 'Complaints', to: '/affairs/complaints', icon: ListChecks },
  { label: 'Reminders', to: '/affairs/reminders', icon: BellRing },
  { label: 'Settings', to: '/affairs/settings', icon: Settings },
]

const supportNavItems = [
  { label: 'Dashboard', to: '/support/dashboard', icon: Home },
  { label: 'Reminders', to: '/support/reminders', icon: BellRing },
  { label: 'Settings', to: '/support/settings', icon: Settings },
]

function truncateDisplayName(value, maxLength = 15) {
  const chars = Array.from(`${value || ''}`.trim())
  if (chars.length <= maxLength) return chars.join('')
  return `${chars.slice(0, Math.max(0, maxLength - 3)).join('')}...`
}

export default function RoleSidebar({ role: propRole, user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const rawRole = propRole || getAuthSession()?.role || ''
  const canonicalRole = canonicalizeRole(rawRole)
  const theme = ROLE_THEMES[canonicalRole] || ROLE_THEMES.support_officer
  const roleLabel = theme.label

  let navItems = supportNavItems
  if (canonicalRole === 'admin') {
    navItems = adminNavItems
  } else if (canonicalRole === 'affairs') {
    navItems = affairsNavItems
  }

  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const notifs = await fetchNotifications()
        const unread = notifs.filter((n) => !n.is_read).length
        setUnreadCount(unread)
      } catch (err) {
        console.error(err)
      }
    }
    checkNotifications()
    const interval = setInterval(checkNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const session = getAuthSession()
  const currentUser = session?.user || user
  const username = (currentUser?.username || '').trim()
  const usernameIsNumeric = /^\d+$/.test(username)
  const profileName =
    [currentUser?.first_name, currentUser?.full_name, currentUser?.display_name, currentUser?.name]
      .map((value) => `${value || ''}`.trim())
      .find((value) => value && !/^\d+$/.test(value)) || ''
  const baseName = profileName || (!usernameIsNumeric ? username : '') || 'Staff'
  const firstName = baseName.split(/\s+/)[0] || 'Staff'
  const sidebarName = truncateDisplayName(firstName)
  const avatarInitial = (firstName?.trim()?.[0] || 'S').toUpperCase()
  const profileImageUrl = currentUser?.profile_image_url || currentUser?.profile?.profile_image_url || ''
  const pathname = location.pathname

  const isItemActive = (to) => {
    if (to === '/admin/complaints') {
      return pathname === '/admin/complaints' || pathname.startsWith('/admin/complaints/')
    }
    if (to === '/affairs/complaints') {
      return pathname === '/affairs/complaints' || pathname.startsWith('/affairs/complaints/')
    }
    return pathname === to
  }

  const getNavClass = (active) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
    ${
      active
        ? `${theme.bgActive} ${theme.textActive} after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full ${theme.borderActive}`
        : `text-gray-500 ${theme.hover}`
    }`

  return (
    <aside className="w-64 h-full flex flex-col bg-white border-r border-gray-200">
      {/* Logo Section */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-100">
        <img src={logo} className="h-10 w-10 object-contain" alt="Hormuud University Logo" />
        <div>
          <h1 className="text-sm font-semibold text-gray-800">Hormuud University</h1>
          <p className="text-xs text-gray-400">Support System</p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 p-6 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 font-display">
          Staff Controls
        </p>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isItemActive(item.to)
            const isNotificationItem = item.icon === BellRing

            return (
              <Link
                key={item.to}
                to={item.to}
                className={getNavClass(active)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </div>
                {isNotificationItem && unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 pb-4">
          <div className="flex w-full items-center gap-3 rounded-xl p-2">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={firstName}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className={`h-9 w-9 rounded-full ${theme.bgActive} flex items-center justify-center text-sm font-semibold ${theme.textActive}`}>
                {avatarInitial}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-800 truncate" title={firstName}>
                {sidebarName}
              </p>
              <p className="text-xs text-gray-400 truncate">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
