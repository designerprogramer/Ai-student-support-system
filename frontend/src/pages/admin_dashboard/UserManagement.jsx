import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, Search, ShieldCheck, UserCog, UserRound, XCircle } from 'lucide-react'
import DashboardHeader, { dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import api from '../../lib/api'
import { fetchUsers } from '../../lib/complaintWorkflow'

function getDisplayName(user) {
  return (
    user.profile?.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    'Unknown user'
  )
}

function roleLabel(roles = []) {
  if (!roles.length) return 'No role'
  return roles.map((role) => role.replace(/_/g, ' ')).join(', ')
}

function getIdentityLabel(user) {
  const roles = user.roles || []
  const studentNumber = user.profile?.student_number
  const staffNumber = user.profile?.staff_number

  if (roles.includes('student')) return studentNumber || 'Missing student ID'
  return staffNumber || 'No ID needed'
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [savingEmailId, setSavingEmailId] = useState(null)
  const [emailDrafts, setEmailDrafts] = useState({})
  const [search, setSearch] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      setUsers(await fetchUsers())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    setEmailDrafts((current) => {
      const next = { ...current }
      users.forEach((user) => {
        if (next[user.id] === undefined) {
          next[user.id] = user.email || ''
        }
      })
      return next
    })
  }, [users])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      `${user.username} ${user.email} ${getDisplayName(user)} ${roleLabel(user.roles)}`
        .toLowerCase()
        .includes(term)
    )
  }, [users, search])

  const roleCounts = useMemo(() => {
    return users.reduce((acc, user) => {
      ;(user.roles || ['no_role']).forEach((role) => {
        const key = role || 'no_role'
        acc[key] = (acc[key] || 0) + 1
      })
      return acc
    }, {})
  }, [users])

  const activeCount = users.filter((user) => user.is_active).length
  const inactiveCount = users.length - activeCount

  const toggleActive = async (user) => {
    setSavingId(user.id)
    try {
      const response = await api.patch(`/users/${user.id}/`, { is_active: !user.is_active })
      setUsers((current) => current.map((item) => (item.id === user.id ? response.data : item)))
    } finally {
      setSavingId(null)
    }
  }

  const updateEmail = async (user) => {
    setSavingEmailId(user.id)
    try {
      const response = await api.patch(`/users/${user.id}/`, {
        email: (emailDrafts[user.id] || '').trim()
      })
      setUsers((current) => current.map((item) => (item.id === user.id ? response.data : item)))
    } finally {
      setSavingEmailId(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading users...</div>
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Admin users"
        title="User management"
        description="View system users, roles, account status, and basic profile information."
        actions={
          <button
            onClick={loadUsers}
            className={dashboardHeaderSecondaryAction}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-4">
        {[
          ['Total users', users.length, UserRound, 'text-gray-900'],
          ['Active', activeCount, CheckCircle2, 'text-emerald-700'],
          ['Inactive', inactiveCount, XCircle, 'text-red-700'],
          ['Admin users', roleCounts.admin || 0, ShieldCheck, 'text-[#2B85B7]']
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

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
            <p className="mt-1 text-sm text-gray-500">Showing {filteredUsers.length} of {users.length} users.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#2B85B7]"
              placeholder="Search users"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Student / Staff ID</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-semibold text-gray-900">{getDisplayName(user)}</p>
                    <p className="mt-1 text-xs text-gray-500">ID: {user.id}</p>
                  </td>
                  <td className="font-medium text-gray-700">{user.username}</td>
                  <td>
                    <div className="flex min-w-64 gap-2">
                      <input
                        type="email"
                        value={emailDrafts[user.id] ?? user.email ?? ''}
                        onChange={(event) =>
                          setEmailDrafts((current) => ({ ...current, [user.id]: event.target.value }))
                        }
                        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#2B85B7]"
                        placeholder="Add email"
                      />
                      <button
                        onClick={() => updateEmail(user)}
                        disabled={savingEmailId === user.id}
                        className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-[#2B85B7] transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        {savingEmailId === user.id ? 'Saving' : 'Save'}
                      </button>
                    </div>
                  </td>
                  <td className="capitalize">{roleLabel(user.roles)}</td>
                  <td>{getIdentityLabel(user)}</td>
                  <td>
                    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                      user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={savingId === user.id}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                        user.is_active
                          ? 'border border-red-200 text-red-700 hover:bg-red-50'
                          : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {savingId === user.id ? 'Saving...' : user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 ? (
            <div className="mt-5 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No users found.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
