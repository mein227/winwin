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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.start}
            min={bounds.start}
            max={range.end}
            aria-label="區間起日"
            onChange={(e) =>
              e.target.value && onRangeChange({ ...range, start: e.target.value })
            }
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 sm:flex-none sm:px-3"
          />
          <span className="shrink-0 text-slate-500">~</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            aria-label="區間訖日"
            onChange={(e) =>
              e.target.value && onRangeChange({ ...range, end: e.target.value })
            }
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 sm:flex-none sm:px-3"
          />
        </div>

        <div className="sm:text-right">
          <p className="text-xs text-slate-500">區間總損益</p>
          <p
            className={`text-2xl font-bold tracking-tight ${pnlClass(total.pnl)}`}
          >
            {formatCurrency(total.pnl)}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 sm:justify-end">
            <span className={pnlClass(total.pnlPercent)}>
              {formatNumber(total.pnlPercent, 2)}%
            </span>
            <span>{total.tradingDays} 個交易日</span>
            <span>成交 {total.tradeCount} 筆</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
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
