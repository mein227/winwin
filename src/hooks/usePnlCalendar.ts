import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Holding, PnlSeries, Transaction } from '../types'
import { fetchDailyBarsBatch } from '../services/stockQuote'
import { buildDailyPnlSeries } from '../utils/pnl'

const RESULT_KEY = 'winwin_pnl_series_v1'
/** 停留在頁面時多久自動抓一次新資料；日 K 線本身另有較短的快取，重新計算不會重複打 API */
const AUTO_REFRESH_MS = 15 * 60 * 1000
const AUTO_CHECK_MS = 60 * 1000
const MIN_HISTORY_DAYS = 60
const MAX_HISTORY_DAYS = 5 * 365

interface StoredResult {
  series: PnlSeries
  syncedAt: string
  quoteDate: string
}

function loadStored(): StoredResult | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredResult
    return parsed?.series?.days ? parsed : null
  } catch {
    return null
  }
}

function saveStored(result: StoredResult) {
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(result))
  } catch {
    /* 容量不足時僅保留本次結果 */
  }
}

/** 需要抓多久的歷史：涵蓋最早一筆交易，並保留門檻避免請求過大 */
function historyDays(transactions: Transaction[]): number {
  const earliest = transactions.reduce(
    (min, tx) => (tx.date && (!min || tx.date < min) ? tx.date : min),
    '',
  )
  if (!earliest) return MIN_HISTORY_DAYS
  const span = differenceInCalendarDays(new Date(), parseISO(earliest)) + 10
  return Math.min(Math.max(span, MIN_HISTORY_DAYS), MAX_HISTORY_DAYS)
}

export interface PnlCalendarState {
  series: PnlSeries | null
  loading: boolean
  message: string
  /** 最後一次同步的時間（ISO） */
  syncedAt: string
  /** 市價對應的交易日 */
  quoteDate: string
  refresh: () => void
}

export interface UsePnlCalendarOptions {
  transactions: Transaction[]
  holdings: Holding[]
  /** 抓到最新收盤價時同步回寫市價 */
  onLatestPrices?: (updates: { symbol: string; currentPrice: number }[]) => void
}

/**
 * 抓取持股日 K 線並算出每日損益，同時把最新收盤價回寫成市價。
 *
 * 使用者開啟頁面、切回分頁或停留一段時間後都會自動更新，
 * 因此月曆與總覽的數字不需要手動按更新市價。
 */
export function usePnlCalendar({
  transactions,
  holdings,
  onLatestPrices,
}: UsePnlCalendarOptions): PnlCalendarState {
  const stored = useRef<StoredResult | null>(loadStored())
  const [series, setSeries] = useState<PnlSeries | null>(stored.current?.series ?? null)
  const [syncedAt, setSyncedAt] = useState(stored.current?.syncedAt ?? '')
  const [quoteDate, setQuoteDate] = useState(stored.current?.quoteDate ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const transactionsRef = useRef(transactions)
  const holdingsRef = useRef(holdings)
  const onLatestPricesRef = useRef(onLatestPrices)
  transactionsRef.current = transactions
  holdingsRef.current = holdings
  onLatestPricesRef.current = onLatestPrices

  const runningRef = useRef(false)
  const lastRunRef = useRef(0)

  const load = useCallback(async (force = false) => {
    const txs = transactionsRef.current
    if (txs.length === 0) {
      setSeries(null)
      setMessage('')
      return
    }
    if (runningRef.current) return

    runningRef.current = true
    setLoading(true)
    try {
      const symbols = [...new Set(txs.map((tx) => tx.symbol.toUpperCase()))]
      const { bars, errors } = await fetchDailyBarsBatch(symbols, historyDays(txs), {
        force,
      })

      const next = buildDailyPnlSeries(txs, bars)
      const latestDate = bars.reduce(
        (max, item) => {
          const last = item.dates[item.dates.length - 1] ?? ''
          return last > max ? last : max
        },
        '',
      )
      const now = new Date().toISOString()

      setSeries(next)
      setSyncedAt(now)
      setQuoteDate(latestDate)
      saveStored({ series: next, syncedAt: now, quoteDate: latestDate })
      lastRunRef.current = Date.now()

      // 只回寫真的有變動的市價，避免多餘的重繪與寫入
      const updates: { symbol: string; currentPrice: number }[] = []
      for (const item of bars) {
        const latest = item.closes[item.closes.length - 1]
        if (!(latest > 0)) continue
        const holding = holdingsRef.current.find(
          (h) => h.symbol === item.symbol && h.shares > 0,
        )
        if (!holding) continue
        if (Math.abs(holding.currentPrice - latest) < 1e-9) continue
        updates.push({ symbol: item.symbol, currentPrice: latest })
      }
      if (updates.length > 0) onLatestPricesRef.current?.(updates)

      setMessage(
        errors.length === 0
          ? ''
          : `${errors.map((e) => e.symbol).join('、')} 無歷史股價，該部分損益以成交價估算`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '損益資料更新失敗')
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [])

  // 交易紀錄變動時重新計算（歷史股價命中快取時不會再打 API）
  const signature = useMemo(
    () =>
      transactions
        .map((tx) =>
          [tx.id, tx.symbol, tx.type, tx.date, tx.price, tx.shares, tx.fee, tx.tax].join(
            ':',
          ),
        )
        .sort()
        .join('|'),
    [transactions],
  )

  useEffect(() => {
    void load()
  }, [signature, load])

  // 瀏覽期間自動更新：切回分頁、視窗取得焦點或停留超過間隔時
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRunRef.current < AUTO_REFRESH_MS) return
      void load()
    }

    document.addEventListener('visibilitychange', maybeRefresh)
    window.addEventListener('focus', maybeRefresh)
    const timer = window.setInterval(maybeRefresh, AUTO_CHECK_MS)

    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh)
      window.removeEventListener('focus', maybeRefresh)
      window.clearInterval(timer)
    }
  }, [load])

  const refresh = useCallback(() => {
    void load(true)
  }, [load])

  return { series, loading, message, syncedAt, quoteDate, refresh }
}
