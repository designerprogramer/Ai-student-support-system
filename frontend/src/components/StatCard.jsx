export default function StatCard({ label, value, accent, hint }) {
  return (
    <div className="panel p-5 md:p-6">
      <div className="eyebrow">{label}</div>
      <div className={`mt-4 text-4xl font-semibold ${accent || 'text-ink'}`}>{value}</div>
      {hint ? <div className="mt-3 text-sm text-slate">{hint}</div> : null}
    </div>
  )
}
