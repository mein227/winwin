import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, RefreshCw } from 'lucide-react'
import type { Holding } from '../types'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  pnlClass,
} from '../utils/calculations'
import { fetchStockQuotes, getWantgooUrl } from '../services/stockQuote'

interface HoldingsProps {
  holdings: Holding[]
  onUpdatePrice: (symbol: string, price: number) => void
  onUpdatePrices: (updates: { symbol: string; currentPrice: number }[]) => void
}

type SortKey =
  | 'symbol'
  | 'shares'
  | 'avgCost'
  | 'currentPrice'
  | 'marketValue'
  | 'dailyPnL'
  | 'unrealizedPnL'
  | 'unrealizedPnLPercent'
  | 'weight'
  | 'realizedPnL'

type SortDirection = 'asc' | 'desc'

interface SortColumn {
  key: SortKey
  label: string
  align: 'left' | 'right'
}

const SORT_COLUMNS: SortColumn[] = [
  { key: 'symbol', label: '股票', align: 'left' },
  { key: 'shares', label: '股數', align: 'right' },
  { key: 'avgCost', label: '平均成本', align: 'right' },
  { key: 'currentPrice', label: '現價', align: 'right' },
  { key: 'marketValue', label: '市值', align: 'right' },
  { key: 'dailyPnL', label: '今日損益', align: 'right' },
  { key: 'unrealizedPnL', label: '未實現損益', align: 'right' },
  { key: 'unrealizedPnLPercent', label: '報酬率', align: 'right' },
  { key: 'weight', label: '權重', align: 'right' },
  { key: 'realizedPnL', label: '已實現', align: 'right' },
]

const STICKY_SYMBOL_TH =
  'sticky left-0 z-20 min-w-[7.5rem] bg-slate-950 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.55)]'
const STICKY_SYMBOL_TD =
  'sticky left-0 z-10 min-w-[7.5rem] bg-slate-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)] group-hover:bg-slate-800'

function compareHoldings(a: Holding, b: Holding, key: Exclude<SortKey, 'dailyPnL'>): number {
  if (key === 'symbol') {
    const bySymbol = a.symbol.localeCompare(b.symbol, 'zh-Hant')
    if (bySymbol !== 0) return bySymbol
    return a.name.localeCompare(b.name, 'zh-Hant')
  }
  return a[key] - b[key]
}

function dailyPnLOf(holding: Holding, changes: Record<string, number>): number | null {
  const change = changes[holding.symbol.toUpperCase()]
  if (change === undefined) return null
  return holding.shares * change
}

export function Holdings({ holdings, onUpdatePrice, onUpdatePrices }: HoldingsProps) {
  const active = holdings.filter((h) => h.shares > 0)
  const closed = holdings.filter((h) => h.shares <= 0 && Math.abs(h.realizedPnL) > 0)
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('marketValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({})
  const onUpdatePricesRef = useRef(onUpdatePrices)
  onUpdatePricesRef.current = onUpdatePrices

  const activeSymbolsKey = useMemo(
    () =>
      holdings
        .filter((h) => h.shares > 0)
        .map((h) => h.symbol.toUpperCase())
        .sort()
        .join('|'),
    [holdings],
  )

  const applyQuotes = (quotes: { symbol: string; price: number; change: number }[]) => {
    if (quotes.length === 0) return
    onUpdatePricesRef.current(
      quotes.map((q) => ({
        symbol: q.symbol,
        currentPrice: q.price,
      })),
    )
    setDailyChanges((prev) => {
      const next = { ...prev }
      for (const q of quotes) {
        next[q.symbol.toUpperCase()] = q.change
      }
      return next
    })
  }

  useEffect(() => {
    if (!activeSymbolsKey) return
    const symbols = activeSymbolsKey.split('|').filter(Boolean)
    if (symbols.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const { quotes } = await fetchStockQuotes(symbols)
        if (!cancelled) applyQuotes(quotes)
      } catch {
        // 進入頁面時自動更新失敗不打擾使用者，可再按「一鍵更新市價」
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeSymbolsKey])

  const sortedActive = [...active].sort((a, b) => {
    if (sortKey === 'dailyPnL') {
      const aVal = dailyPnLOf(a, dailyChanges)
      const bVal = dailyPnLOf(b, dailyChanges)
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    const result = compareHoldings(a, b, sortKey)
    return sortDirection === 'asc' ? result : -result
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    // 股票代號預設升冪，其餘數值欄位預設降冪（大到小）
    setSortDirection(key === 'symbol' ? 'asc' : 'desc')
  }

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
      applyQuotes(quotes)
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
            可一鍵抓取最新收盤價，或點現價手動修改；點股票代碼可連到玩股網查看詳細資訊
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
                  {SORT_COLUMNS.map((column) => {
                    const isActive = sortKey === column.key
                    const SortIcon = !isActive
                      ? ArrowUpDown
                      : sortDirection === 'asc'
                        ? ArrowUp
                        : ArrowDown
                    const isSymbol = column.key === 'symbol'

                    return (
                      <th
                        key={column.key}
                        className={`px-4 py-3 font-medium ${
                          column.align === 'right' ? 'text-right' : ''
                        } ${isSymbol ? STICKY_SYMBOL_TH : ''}`}
                        aria-sort={
                          isActive
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 ${
                            column.align === 'right' ? 'ml-auto flex-row-reverse' : ''
                          } ${isActive ? 'text-teal-300' : 'text-slate-400'}`}
                          title={`依${column.label}排序`}
                        >
                          <span>{column.label}</span>
                          <SortIcon
                            className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-600'}`}
                            aria-hidden
                          />
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedActive.map((h) => {
                  const dailyPnL = dailyPnLOf(h, dailyChanges)

                  return (
                    <tr
                      key={h.symbol}
                      className="group border-b border-slate-800/70 last:border-0 hover:bg-slate-800/40"
                    >
                      <td className={`px-4 py-3 ${STICKY_SYMBOL_TD}`}>
                        <a
                          href={getWantgooUrl(h.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-teal-300 hover:text-teal-200 hover:underline"
                          title={`在玩股網開啟 ${h.symbol}`}
                        >
                          {h.symbol}
                        </a>
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
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          dailyPnL == null ? 'text-slate-500' : pnlClass(dailyPnL)
                        }`}
                      >
                        {dailyPnL == null ? '—' : formatCurrency(dailyPnL)}
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
                  )
                })}
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
                    <a
                      href={getWantgooUrl(h.symbol)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-teal-300 hover:text-teal-200 hover:underline"
                      title={`在玩股網開啟 ${h.symbol}`}
                    >
                      {h.symbol}
                    </a>
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
