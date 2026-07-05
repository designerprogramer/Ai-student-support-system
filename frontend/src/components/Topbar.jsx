function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6 text-slate">
      <path d="M3 21V8a2 2 0 012-2h5.5" />
      <path d="M14 21V8a2 2 0 012-2h3.5" />
      <path d="M21 12H3" />
      <path d="M9 21V13" />
      <path d="M9 13h6" />
      <path d="M15 21V13" />
    </svg>
  )
}

export default function Topbar() {
  return (
    <header className="panel flex flex-wrap items-center justify-between gap-6 px-6 py-5 md:px-7">
      <div>
        <div className="eyebrow">Control Center</div>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold text-ink">
          <BuildingIcon />
          Complaint dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">
          Keep track of active cases, follow response deadlines, and move students toward resolution.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-line bg-cloud px-4 py-3 text-sm text-slate">
          Updated 2 minutes ago
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-deep text-sm font-semibold text-white">
            SA
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Support Admin</div>
            <div className="text-xs text-slate">admin@university.edu</div>
          </div>
        </div>
      </div>
    </header>
  )
}
