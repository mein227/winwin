import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildAdjustedCloses, fetchDailyBarsBatch } from '../services/stockQuote'
import { calcPeriodReturns, type PeriodReturns } from '../utils/periodReturn'

/** 要算今年以來漲幅，得涵蓋去年最後一個交易日，因此固定抓超過一年 */
const HISTORY_DAYS = 400

export interface HoldingReturns extends PeriodReturns {
  /** 最近一個交易日的漲跌（元／股），與交易紀錄同基準（未還原） */
  dayChange: number | null
}

export interface HoldingReturnsState {
  returns: Record<string, HoldingReturns>
  loading: boolean
  message: string
  refresh: () => void
}

/**
 * 取得持股的近 5 日、近 20 日與今年以來漲幅。
 *
 * 漲幅以還原分割／減資後的收盤價計算（否則 00631L 之類的標的會出現假跌幅），
 * 單日漲跌金額則沿用交易所公布的漲跌價差，與交易紀錄的成交價同基準。
 */
export function useHoldingReturns(symbols: string[]): HoldingReturnsState {
  const [returns, setReturns] = useState<Record<string, HoldingReturns>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const runningRef = useRef(false)

  const signature = useMemo(
    () => [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join('|'),
    [symbols],
  )

  const load = useCallback(
    async (force = false) => {
      const list = signature.split('|').filter(Boolean)
      if (list.length === 0) {
        setReturns({})
        setMessage('')
        return
      }
      if (runningRef.current) return

      runningRef.current = true
      setLoading(true)
      try {
        const { bars, errors } = await fetchDailyBarsBatch(list, HISTORY_DAYS, { force })
        const next: Record<string, HoldingReturns> = {}

        for (const item of bars) {
          const rows = item.dates.map((date, index) => ({
            date,
            close: item.closes[index],
            spread: item.spreads[index],
          }))
          const adjusted = buildAdjustedCloses(rows)
          const lastRow = rows[rows.length - 1]
          const previousRow = rows[rows.length - 2]
          const dayChange = !lastRow
            ? null
            : Number.isFinite(lastRow.spread)
              ? lastRow.spread
              : previousRow
                ? lastRow.close - previousRow.close
                : null

          next[item.symbol.toUpperCase()] = {
            ...calcPeriodReturns(adjusted.dates, adjusted.closes),
            dayChange,
          }
        }

        setReturns(next)
        setMessage(
          errors.length === 0
            ? ''
            : `${errors.map((e) => e.symbol).join('、')} 無歷史股價，近期漲幅無法計算`,
        )
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '近期漲幅更新失敗')
      } finally {
        setLoading(false)
        runningRef.current = false
      }
    },
    [signature],
  )

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(() => {
    void load(true)
  }, [load])

  return { returns, loading, message, refresh }
}
