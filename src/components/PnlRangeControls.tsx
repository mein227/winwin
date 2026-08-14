import { useMemo } from 'react'
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import type { DateRange, PnlBucket } from '../types'
import { formatCurrency, formatNumber, pnlClass } from '../utils/calculations'
import { toDateKey } from '../utils/pnl'

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

interface PnlRangeControlsProps {
  range: DateRange
  bounds: DateRange
  total: PnlBucket
  onRangeChange: (range: DateRange) => void
}

function buildPresets(bounds: DateRange): { label: string; range: DateRange }[] {
  const today = new Date()
  const lastMonth = subMonths(today, 1)
  return [
    {
      label: '本週',
      range: {
        start: toDateKey(startOfWeek(today, WEEK_OPTIONS)),
        end: toDateKey(endOfWeek(today, WEEK_OPTIONS)),
      },
    },
    {
      label: '本月',
      range: {
        start: toDateKey(startOfMonth(today)),
        end: toDateKey(endOfMonth(today)),
      },
    },
    {
      label: '上月',
      range: {
        start: toDateKey(startOfMonth(lastMonth)),
        end: toDateKey(endOfMonth(lastMonth)),
      },
    },
    {
      label: '近 30 日',
      range: { start: toDateKey(subDays(today, 29)), end: toDateKey(today) },
    },
    {
      label: '今年',
      range: { start: toDateKey(startOfYear(today)), end: toDateKey(today) },
    },
    { label: '全部', range: { start: bounds.start, end: bounds.end } },
  ]
}

/** 區間選擇與該區間的總損益，放在月曆上方一起操作 */
export function PnlRangeControls({
  range,
  bounds,
  total,
  onRangeChange,
}: PnlRangeControlsProps) {
  const presets = useMemo(() => buildPresets(bounds), [bounds])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={range.start}
            min={bounds.start}
            max={range.end}
            aria-label="區間起日"
            onChange={(e) =>
              e.target.value && onRangeChange({ ...range, start: e.target.value })
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
          <span className="text-slate-500">~</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            aria-label="區間訖日"
            onChange={(e) =>
              e.target.value && onRangeChange({ ...range, end: e.target.value })
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">區間總損益</p>
          <p className={`text-2xl font-bold tracking-tight ${pnlClass(total.pnl)}`}>
            {formatCurrency(total.pnl)}
          </p>
          <p className="text-xs text-slate-500">
            <span className={pnlClass(total.pnlPercent)}>
              {formatNumber(total.pnlPercent, 2)}%
            </span>
            　{total.tradingDays} 個交易日　成交 {total.tradeCount} 筆
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active =
            preset.range.start === range.start && preset.range.end === range.end
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onRangeChange(preset.range)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                active
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-200'
                  : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
