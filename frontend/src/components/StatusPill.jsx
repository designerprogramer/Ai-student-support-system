const styles = {
  pending: 'bg-[#F3EEDF] text-[#8C7341]',
  in_progress: 'bg-[#E8EFF0] text-[#557071]',
  escalated: 'bg-[#F6E6E5] text-[#9A5A58]',
  resolved: 'bg-[#E7EFE8] text-[#5B7663]',
  closed: 'bg-mist text-slate'
}

export default function StatusPill({ status }) {
  const key = status?.toLowerCase().replace(' ', '_')
  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${styles[key] || 'bg-mist text-slate'}`}>
      {status}
    </span>
  )
}
