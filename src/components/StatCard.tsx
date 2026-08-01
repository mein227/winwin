import type { ReactNode } from 'react'
import { pnlClass } from '../utils/calculations'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: ReactNode
  trend?: number
  accent?: 'teal' | 'amber' | 'rose' | 'violet' | 'sky'
}

const accents = {
  teal: 'from-teal-500/20 to-teal-500/5 border-teal-500/20',
  amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  rose: 'from-rose-500/20 to-rose-500/5 border-rose-500/20',
  violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
  sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/20',
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = 'teal',
}: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 shadow-lg shadow-black/20 sm:p-5 ${accents[accent]}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{title}</p>
        {icon && (
          <div className="rounded-lg bg-slate-950/40 p-2 text-slate-300">{icon}</div>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</p>
      {(subtitle || trend !== undefined) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {trend !== undefined && (
            <span className={`font-semibold ${pnlClass(trend)}`}>
              {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend).toFixed(2)}%
            </span>
          )}
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
