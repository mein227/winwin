import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Holding } from '../types'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  pnlClass,
} from '../utils/calculations'

interface HoldingsProps {
  holdings: Holding[]
  onUpdatePrice: (symbol: string, price: number) => void
}

export function Holdings({ holdings, onUpdatePrice }: HoldingsProps) {
  const active = holdings.filter((h) => h.shares > 0)
  const closed = holdings.filter((h) => h.shares <= 0 && Math.abs(h.realizedPnL) > 0)
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">持股明細</h2>
        <p className="mt-1 text-sm text-slate-400">
          依移動平均成本計算未實現損益，可手動更新目前市價
        </p>
      </div>

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
                          title="更新現價"
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
