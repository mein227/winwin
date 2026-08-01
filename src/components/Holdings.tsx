import { useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import type { Holding } from '../types'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  pnlClass,
} from '../utils/calculations'
import { fetchStockQuotes } from '../services/stockQuote'
import { StockExternalLinks } from './StockExternalLinks'

interface HoldingsProps {
  holdings: Holding[]
  onUpdatePrice: (symbol: string, price: number) => void
  onUpdatePrices: (updates: { symbol: string; currentPrice: number }[]) => void
}

export function Holdings({ holdings, onUpdatePrice, onUpdatePrices }: HoldingsProps) {
  const active = holdings.filter((h) => h.shares > 0)
  const closed = holdings.filter((h) => h.shares <= 0 && Math.abs(h.realizedPnL) > 0)
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')

  const startEdit = (h: Holding) => {
    setEditingSymbol(h.symbol)
    setPriceInput(String(h.currentPrice))
  }

  const savePrice = (symbol: string) => {
    const price = Number(priceInput)
    if (price > 0) {
      onUpdatePrice(symbol, price)
    }
    setEditingSymbol(null)
  }

  const refreshAll = async () => {
    if (active.length === 0) return
    setRefreshing(true)
    setMessage('')
    try {
      const { quotes, errors } = await fetchStockQuotes(active.map((h) => h.symbol))
      if (quotes.length > 0) {
        onUpdatePrices(
          quotes.map((q) => ({
            symbol: q.symbol,
            currentPrice: q.price,
          })),
        )
      }
      const ok = quotes.length
      const fail = errors.length
      setMessage(
        fail === 0
          ? `已更新 ${ok} 檔市價（FinMind／證交所公開資料）`
          : `已更新 ${ok} 檔，失敗 ${fail} 檔：${errors.map((e) => e.symbol).join(', ')}`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '更新失敗')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">持股明細</h2>
          <p className="mt-1 text-sm text-slate-400">
            可一鍵抓取最新收盤價，或點現價手動修改；也可連到 Goodinfo／玩股網查看詳細資訊
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={refreshing || active.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          一鍵更新市價
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {active.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-500">目前沒有持股</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">股票</th>
                  <th className="px-4 py-3 font-medium text-right">股數</th>
                  <th className="px-4 py-3 font-medium text-right">平均成本</th>
                  <th className="px-4 py-3 font-medium text-right">現價</th>
                  <th className="px-4 py-3 font-medium text-right">市值</th>
                  <th className="px-4 py-3 font-medium text-right">未實現損益</th>
                  <th className="px-4 py-3 font-medium text-right">報酬率</th>
                  <th className="px-4 py-3 font-medium text-right">權重</th>
                  <th className="px-4 py-3 font-medium text-right">已實現</th>
                </tr>
              </thead>
              <tbody>
                {active.map((h) => (
                  <tr
                    key={h.symbol}
                    className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{h.symbol}</div>
                      <div className="text-xs text-slate-500">{h.name}</div>
                      <StockExternalLinks symbol={h.symbol} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatNumber(h.shares, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatNumber(h.avgCost)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingSymbol === h.symbol ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            step="any"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePrice(h.symbol)
                              if (e.key === 'Escape') setEditingSymbol(null)
                            }}
                            className="w-24 rounded-lg border border-teal-500 bg-slate-950 px-2 py-1 text-right text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => savePrice(h.symbol)}
                            className="rounded-lg bg-teal-500/20 px-2 py-1 text-xs text-teal-300"
                          >
                            存
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(h)}
                          className="inline-flex items-center gap-1 text-slate-200 hover:text-teal-300"
                          title="手動更新現價"
                        >
                          {formatNumber(h.currentPrice)}
                          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatCurrency(h.marketValue)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pnlClass(h.unrealizedPnL)}`}>
                      {formatCurrency(h.unrealizedPnL)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pnlClass(h.unrealizedPnL)}`}>
                      {formatPercent(h.unrealizedPnLPercent)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatNumber(h.weight, 1)}%
                    </td>
                    <td className={`px-4 py-3 text-right ${pnlClass(h.realizedPnL)}`}>
                      {formatCurrency(h.realizedPnL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
          <h3 className="mb-3 text-base font-semibold text-white">已清倉標的</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((h) => (
              <div
                key={h.symbol}
                className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{h.symbol}</p>
                    <p className="text-xs text-slate-500">{h.name}</p>
                    <StockExternalLinks symbol={h.symbol} />
                  </div>
                  <p className={`font-semibold ${pnlClass(h.realizedPnL)}`}>
                    {formatCurrency(h.realizedPnL)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
