import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, Search, ShieldAlert, ShieldX, TriangleAlert } from 'lucide-react'
import DashboardHeader, { dashboardHeaderSecondaryAction } from '../../components/DashboardHeader'
import { fetchLoginAuditLogs, fetchLoginSecurityStates } from '../../lib/complaintWorkflow'

const eventStyles = {
  success: 'bg-emerald-50 text-emerald-700',
  failure: 'bg-red-50 text-red-700',
  locked: 'bg-red-100 text-red-800'
}

const eventIcons = {
  success: CheckCircle2,
  failure: TriangleAlert,
  locked: ShieldX
}

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString()
}

function formatReason(log) {
  if (log.failure_reason) return log.failure_reason
  if (log.event === 'success') return 'No reason'
  return 'No failure reason'
}

export default function SecurityLogs() {
  const [logs, setLogs] = useState([])
  const [states, setStates] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadData = async () => {
    try {
      const [logData, stateData] = await Promise.all([
        fetchLoginAuditLogs(),
        fetchLoginSecurityStates()
      ])
      setLogs(logData)
      setStates(stateData)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return logs
    return logs.filter((log) =>
      `${log.username} ${log.role} ${log.event} ${log.failure_reason} ${log.ip_address || ''}`
        .toLowerCase()
        .includes(term)
    )
  }, [logs, search])

  const lockedStates = states.filter((state) => state.locked_until && new Date(state.locked_until) > new Date())
  const failedStates = states.filter((state) => state.failed_attempts > 0)
  const successCount = logs.filter((log) => log.event === 'success').length
  const failureCount = logs.filter((log) => log.event === 'failure').length
  const lockedCount = logs.filter((log) => log.event === 'locked').length

  if (loading) {
    return <div className="text-sm text-gray-500">Loading security logs...</div>
  }

  return (
    <div className="space-y-7">
      <DashboardHeader
        eyebrow="Admin security"
        title="Login activity logs"
        description={lastUpdated ? `Live view of successful logins, failed attempts, lockouts, IP addresses, and failure reasons. Last updated ${lastUpdated.toLocaleTimeString()}.` : 'Live view of successful logins, failed attempts, lockouts, IP addresses, and failure reasons.'}
        actions={
          <button
            onClick={loadData}
            className={dashboardHeaderSecondaryAction}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-5">
        {[
          ['Total events', logs.length, 'text-gray-900'],
          ['Successful', successCount, 'text-emerald-700'],
          ['Failed', failureCount, 'text-amber-700'],
          ['Lockout events', lockedCount, 'text-red-700'],
          ['Locked now', lockedStates.length, 'text-red-700']
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Every login attempt</h2>
            <div className="relative w-full sm:w-80">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#2B85B7]"
                placeholder="Search user, role, IP, reason"
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Event</th>
                  <th>Attempts</th>
                  <th>Reason</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const Icon = eventIcons[log.event] || ShieldAlert
                  return (
                    <tr key={log.id}>
                      <td>{formatDate(log.created_at)}</td>
                      <td className="font-semibold text-gray-900">{log.username}</td>
                      <td>{log.role}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${eventStyles[log.event] || 'bg-gray-50 text-gray-700'}`}>
                          <Icon size={13} />
                          {log.event}
                        </span>
                      </td>
                      <td>{log.failed_attempts || 0}</td>
                      <td>{formatReason(log)}</td>
                      <td>{log.ip_address || 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredLogs.length === 0 ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No login events found.</div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Failed-attempt state</h2>
          <div className="mt-5 space-y-3">
            {failedStates.map((state) => (
              <div key={state.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{state.username}</p>
                    <p className="mt-1 text-xs text-gray-500">{state.role}</p>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    {state.failed_attempts}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-600">
                  <p>Reason: <span className="font-semibold">{state.failure_reason || 'N/A'}</span></p>
                  <p>Locked until: <span className="font-semibold">{formatDate(state.locked_until)}</span></p>
                  <p>Last failed: <span className="font-semibold">{formatDate(state.last_failed_at)}</span></p>
                </div>
              </div>
            ))}
            {failedStates.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No active failed-attempt counters.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
