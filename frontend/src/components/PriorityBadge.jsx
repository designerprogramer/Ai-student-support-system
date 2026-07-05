const styles = {
  low: 'bg-[#E7EFE8] text-[#5B7663]',
  medium: 'bg-[#F3EEDF] text-[#8C7341]',
  high: 'bg-[#EEEAE0] text-[#665A3B]',
  critical: 'bg-[#F6E6E5] text-[#9A5A58]'
}

export default function PriorityBadge({ priority }) {
  const key = priority?.toLowerCase()
  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${styles[key] || 'bg-mist text-slate'}`}>
      {priority}
    </span>
  )
}
