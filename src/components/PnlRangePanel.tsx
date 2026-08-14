import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import type { DailyPnL, PnlBucket } from '../types'
import {
  formatCompact,
  formatCurrency,
  formatNumber,
  pnlClass,
} from '../utils/calculations'
import { filterByRange, summarizeDays, toDateKey } from '../utils/pnl'

export interface DateRange {
  start: string
  end: string
}

interface PnlRangePanelProps {
  days: DailyPnL[]
  months: PnlBucket[]
  range: DateRange
  bounds: DateRange
  onRangeChange: (range: DateRange) => void
}

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

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

/** 取出被點擊的柱狀圖所屬月份；recharts 會依版本放在 payload 內或直接展開 */
function readBarRange(clicked: unknown): DateRange | null {
  if (!clicked || typeof clicked !== 'object') return null
  const source = clicked as { startDate?: unknown; endDate?: unknown; payload?: unknown }
  const entry =
    typeof source.startDate === 'string'
      ? source
      : ((source.payload ?? {}) as { startDate?: unknown; endDate?: unknown })
  return typeof entry.startDate === 'string' && typeof entry.endDate === 'string'
    ? { start: entry.startDate, end: entry.endDate }
    : null
}

export function PnlRangePanel({
  days,
  months,
  range,
  bounds,
  onRangeChange,
}: PnlRangePanelProps) {
  const presets = useMemo(() => buildPresets(bounds), [bounds])

  const stats = useMemo(
    () =>
      summarizeDays(filterByRange(days, range.start, range.end), {
        key: `${range.start}~${range.end}`,
        label: `${range.start} ~ ${range.end}`,
        startDate: range.start,
        endDate: range.end,
      }),
    [days, range.start, range.end],
  )

  const chartData = useMemo(
    () =>
      months.slice(-12).map((bucket) => ({
        key: bucket.key,
        label: `${Number(bucket.key.slice(5))} 月`,
        pnl: bucket.pnl,
        pnlPercent: bucket.pnlPercent,
        startDate: bucket.startDate,
        endDate: bucket.endDate,
      })),
    [months],
  )

  const winRate =
    stats.winDays + stats.lossDays > 0
      ? (stats.winDays / (stats.winDays + stats.lossDays)) * 100
      : 0
  const averagePnl = stats.tradingDays > 0 ? stats.pnl / stats.tradingDays : 0

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">區間損益</h3>
          <p className="mt-1 text-xs text-slate-500">
            自選起訖日，計算該區間的總損益與勝率
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={range.start}
            min={bounds.start}
            max={range.end}
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
            onChange={(e) =>
              e.target.value && onRangeChange({ ...range, end: e.target.value })
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          />
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

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-sm text-slate-400">
          {range.start} ~ {range.end} 總損益
        </p>
        <p className={`mt-1 text-3xl font-bold tracking-tight ${pnlClass(stats.pnl)}`}>
          {formatCurrency(stats.pnl)}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          報酬率{' '}
          <span className={pnlClass(stats.pnlPercent)}>
            {formatNumber(stats.pnlPercent, 2)}%
          </span>
          　{stats.tradingDays} 個交易日　成交 {stats.tradeCount} 筆
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-500">上漲／下跌天數</p>
          <p className="mt-1 text-sm font-semibold text-slate-200">
            <span className="text-emerald-400">{stats.winDays}</span>
            {' / '}
            <span className="text-rose-400">{stats.lossDays}</span>
          </p>
          <p className="text-xs text-slate-500">勝率 {formatNumber(winRate, 1)}%</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-500">平均單日損益</p>
          <p className={`mt-1 text-sm font-semibold ${pnlClass(averagePnl)}`}>
            {formatCurrency(averagePnl)}
          </p>
          <p className="text-xs text-slate-500">
            已實現 {formatCurrency(stats.realizedPnL)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-500">最佳單日</p>
          <p className="mt-1 text-sm font-semibold text-emerald-300">
            {stats.bestDay ? formatCurrency(stats.bestDay.pnl) : '—'}
          </p>
          <p className="text-xs text-slate-500">{stats.bestDay?.date ?? '無資料'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-500">最差單日</p>
          <p className="mt-1 text-sm font-semibold text-rose-300">
            {stats.worstDay ? formatCurrency(stats.worstDay.pnl) : '—'}
          </p>
          <p className="text-xs text-slate-500">{stats.worstDay?.date ?? '無資料'}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">近 12 個月月損益</h4>
            <span className="text-xs text-slate-500">點柱狀圖可選取該月區間</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => formatCompact(value as number)}
                />
                <ReferenceLine y={0} stroke="#475569" />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), '月損益']}
                />
                <Bar
                  dataKey="pnl"
                  radius={[4, 4, 0, 0]}
                  onClick={(clicked: unknown) => {
                    const clickedRange = readBarRange(clicked)
                    if (clickedRange) onRangeChange(clickedRange)
                  }}
                >
                  {chartData.map((item) => (
                    <Cell
                      key={item.key}
                      cursor="pointer"
                      fill={item.pnl >= 0 ? '#34d399' : '#fb7185'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
