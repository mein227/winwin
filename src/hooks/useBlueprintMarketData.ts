import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Holding } from '../types'
import type { ExposureResult } from '../utils/exposure'
import { classifyBlueprintBucket } from '../utils/blueprint'
import {
  MARKET_INDEX_SYMBOL,
  fetchStockQuotes,
  type StockQuote,
} from '../services/stockQuote'

const AUTO_REFRESH_MS = 15 * 60 * 1000
const AUTO_CHECK_MS = 60 * 1000

export interface BlueprintMarketData {
  indexSymbol: string
  indexQuote: StockQuote | null
  leveragedDailyGain: number | null
  leveragedSymbols: string[]
  loading: boolean
  message: string
  refresh: () => void
}

/**
 * 自動取得台股加權指數與持有正二的最新收盤。
 *
 * 加權指數用來計算自使用者設定高點的回撤；
 * 正二今日損益則以「目前股數 ×（最新收盤 − 前一日收盤）」加總。
 */
export function useBlueprintMarketData(
  holdings: Holding[],
  exposure: ExposureResult,
): BlueprintMarketData {
  const leveragedSymbols = useMemo(
    () =>
      exposure.items
        .filter((item) => classifyBlueprintBucket(item) === 'leveraged')
        .map((item) => item.symbol.toUpperCase())
        .sort(),
    [exposure.items],
  )
  const holdingsRef = useRef(holdings)
  holdingsRef.current = holdings
  const leveragedHoldingSignature = useMemo(
    () =>
      holdings
        .filter(
          (holding) =>
            holding.shares > 0 &&
            leveragedSymbols.includes(holding.symbol.toUpperCase()),
        )
        .map((holding) => `${holding.symbol.toUpperCase()}:${holding.shares}`)
        .sort()
        .join('|'),
    [holdings, leveragedSymbols],
  )

  const [indexQuote, setIndexQuote] = useState<StockQuote | null>(null)
  const [leveragedDailyGain, setLeveragedDailyGain] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const runningRef = useRef(false)
  const lastRunRef = useRef(0)

  const symbolSignature = leveragedSymbols.join('|')

  const load = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    lastRunRef.current = Date.now()
    setLoading(true)

    try {
      const symbols = [MARKET_INDEX_SYMBOL, ...symbolSignature.split('|').filter(Boolean)]
      const { quotes, errors } = await fetchStockQuotes(symbols)
      const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]))
      setIndexQuote(quoteMap.get(MARKET_INDEX_SYMBOL) ?? null)

      const leveraged = symbolSignature.split('|').filter(Boolean)
      if (leveraged.length === 0) {
        setLeveragedDailyGain(null)
      } else {
        let gain = 0
        let found = 0
        for (const symbol of leveraged) {
          const quote = quoteMap.get(symbol)
          const holding = holdingsRef.current.find(
            (item) => item.symbol.toUpperCase() === symbol && item.shares > 0,
          )
          if (!quote || !holding) continue
          gain += holding.shares * quote.change
          found += 1
        }
        setLeveragedDailyGain(found > 0 ? gain : null)
      }

      setMessage(
        errors.length > 0
          ? `${errors
              .map((error) =>
                error.symbol === MARKET_INDEX_SYMBOL ? '加權指數' : error.symbol,
              )
              .join('、')} 收盤價更新失敗`
          : '',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '藍圖行情更新失敗')
    } finally {
      runningRef.current = false
      setLoading(false)
    }
  }, [symbolSignature])

  useEffect(() => {
    // 股數異動時也要用同一批收盤價重算正二單日損益。
    void leveragedHoldingSignature
    void load()
  }, [leveragedHoldingSignature, load])

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
    void load()
  }, [load])

  return {
    indexSymbol: MARKET_INDEX_SYMBOL,
    indexQuote,
    leveragedDailyGain,
    leveragedSymbols,
    loading,
    message,
    refresh,
  }
}
