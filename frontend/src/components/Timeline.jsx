export default function Timeline({ items }) {
  return (
    <div className="space-y-5">
      {items.map((item, index) => (
        <div key={index} className="relative flex gap-4 pl-1">
          <div className="relative flex flex-col items-center">
            <div className="mt-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-deep" />
            {index < items.length - 1 ? <div className="mt-2 h-full w-px bg-line" /> : null}
          </div>
          <div className="pb-4">
            <div className="text-sm font-semibold text-ink">{item.title}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate/70">{item.time}</div>
            <div className="mt-2 text-sm leading-6 text-slate">{item.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
