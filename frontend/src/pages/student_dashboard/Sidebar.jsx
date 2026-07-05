import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import {
  BellRing,
  ChartColumn,
  FilePlus2,
  Home,
  ListChecks,
  LogOut,
  Settings
} from 'lucide-react'
import { getAuthSession, logout } from '../../lib/auth'
import { fetchNotifications } from '../../lib/complaintWorkflow'

const navItems = [
  { label: 'Dashboard', to: '/student/dashboard', icon: Home },
  { label: 'Tracking', to: '/student/complaints', icon: ListChecks },
  { label: 'New Complaint', to: '/student/complaints/new', icon: FilePlus2 },
  { label: 'Reports', to: '/student/reports', icon: ChartColumn },
  { label: 'Settings', to: '/student/setting', icon: Settings },
]

function truncateDisplayName(value, maxLength = 15) {
  const chars = Array.from(`${value || ''}`.trim())
  if (chars.length <= maxLength) return chars.join('')
  return `${chars.slice(0, Math.max(0, maxLength - 3)).join('')}...`
}

export default function Sidebar({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

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
    // Clear auth session
    logout()
    // Redirect to login page
    navigate('/login')
  }

  // Get user from session if not passed as prop
  const session = getAuthSession()
  const currentUser = session?.user || user
  const username = (currentUser?.username || '').trim()
  const usernameIsNumeric = /^\d+$/.test(username)
  const profileName =
    [currentUser?.first_name, currentUser?.full_name, currentUser?.display_name, currentUser?.name]
      .map((value) => `${value || ''}`.trim())
      .find((value) => value && !/^\d+$/.test(value)) || ''
  const baseName = profileName || (!usernameIsNumeric ? username : '') || 'Student'
  const firstName = baseName.split(/\s+/)[0] || 'Student'
  const sidebarName = truncateDisplayName(firstName)
  const roleLabel = 'Student'
  const avatarInitial = (firstName?.trim()?.[0] || 'S').toUpperCase()
  const profileImageUrl = currentUser?.profile_image_url || currentUser?.profile?.profile_image_url || ''
  const pathname = location.pathname

  const isItemActive = (to) => {
    if (to === '/student/complaints') {
      return (
        pathname === '/student/complaints' ||
        (pathname.startsWith('/student/complaints/') && pathname !== '/student/complaints/new')
      )
    }

    return pathname === to
  }

  const getNavClass = (active) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
    ${
      active
        ? 'bg-[#168055]/5 text-[#168055] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[#168055]'
        : 'text-gray-500 hover:bg-[#168055]/5 hover:text-[#168055]'
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
      <div className="flex-1 p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Main Menu
        </p>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isItemActive(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={getNavClass(active)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <Link
            to="/student/reminders"
            className={`relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              isItemActive('/student/reminders')
                ? 'bg-[#168055]/5 text-[#168055] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[#168055]'
                : 'text-gray-500 hover:bg-[#168055]/5 hover:text-[#168055]'
            }`}
          >
            <div className="flex items-center gap-3">
              <BellRing size={18} />
              <span>Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-gray-100">
        <div className="p-4 pb-4">
          <Link
            to="/student/setting"
            aria-label="Open profile settings"
            title="Open profile settings"
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#168055]/20"
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={firstName}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[#168055]/10 flex items-center justify-center text-sm font-semibold text-[#168055]">
                {avatarInitial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate" title={firstName}>
                {sidebarName}
              </p>
              <p className="text-xs text-gray-400 truncate">{roleLabel}</p>
            </div>
          </Link>
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
