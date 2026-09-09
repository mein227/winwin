import { useCallback, useEffect, useRef, useState } from 'react'
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
  loading: boolean
  message: string
  refresh: () => void
}

/**
 * 自動取得台股加權指數最新收盤。
 *
 * 加權指數用來計算自使用者設定高點的回撤。
 */
export function useBlueprintMarketData(): BlueprintMarketData {
  const [indexQuote, setIndexQuote] = useState<StockQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const runningRef = useRef(false)
  const lastRunRef = useRef(0)

  const load = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    lastRunRef.current = Date.now()
    setLoading(true)

    try {
      const { quotes, errors } = await fetchStockQuotes([MARKET_INDEX_SYMBOL])
      setIndexQuote(quotes.find((quote) => quote.symbol === MARKET_INDEX_SYMBOL) ?? null)
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
    loading,
    message,
    refresh,
  }
}
