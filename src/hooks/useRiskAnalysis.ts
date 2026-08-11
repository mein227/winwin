import { useCallback, useState } from 'react'
import type { ExposureItem, PortfolioRisk } from '../types'
import { BENCHMARK_SYMBOL, fetchPriceHistories } from '../services/stockQuote'
import { calculatePortfolioRisk } from '../utils/risk'

const RESULT_KEY = 'winwin_risk_result_v1'

export interface RiskAnalysisParams {
  items: ExposureItem[]
  netWorth: number
  riskFreeRate: number
  cashRate: number
  historyDays: number
}

function loadResult(): PortfolioRisk | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    return raw ? (JSON.parse(raw) as PortfolioRisk) : null
  } catch {
    return null
  }
}

/**
 * 抓取持股歷史股價並計算報酬／風險指標。
 * 結果會存在瀏覽器，重新開啟頁面時不需重新查詢。
 */
export function useRiskAnalysis() {
  const [risk, setRisk] = useState<PortfolioRisk | null>(() => loadResult())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const analyze = useCallback(async (params: RiskAnalysisParams) => {
    const symbols = params.items.map((item) => item.symbol)
    if (symbols.length === 0) {
      setMessage('目前沒有持股可分析')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const { histories, errors } = await fetchPriceHistories(
        [...symbols, BENCHMARK_SYMBOL],
        params.historyDays,
      )

      const benchmark =
        histories.find((h) => h.symbol === BENCHMARK_SYMBOL) ?? null
      const series = histories.filter((h) => symbols.includes(h.symbol))

      const result = calculatePortfolioRisk({
        positions: params.items.map((item) => ({
          symbol: item.symbol,
          name: item.name,
          marketValue: item.marketValue,
        })),
        series,
        benchmark,
        netWorth: params.netWorth,
        riskFreeRate: params.riskFreeRate,
        cashRate: params.cashRate,
      })

      setRisk(result)
      try {
        localStorage.setItem(RESULT_KEY, JSON.stringify(result))
      } catch {
        /* 容量不足時僅保留本次結果 */
      }

      const failed = errors.filter((e) => e.symbol !== BENCHMARK_SYMBOL)
      setMessage(
        result.tradingDays === 0
          ? '歷史資料不足，無法計算風險指標'
          : failed.length === 0
            ? `已用 ${result.tradingDays} 個交易日資料計算（${result.startDate} ~ ${result.endDate}）`
            : `已計算 ${result.assets.length} 檔，${failed.map((e) => e.symbol).join('、')} 無歷史資料`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '風險分析失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  return { risk, loading, message, analyze }
}
