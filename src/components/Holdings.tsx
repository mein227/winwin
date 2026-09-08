import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, RefreshCw } from 'lucide-react'
import type { Holding } from '../types'
import {
  formatNumber,
  formatPercent,
  formatSigned,
  pnlClass,
} from '../utils/calculations'
import { fetchStockQuotes, getWantgooUrl } from '../services/stockQuote'
import { useHoldingReturns } from '../hooks/useHoldingReturns'
import { FormulaHint } from './FormulaHint'

interface HoldingsProps {
  holdings: Holding[]
  onUpdatePrice: (symbol: string, price: number) => void
  onUpdatePrices: (updates: { symbol: string; currentPrice: number }[]) => void
}

type SortKey =
  | 'symbol'
  | 'dailyPnL'
  | 'currentPrice'
  | 'changePercent'
  | 'unrealizedPnL'
  | 'unrealizedPnLPercent'
  | 'shares'
  | 'avgCost'
  | 'totalCost'
  | 'marketValue'
  | 'weight'
  | 'return5'
  | 'return20'
  | 'returnYtd'
  | 'realizedPnL'

type SortDirection = 'asc' | 'desc'

interface ColumnMetric {
  key: SortKey
  label: string
}

/** 一個欄位可以疊兩個指標（例如市值／佔比），各自都能排序 */
interface Column {
  id: string
  align: 'left' | 'right'
  metrics: ColumnMetric[]
}

const COLUMNS: Column[] = [
  { id: 'symbol', align: 'left', metrics: [{ key: 'symbol', label: '庫存股' }] },
  { id: 'daily', align: 'right', metrics: [{ key: 'dailyPnL', label: '今日損益' }] },
  {
    id: 'price',
    align: 'right',
    metrics: [
      { key: 'currentPrice', label: '股價' },
      { key: 'changePercent', label: '漲跌幅' },
    ],
  },
  {
    id: 'pnl',
    align: 'right',
    metrics: [
      { key: 'unrealizedPnL', label: '總損益' },
      { key: 'unrealizedPnLPercent', label: '報酬率' },
    ],
  },
  { id: 'shares', align: 'right', metrics: [{ key: 'shares', label: '股數' }] },
  {
    id: 'cost',
    align: 'right',
    metrics: [
      { key: 'avgCost', label: '均價' },
      { key: 'totalCost', label: '總成本' },
    ],
  },
  {
    id: 'value',
    align: 'right',
    metrics: [
      { key: 'marketValue', label: '市值' },
      { key: 'weight', label: '佔比' },
    ],
  },
  { id: 'return5', align: 'right', metrics: [{ key: 'return5', label: '近5日漲幅' }] },
  { id: 'return20', align: 'right', metrics: [{ key: 'return20', label: '近20日漲幅' }] },
  { id: 'ytd', align: 'right', metrics: [{ key: 'returnYtd', label: '今年以來漲幅' }] },
  {
    id: 'realized',
    align: 'right',
    metrics: [{ key: 'realizedPnL', label: '已實現損益' }],
  },
]

const STICKY_SYMBOL_TH =
  'sticky left-0 z-20 min-w-[6rem] bg-slate-950 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.55)] sm:min-w-[8rem]'
const STICKY_SYMBOL_TD =
  'sticky left-0 z-10 min-w-[6rem] bg-slate-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)] group-hover:bg-slate-800 sm:min-w-[8rem]'
const CELL = 'whitespace-nowrap px-2.5 py-2 sm:px-4 sm:py-3'
const PRIMARY = 'text-sm font-semibold text-slate-100 sm:text-base'
const SECONDARY = 'mt-0.5 text-[0.6875rem] text-slate-500 sm:text-xs'

interface QuoteChange {
  change: number
  changePercent: number
}

interface HoldingRow {
  holding: Holding
  /** 今日損益＝股數 ×（今日漲跌價差） */
  dailyPnL: number | null
  changePercent: number | null
  return5: number | null
  return20: number | null
  returnYtd: number | null
}

function sortValue(row: HoldingRow, key: Exclude<SortKey, 'symbol'>): number | null {
  switch (key) {
    case 'dailyPnL':
      return row.dailyPnL
    case 'changePercent':
      return row.changePercent
    case 'return5':
      return row.return5
    case 'return20':
      return row.return20
    case 'returnYtd':
      return row.returnYtd
    default:
      return row.holding[key]
  }
}

function compareRows(
  a: HoldingRow,
  b: HoldingRow,
  key: SortKey,
  direction: SortDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (key === 'symbol') {
    const bySymbol = a.holding.symbol.localeCompare(b.holding.symbol, 'zh-Hant')
    if (bySymbol !== 0) return bySymbol * factor
    return a.holding.name.localeCompare(b.holding.name, 'zh-Hant') * factor
  }

  const aVal = sortValue(a, key)
  const bVal = sortValue(b, key)
  if (aVal == null && bVal == null) return 0
  // 沒有資料的一律排在最後，不隨升冪／降冪改變
  if (aVal == null) return 1
  if (bVal == null) return -1
  return (aVal - bVal) * factor
}

export function Holdings({ holdings, onUpdatePrice, onUpdatePrices }: HoldingsProps) {
  const active = useMemo(() => holdings.filter((h) => h.shares > 0), [holdings])
  const closed = holdings.filter((h) => h.shares <= 0 && Math.abs(h.realizedPnL) > 0)
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('marketValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [quoteChanges, setQuoteChanges] = useState<Record<string, QuoteChange>>({})
  const onUpdatePricesRef = useRef(onUpdatePrices)
  onUpdatePricesRef.current = onUpdatePrices

  const activeSymbols = useMemo(
    () => active.map((h) => h.symbol.toUpperCase()),
    [active],
  )
  const activeSymbolsKey = useMemo(
    () => [...activeSymbols].sort().join('|'),
    [activeSymbols],
  )
  const periods = useHoldingReturns(activeSymbols)

  const applyQuotes = (
    quotes: { symbol: string; price: number; change: number; changePercent: number }[],
  ) => {
    if (quotes.length === 0) return
    onUpdatePricesRef.current(
      quotes.map((q) => ({
        symbol: q.symbol,
        currentPrice: q.price,
      })),
    )
    setQuoteChanges((prev) => {
      const next = { ...prev }
      for (const q of quotes) {
        next[q.symbol.toUpperCase()] = {
          change: q.change,
          changePercent: q.changePercent,
        }
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

  const rows = useMemo<HoldingRow[]>(
    () =>
      active.map((holding) => {
        const key = holding.symbol.toUpperCase()
        const quote = quoteChanges[key]
        const period = periods.returns[key]
        // 有抓到即時行情就用行情，否則退回日 K 線的漲跌價差
        const change = quote?.change ?? period?.dayChange ?? null

        return {
          holding,
          dailyPnL: change == null ? null : holding.shares * change,
          changePercent: quote?.changePercent ?? period?.day ?? null,
          return5: period?.day5 ?? null,
          return20: period?.day20 ?? null,
          returnYtd: period?.ytd ?? null,
        }
      }),
    [active, quoteChanges, periods.returns],
  )

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDirection)),
    [rows, sortKey, sortDirection],
  )

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
      periods.refresh()
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

  const notice = message || periods.message

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">持股明細</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-400">
            金額單位為元，可左右滑動看更多欄位；點股價可手動修改，點股票代碼連到玩股網
            <FormulaHint
              title="近期漲幅"
              formula="近 N 日漲幅 = 最新收盤 ÷ N 個交易日前收盤 − 1；今年以來 = 最新收盤 ÷ 去年最後一個交易日收盤 − 1"
              note="收盤價已還原分割與減資，避免正 2 分割後出現假跌幅；未加回股利，因此高股息標的的漲幅不含配息。"
            />
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

      {notice && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200">
          {notice}
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
                  {COLUMNS.map((column) => (
                    <th
                      key={column.id}
                      className={`px-2.5 py-2 font-medium sm:px-4 sm:py-3 ${
                        column.align === 'right' ? 'text-right' : ''
                      } ${column.id === 'symbol' ? STICKY_SYMBOL_TH : ''}`}
                      aria-sort={
                        column.metrics.some((metric) => metric.key === sortKey)
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <div
                        className={`flex flex-col gap-0.5 ${
                          column.align === 'right' ? 'items-end' : 'items-start'
                        }`}
                      >
                        {column.metrics.map((metric) => {
                          const isActive = sortKey === metric.key
                          const SortIcon = !isActive
                            ? ArrowUpDown
                            : sortDirection === 'asc'
                              ? ArrowUp
                              : ArrowDown

                          return (
                            <button
                              key={metric.key}
                              type="button"
                              onClick={() => toggleSort(metric.key)}
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg text-[0.6875rem] transition-colors hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 sm:text-xs ${
                                isActive ? 'text-teal-300' : 'text-slate-400'
                              }`}
                              title={`依${metric.label}排序`}
                            >
                              <span>{metric.label}</span>
                              <SortIcon
                                className={`h-3 w-3 shrink-0 ${
                                  isActive ? 'text-teal-400' : 'text-slate-600'
                                }`}
                                aria-hidden
                              />
                            </button>
                          )
                        })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const h = row.holding

                  return (
                    <tr
                      key={h.symbol}
                      className="group border-b border-slate-800/70 last:border-0 hover:bg-slate-800/40"
                    >
                      <td className={`${CELL} ${STICKY_SYMBOL_TD}`}>
                        <p className="max-w-[7rem] whitespace-normal text-sm font-semibold text-white sm:max-w-none sm:text-base">
                          {h.name}
                        </p>
                        <a
                          href={getWantgooUrl(h.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.6875rem] text-slate-500 hover:text-teal-300 hover:underline sm:text-xs"
                          title={`在玩股網開啟 ${h.symbol}`}
                        >
                          {h.symbol}
                        </a>
                      </td>
                      <td
                        className={`${CELL} text-right ${PRIMARY} ${
                          row.dailyPnL == null ? 'text-slate-500' : pnlClass(row.dailyPnL)
                        }`}
                      >
                        {row.dailyPnL == null ? '—' : formatSigned(row.dailyPnL)}
                      </td>
                      <td className={`${CELL} text-right`}>
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
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(h)}
                              className={`inline-flex items-center gap-1 ${PRIMARY} hover:text-teal-300`}
                              title="手動更新現價"
                            >
                              {formatNumber(h.currentPrice)}
                              <RefreshCw className="h-3 w-3 text-slate-500" />
                            </button>
                            <p
                              className={`${SECONDARY} ${
                                row.changePercent == null
                                  ? ''
                                  : pnlClass(row.changePercent)
                              }`}
                            >
                              {row.changePercent == null
                                ? '—'
                                : formatPercent(row.changePercent)}
                            </p>
                          </>
                        )}
                      </td>
                      <td className={`${CELL} text-right`}>
                        <p className={`${PRIMARY} ${pnlClass(h.unrealizedPnL)}`}>
                          {formatSigned(h.unrealizedPnL)}
                        </p>
                        <p className={`${SECONDARY} ${pnlClass(h.unrealizedPnL)}`}>
                          {formatPercent(h.unrealizedPnLPercent)}
                        </p>
                      </td>
                      <td className={`${CELL} text-right ${PRIMARY}`}>
                        {formatNumber(h.shares, 0)}
                      </td>
                      <td className={`${CELL} text-right`}>
                        <p className={PRIMARY}>{formatNumber(h.avgCost)}</p>
                        <p className={SECONDARY}>{formatNumber(h.totalCost, 0)} 元</p>
                      </td>
                      <td className={`${CELL} text-right`}>
                        <p className={PRIMARY}>{formatNumber(h.marketValue, 0)}</p>
                        <p className={SECONDARY}>{formatNumber(h.weight, 1)}%</p>
                      </td>
                      <td
                        className={`${CELL} text-right ${PRIMARY} ${
                          row.return5 == null ? 'text-slate-500' : pnlClass(row.return5)
                        }`}
                      >
                        {row.return5 == null ? '—' : formatPercent(row.return5)}
                      </td>
                      <td
                        className={`${CELL} text-right ${PRIMARY} ${
                          row.return20 == null ? 'text-slate-500' : pnlClass(row.return20)
                        }`}
                      >
                        {row.return20 == null ? '—' : formatPercent(row.return20)}
                      </td>
                      <td
                        className={`${CELL} text-right ${PRIMARY} ${
                          row.returnYtd == null ? 'text-slate-500' : pnlClass(row.returnYtd)
                        }`}
                      >
                        {row.returnYtd == null ? '—' : formatPercent(row.returnYtd)}
                      </td>
                      <td
                        className={`${CELL} text-right ${PRIMARY} ${pnlClass(h.realizedPnL)}`}
                      >
                        {h.realizedPnL === 0 ? '—' : formatSigned(h.realizedPnL)}
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
                    <p className="font-medium text-white">{h.name}</p>
                    <a
                      href={getWantgooUrl(h.symbol)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-teal-300 hover:underline"
                      title={`在玩股網開啟 ${h.symbol}`}
                    >
                      {h.symbol}
                    </a>
                  </div>
                  <p className={`font-semibold ${pnlClass(h.realizedPnL)}`}>
                    {formatSigned(h.realizedPnL)}
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
