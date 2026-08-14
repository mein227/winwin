import { useMemo, useState } from 'react'
import { CalendarRange, LoaderCircle, RefreshCw } from 'lucide-react'
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type { PnlSeries } from '../types'
import { buildCalendarMonth, groupByMonth, toDateKey } from '../utils/pnl'
import { FormulaCard } from './FormulaCard'
import { PnlCalendar } from './PnlCalendar'
import { PnlRangePanel, type DateRange } from './PnlRangePanel'

const FORMULAS = [
  {
    label: '單日總損益',
    formula:
      '收盤市值變化 − 當日淨投入 = Σ 期初股數 × 前日收盤 × 當日漲跌幅 + Σ 買進股數 ×(收盤 − 成交價) + Σ 賣出股數 ×(成交價 − 收盤) − 手續費 − 證交稅',
    note: '已實現與未實現損益都包含在內，全期加總等於總覽的總損益。',
  },
  {
    label: '單日報酬率',
    formula: '單日損益 ÷ 前一交易日收盤市值',
    note: '前一日沒有持股時（例如當天才開始買進），以區間內最高市值當分母。',
  },
  { label: '每週總損益', formula: 'Σ 該週（週一～週五）各交易日損益' },
  { label: '每月總損益', formula: 'Σ 該月各交易日損益' },
  { label: '區間總損益', formula: 'Σ 起訖日之間各交易日損益' },
  { label: '勝率', formula: '上漲天數 ÷（上漲天數 + 下跌天數）' },
  {
    label: '分割與除權息',
    formula: '分割當日報酬 = 漲跌價差 ÷（收盤 − 漲跌價差）',
    note: '除權息當日股價自然扣除股利，若股利未記成交易紀錄，該日會顯示為虧損。',
  },
]

interface PnlPanelProps {
  series: PnlSeries | null
  loading: boolean
  message: string
  syncedAt: string
  quoteDate: string
  onRefresh: () => void
}

export function PnlPanel({
  series,
  loading,
  message,
  syncedAt,
  quoteDate,
  onRefresh,
}: PnlPanelProps) {
  const [manualMonth, setManualMonth] = useState<string | null>(null)
  const [manualRange, setManualRange] = useState<DateRange | null>(null)

  const days = useMemo(() => series?.days ?? [], [series])
  const latestDate = series?.endDate || toDateKey(new Date())
  const latestMonthKey = latestDate.slice(0, 7)

  const monthDate = useMemo(
    () => startOfMonth(parseISO(`${manualMonth ?? latestMonthKey}-01`)),
    [manualMonth, latestMonthKey],
  )

  const bounds = useMemo<DateRange>(
    () => ({
      start: series?.startDate || toDateKey(startOfMonth(new Date())),
      end: series?.endDate || toDateKey(new Date()),
    }),
    [series?.startDate, series?.endDate],
  )

  const range = useMemo<DateRange>(
    () =>
      manualRange ?? {
        start: toDateKey(startOfMonth(parseISO(`${latestMonthKey}-01`))),
        end: toDateKey(endOfMonth(parseISO(`${latestMonthKey}-01`))),
      },
    [manualRange, latestMonthKey],
  )

  const month = useMemo(() => buildCalendarMonth(days, monthDate), [days, monthDate])
  const months = useMemo(() => groupByMonth(days), [days])

  const canPrev = bounds.start.slice(0, 7) < month.monthKey
  const canNext = !isAfter(startOfMonth(addMonths(monthDate, 1)), startOfMonth(new Date()))

  const shiftMonth = (delta: number) => {
    setManualMonth(format(addMonths(monthDate, delta), 'yyyy-MM'))
  }

  const selectRange = (start: string, end: string) => {
    setManualRange({ start, end })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <CalendarRange className="h-5 w-5 text-teal-300" />
            損益月曆
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            每日、每週、每月與自選區間的總損益；瀏覽頁面時會自動更新市價
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {quoteDate && <span>市價日期 {quoteDate}</span>}
          {syncedAt && <span>更新於 {format(parseISO(syncedAt), 'MM/dd HH:mm')}</span>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            重新計算
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {message}
        </div>
      )}

      {days.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-500">
          {loading
            ? '正在取得歷史股價並計算每日損益…'
            : '尚無可計算的損益，請先到「進出紀錄」新增買進或賣出'}
        </div>
      ) : (
        <>
          <PnlCalendar
            month={month}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
            range={range}
            onSelectRange={selectRange}
          />

          <PnlRangePanel
            days={days}
            months={months}
            range={range}
            bounds={bounds}
            onRangeChange={setManualRange}
          />
        </>
      )}

      <FormulaCard items={FORMULAS} />
    </div>
  )
}
