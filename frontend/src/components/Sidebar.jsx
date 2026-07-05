import { NavLink } from 'react-router-dom'

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ComplaintsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
    </svg>
  )
}

function NewComplaintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
  { label: 'Complaints', to: '/complaints', icon: ComplaintsIcon },
  { label: 'New Complaint', to: '/complaints/new', icon: NewComplaintIcon }
]

export default function Sidebar() {
  return (
    <aside className="panel h-fit w-full p-6 md:p-7">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Student Support</div>
          <div className="mt-2 text-2xl font-semibold text-ink">Operations Desk</div>
          <p className="mt-2 text-sm leading-6 text-slate">
            Review complaints, track timelines, and keep responses moving.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-cloud px-3 py-2 text-xs font-semibold text-slate">
          Live
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition',
                isActive
                  ? 'bg-[#168055]/5 text-[#168055] after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:rounded-full after:bg-[#168055]'
                  : 'text-slate hover:bg-[#168055]/5 hover:text-[#168055]'
              ].join(' ')
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 rounded-[24px] border border-line bg-cloud p-5">
        <div className="eyebrow">SLA Watch</div>
        <div className="mt-3 text-3xl font-semibold text-ink">3h 12m</div>
        <p className="mt-2 text-sm leading-6 text-slate">
          The next escalation checkpoint is approaching for unresolved finance requests.
        </p>
      </div>
    </aside>
  )
}
