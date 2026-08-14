import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type {
  CalendarCell,
  CalendarMonth,
  CalendarWeek,
  DailyPnL,
  PnlBucket,
  PnlSeries,
  Transaction,
} from '../types'
import { CORPORATE_ACTION_THRESHOLD } from '../services/stockQuote'

/** 台股週一開盤，週次以週一為起點 */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const

export interface PriceBars {
  symbol: string
  name: string
  dates: string[]
  /** 未還原的收盤價，與交易紀錄的成交價同基準 */
  closes: number[]
  /** 交易所公布的漲跌價差 */
  spreads: number[]
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

interface SymbolSeries {
  /** 日期 → 當日收盤 */
  close: Map<string, number>
  /** 日期 → 前一交易日收盤 */
  prevClose: Map<string, number>
  /** 日期 → 當日報酬，已排除分割與減資造成的假跌幅 */
  ret: Map<string, number>
}

/**
 * 由日 K 線建立查詢用的收盤價與日報酬。
 *
 * 遇到分割、減資（單日價差超過門檻）時，改用交易所的漲跌價差還原相對前一日參考價的報酬，
 * 否則 00631L 這類分割會被算成 −96% 的假虧損。
 */
function buildSymbolSeries(bars: PriceBars): SymbolSeries {
  const close = new Map<string, number>()
  const prevClose = new Map<string, number>()
  const ret = new Map<string, number>()

  for (let i = 0; i < bars.dates.length; i++) {
    const date = bars.dates[i]
    const value = bars.closes[i]
    close.set(date, value)
    if (i === 0) continue

    const previous = bars.closes[i - 1]
    prevClose.set(date, previous)
    if (!(previous > 0)) {
      ret.set(date, 0)
      continue
    }

    const change = value / previous - 1
    if (Math.abs(change) > CORPORATE_ACTION_THRESHOLD) {
      const spread = bars.spreads[i] ?? 0
      const reference = value - spread
      ret.set(date, reference > 0 ? spread / reference : 0)
    } else {
      ret.set(date, change)
    }
  }

  return { close, prevClose, ret }
}

/**
 * 計算每個交易日的總損益。
 *
 * 單日損益＝收盤市值變化 − 當日淨投入，展開後等於
 * 「持倉的價格變動」＋「當日買進的帳面價差」＋「當日賣出的價差」− 手續費與證交稅，
 * 因此已實現與未實現損益都涵蓋在內，全期加總會等於總覽的總損益。
 */
export function buildDailyPnlSeries(
  transactions: Transaction[],
  bars: PriceBars[],
): PnlSeries {
  const empty: PnlSeries = {
    days: [],
    startDate: '',
    endDate: '',
    missing: [],
    updatedAt: new Date().toISOString(),
  }

  const txs = [...transactions]
    .filter((tx) => Boolean(tx.date))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    )
  if (txs.length === 0) return empty

  const series = new Map<string, SymbolSeries>()
  for (const item of bars) {
    series.set(item.symbol.toUpperCase(), buildSymbolSeries(item))
  }

  const txByDate = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const list = txByDate.get(tx.date) ?? []
    list.push(tx)
    txByDate.set(tx.date, list)
  }

  const startDate = txs[0].date
  const dateSet = new Set<string>(txByDate.keys())
  for (const symbolSeries of series.values()) {
    for (const date of symbolSeries.close.keys()) {
      if (date >= startDate) dateSet.add(date)
    }
  }
  const dates = [...dateSet].sort()

  const missing = [...new Set(txs.map((tx) => tx.symbol.toUpperCase()))]
    .filter((symbol) => !series.has(symbol))
    .sort()

  type Position = { shares: number; cost: number; lastClose: number }
  const positions = new Map<string, Position>()
  const days: DailyPnL[] = []
  let previousMarketValue = 0

  for (const date of dates) {
    let pnl = 0
    let realizedPnL = 0
    let netCashFlow = 0

    // 期初持倉的價格變動
    for (const [symbol, position] of positions) {
      if (Math.abs(position.shares) < 1e-9) continue
      const symbolSeries = series.get(symbol)
      const ret = symbolSeries?.ret.get(date)
      const prev = symbolSeries?.prevClose.get(date)
      if (ret === undefined || prev === undefined) continue
      pnl += position.shares * prev * ret
    }

    const dayTxs = txByDate.get(date) ?? []
    for (const tx of dayTxs) {
      const symbol = tx.symbol.toUpperCase()
      const position =
        positions.get(symbol) ?? { shares: 0, cost: 0, lastClose: tx.price }
      // 沒有當日收盤價時以成交價估算，該筆交易當日不產生帳面損益
      const close = series.get(symbol)?.close.get(date) ?? tx.price

      if (tx.type === 'buy') {
        const cost = tx.price * tx.shares + tx.fee
        pnl += tx.shares * (close - tx.price) - tx.fee
        netCashFlow += cost
        position.shares += tx.shares
        position.cost += cost
      } else {
        const proceeds = tx.price * tx.shares - tx.fee - tx.tax
        pnl += tx.shares * (tx.price - close) - tx.fee - tx.tax
        netCashFlow -= proceeds
        const avgCost = position.shares > 0 ? position.cost / position.shares : 0
        const sold = Math.min(tx.shares, Math.max(position.shares, 0))
        const costBasis = avgCost * sold
        realizedPnL += proceeds - costBasis
        position.cost -= costBasis
        position.shares -= tx.shares
      }

      positions.set(symbol, position)
    }

    let marketValue = 0
    for (const [symbol, position] of positions) {
      const close = series.get(symbol)?.close.get(date)
      if (close !== undefined) position.lastClose = close
      if (Math.abs(position.shares) < 1e-9) continue
      marketValue += position.shares * position.lastClose
    }

    // 清倉後的空白日不列入月曆
    if (dayTxs.length === 0 && Math.abs(pnl) < 0.005 && marketValue <= 0) {
      previousMarketValue = marketValue
      continue
    }

    days.push({
      date,
      pnl,
      baseValue: previousMarketValue,
      marketValue,
      pnlPercent: previousMarketValue > 0 ? (pnl / previousMarketValue) * 100 : 0,
      realizedPnL,
      netCashFlow,
      tradeCount: dayTxs.length,
    })
    previousMarketValue = marketValue
  }

  if (days.length === 0) return { ...empty, missing }

  return {
    days,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    missing,
    updatedAt: new Date().toISOString(),
  }
}

export interface SummaryOptions {
  key: string
  label: string
  startDate?: string
  endDate?: string
}

/** 彙總一段期間的損益，週、月與自訂區間共用 */
export function summarizeDays(days: DailyPnL[], options: SummaryOptions): PnlBucket {
  const { key, label } = options
  const startDate = options.startDate ?? days[0]?.date ?? ''
  const endDate = options.endDate ?? days[days.length - 1]?.date ?? ''

  let pnl = 0
  let realizedPnL = 0
  let tradeCount = 0
  let winDays = 0
  let lossDays = 0
  let peakValue = 0
  let bestDay: DailyPnL | null = null
  let worstDay: DailyPnL | null = null

  for (const day of days) {
    pnl += day.pnl
    realizedPnL += day.realizedPnL
    tradeCount += day.tradeCount
    if (day.pnl > 0) winDays++
    else if (day.pnl < 0) lossDays++
    peakValue = Math.max(peakValue, day.baseValue, day.marketValue)
    if (!bestDay || day.pnl > bestDay.pnl) bestDay = day
    if (!worstDay || day.pnl < worstDay.pnl) worstDay = day
  }

  // 期初市值為零（例如區間內才開始買進）時，改以區間內最高市值當分母
  const baseValue = days[0]?.baseValue ?? 0
  const denominator = baseValue > 0 ? baseValue : peakValue

  return {
    key,
    label,
    startDate,
    endDate,
    pnl,
    pnlPercent: denominator > 0 ? (pnl / denominator) * 100 : 0,
    baseValue,
    endMarketValue: days[days.length - 1]?.marketValue ?? 0,
    realizedPnL,
    tradingDays: days.length,
    tradeCount,
    winDays,
    lossDays,
    bestDay,
    worstDay,
  }
}

export function filterByRange(
  days: DailyPnL[],
  startDate: string,
  endDate: string,
): DailyPnL[] {
  return days.filter((day) => day.date >= startDate && day.date <= endDate)
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year} 年 ${Number(month)} 月`
}

export function weekLabel(startDate: string, endDate: string): string {
  return `${startDate.slice(5).replace('-', '/')} ~ ${endDate.slice(5).replace('-', '/')}`
}

/** 依月份彙總（用於月損益圖與月合計） */
export function groupByMonth(days: DailyPnL[]): PnlBucket[] {
  const groups = new Map<string, DailyPnL[]>()
  for (const day of days) {
    const key = day.date.slice(0, 7)
    const list = groups.get(key) ?? []
    list.push(day)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => summarizeDays(list, { key, label: monthLabel(key) }))
}

/** 依週彙總（週一為起點） */
export function groupByWeek(days: DailyPnL[]): PnlBucket[] {
  const groups = new Map<string, DailyPnL[]>()
  for (const day of days) {
    const key = toDateKey(startOfWeek(parseISO(day.date), WEEK_OPTIONS))
    const list = groups.get(key) ?? []
    list.push(day)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const end = toDateKey(endOfWeek(parseISO(key), WEEK_OPTIONS))
      return summarizeDays(list, {
        key,
        label: weekLabel(key, end),
        startDate: key,
        endDate: end,
      })
    })
}

/**
 * 組出月曆格線：7 欄（週一～週日）加上每週合計。
 *
 * 為了讓「每週總損益」是真實的一整週，週合計會包含補齊格線的鄰月日期；
 * 月合計則只計入當月日期。
 */
export function buildCalendarMonth(
  days: DailyPnL[],
  monthDate: Date,
  today = new Date(),
): CalendarMonth {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridDates = eachDayOfInterval({
    start: startOfWeek(monthStart, WEEK_OPTIONS),
    end: endOfWeek(monthEnd, WEEK_OPTIONS),
  })
  const todayKey = toDateKey(today)

  const weeks: CalendarWeek[] = []
  for (let i = 0; i < gridDates.length; i += 7) {
    const weekDates = gridDates.slice(i, i + 7)
    const cells: CalendarCell[] = weekDates.map((date) => {
      const key = toDateKey(date)
      return {
        date: key,
        dayOfMonth: date.getDate(),
        inMonth: isSameMonth(date, monthStart),
        isToday: key === todayKey,
        isFuture: key > todayKey,
        data: byDate.get(key) ?? null,
      }
    })

    const startKey = cells[0].date
    const endKey = cells[cells.length - 1].date
    const weekDays = cells
      .map((cell) => cell.data)
      .filter((day): day is DailyPnL => day !== null)

    weeks.push({
      key: startKey,
      startDate: startKey,
      endDate: endKey,
      weekOfYear: getISOWeek(weekDates[0]),
      cells,
      total: summarizeDays(weekDays, {
        key: startKey,
        label: weekLabel(startKey, endKey),
        startDate: startKey,
        endDate: endKey,
      }),
    })
  }

  const monthStartKey = toDateKey(monthStart)
  const monthEndKey = toDateKey(monthEnd)
  const monthKey = monthStartKey.slice(0, 7)

  return {
    monthKey,
    label: monthLabel(monthKey),
    startDate: monthStartKey,
    endDate: monthEndKey,
    weeks,
    total: summarizeDays(filterByRange(days, monthStartKey, monthEndKey), {
      key: monthKey,
      label: monthLabel(monthKey),
      startDate: monthStartKey,
      endDate: monthEndKey,
    }),
  }
}
