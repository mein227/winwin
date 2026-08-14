import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarMonth, DailyPnL, DateRange } from '../types'
import { formatCompact, formatCurrency, formatNumber } from '../utils/calculations'

const WEEKDAYS = ['一', '二', '三', '四', '五']

interface PnlCalendarProps {
  month: CalendarMonth
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  range: DateRange
  onSelectRange: (start: string, end: string) => void
}

/** 依損益大小分三個級距上色，讓大賺大賠一眼看得出來 */
function toneClass(pnl: number, maxAbs: number): string {
  const ratio = maxAbs > 0 ? Math.abs(pnl) / maxAbs : 0
  const level = ratio >= 0.6 ? 2 : ratio >= 0.2 ? 1 : 0

  if (pnl > 0) {
    return [
      'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
      'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
      'border-emerald-400/50 bg-emerald-500/25 text-emerald-200',
    ][level]
  }
  if (pnl < 0) {
    return [
      'border-rose-500/20 bg-rose-500/5 text-rose-300',
      'border-rose-500/30 bg-rose-500/15 text-rose-300',
      'border-rose-400/50 bg-rose-500/25 text-rose-200',
    ][level]
  }
  return 'border-slate-800 bg-slate-950/40 text-slate-400'
}

function dayTitle(day: DailyPnL): string {
  const parts = [
    `${day.date} 損益 ${formatCurrency(day.pnl)}`,
    `報酬率 ${formatNumber(day.pnlPercent, 2)}%`,
    `收盤市值 ${formatCurrency(day.marketValue)}`,
  ]
  if (day.tradeCount > 0) {
    parts.push(
      `成交 ${day.tradeCount} 筆`,
      `淨投入 ${formatCurrency(day.netCashFlow)}`,
      `已實現 ${formatCurrency(day.realizedPnL)}`,
    )
  }
  return parts.join('　')
}

export function PnlCalendar({
  month,
  canPrev,
  canNext,
  onPrev,
  onNext,
  range,
  onSelectRange,
}: PnlCalendarProps) {
  const maxAbs = month.weeks.reduce((max, week) => {
    for (const cell of week.cells) {
      if (cell.data) max = Math.max(max, Math.abs(cell.data.pnl))
    }
    return max
  }, 0)

  const inRange = (date: string) => date >= range.start && date <= range.end

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="上個月"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h4 className="text-base font-semibold text-white">{month.label}</h4>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="下個月"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectRange(month.startDate, month.endDate)}
          className={`rounded-xl border px-3 py-1.5 text-right text-sm transition hover:bg-slate-800/60 ${
            inRange(month.startDate) && inRange(month.endDate)
              ? 'border-teal-500/50 bg-teal-500/10'
              : 'border-slate-700 bg-slate-900'
          }`}
        >
          <span className="text-xs text-slate-400">本月損益　</span>
          <span
            className={`font-semibold ${
              month.total.pnl > 0
                ? 'text-emerald-300'
                : month.total.pnl < 0
                  ? 'text-rose-300'
                  : 'text-slate-300'
            }`}
          >
            {formatCurrency(month.total.pnl)}
          </span>
          <span className="ml-2 text-xs text-slate-500">
            {formatNumber(month.total.pnlPercent, 2)}%
          </span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          <div className="mb-1 grid grid-cols-6 gap-1 text-center text-xs text-slate-500">
            {WEEKDAYS.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
            <div className="py-1 text-teal-400/80">週合計</div>
          </div>

          <div className="space-y-1">
            {month.weeks.map((week) => (
              <div key={week.key} className="grid grid-cols-6 gap-1">
                {week.cells.map((cell) => {
                  const day = cell.data
                  const selected = inRange(cell.date)

                  if (!day) {
                    return (
                      <div
                        key={cell.date}
                        className={`h-[62px] rounded-lg border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-xs ${
                          cell.inMonth ? 'text-slate-600' : 'text-slate-700'
                        } ${selected ? 'ring-1 ring-teal-500/40' : ''}`}
                      >
                        {cell.dayOfMonth}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      title={dayTitle(day)}
                      onClick={() => onSelectRange(cell.date, cell.date)}
                      className={`h-[62px] rounded-lg border px-2 py-1 text-left transition hover:brightness-125 ${toneClass(
                        day.pnl,
                        maxAbs,
                      )} ${cell.inMonth ? '' : 'opacity-45'} ${
                        selected ? 'ring-2 ring-teal-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className={cell.isToday ? 'font-bold text-teal-300' : ''}>
                          {cell.dayOfMonth}
                        </span>
                        {day.tradeCount > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold">
                        {formatCompact(day.pnl, true)}
                      </div>
                      <div className="truncate text-[11px] opacity-70">
                        {formatNumber(day.pnlPercent, 2)}%
                      </div>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => onSelectRange(week.startDate, week.endDate)}
                  title={`${week.total.label} 損益 ${formatCurrency(week.total.pnl)}`}
                  className={`h-[62px] rounded-lg border border-slate-700/70 bg-slate-950/60 px-2 py-1 text-left transition hover:bg-slate-800/60 ${
                    range.start === week.startDate && range.end === week.endDate
                      ? 'ring-2 ring-teal-400'
                      : ''
                  }`}
                >
                  <div className="text-[11px] text-slate-500">W{week.weekOfYear}</div>
                  <div
                    className={`mt-0.5 truncate text-sm font-semibold ${
                      week.total.pnl > 0
                        ? 'text-emerald-300'
                        : week.total.pnl < 0
                          ? 'text-rose-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {week.total.tradingDays === 0
                      ? '—'
                      : formatCompact(week.total.pnl, true)}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {week.total.tradingDays} 個交易日
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        點日期、週合計或本月損益即可帶入上方的區間；藍點表示當日有成交紀錄。
      </p>
    </div>
  )
}
