export const dashboardHeaderPrimaryAction =
  'inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#2B85B7] shadow-sm transition hover:bg-[#F8FBFF]'

export const dashboardHeaderSecondaryAction =
  'inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20'

export default function DashboardHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="dashboard-hero relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#168055] via-[#0f6a4b] to-[#0a5a3f] p-8 text-white">
      <div className="dashboard-hero-glow absolute right-0 top-0 h-40 w-40 rounded-full bg-white opacity-10 blur-3xl transform translate-x-12 -translate-y-12"></div>
      <div className="dashboard-hero-glow dashboard-hero-glow-delay absolute left-1/4 bottom-0 h-36 w-36 rounded-full bg-white opacity-10 blur-3xl"></div>
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-white/75">{eyebrow}</p>
          ) : null}
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}
