interface KPICardProps {
  label: string
  value: string
  sub?: string
}

export function KPICard({ label, value, sub }: KPICardProps) {
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-3 text-3xl font-bold tabular-nums text-zinc-50">{value}</div>
      {sub ? <div className="mt-2 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  )
}
