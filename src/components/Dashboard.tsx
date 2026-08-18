import { useMemo, useState } from 'react'
import {
  Wallet,
  FileDown,
  FileUp,
  Trash2,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { ExposureSummary, Holding } from '../types'
import {
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  pnlClass,
} from '../utils/calculations'
import { fetchStockQuotes } from '../services/stockQuote'
import { buildEquityCurve } from '../utils/pnl'
import type { PnlCalendarState } from '../hooks/usePnlCalendar'
import { StatCard } from './StatCard'
import { StockExternalLinks } from './StockExternalLinks'
import { PnlPanel } from './PnlPanel'

interface DashboardProps {
  exposure: ExposureSummary
  holdings: Holding[]
  pnl: PnlCalendarState
  onExport: () => string
  onImport: (json: string) => void
  onClear: () => void
  onUpdatePrices: (updates: { symbol: string; currentPrice: number }[]) => void
}

export function Dashboard({
  exposure,
  holdings,
  pnl,
  onExport,
  onImport,
  onClear,
  onUpdatePrices,
}: DashboardProps) {
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // 用每日收盤價算出的損益序列畫淨值，市價變動當天就會反映在曲線上
  const equityCurve = useMemo(
    () => buildEquityCurve(pnl.series?.days ?? [], exposure.netWorth),
    [pnl.series, exposure.netWorth],
  )

  const equityChange = useMemo(() => {
    if (equityCurve.length < 2) return null
    const first = equityCurve[0]
    const last = equityCurve[equityCurve.length - 1]
    const diff = last.value - first.value
    return {
      diff,
      percent: first.value !== 0 ? (diff / Math.abs(first.value)) * 100 : 0,
      startDate: first.date,
      endDate: last.date,
    }
  }, [equityCurve])

  const topHoldings = holdings.filter((h) => h.shares > 0).slice(0, 5)

  const handleExport = () => {
    const data = onExport()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `winwin-portfolio-${format(new Date(), 'yyyyMMdd')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('已匯出資料')
  }

  const handleImport = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImport(String(reader.result))
        setMessage('匯入成功')
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '匯入失敗')
      }
    }
    reader.readAsText(file)
  }

  const handleClear = () => {
    if (window.confirm('確定要清除所有資料？此操作無法復原。')) {
      onClear()
      setMessage('已清除所有資料')
    }
  }

  const handleRefreshPrices = async () => {
    const symbols = holdings.filter((h) => h.shares > 0).map((h) => h.symbol)
    if (symbols.length === 0) {
      setMessage('目前沒有持股可更新')
      return
    }
    setRefreshing(true)
    try {
      const { quotes, errors } = await fetchStockQuotes(symbols)
      if (quotes.length > 0) {
        onUpdatePrices(quotes.map((q) => ({ symbol: q.symbol, currentPrice: q.price })))
      }
      setMessage(
        errors.length === 0
          ? `已更新 ${quotes.length} 檔市價`
          : `已更新 ${quotes.length} 檔，失敗 ${errors.length} 檔`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '更新市價失敗')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">資產總覽</h2>
          <p className="mt-1 text-sm text-slate-400">
            追蹤持股市值、已實現／未實現獲利與整體報酬率
          </p>
          <p className="mt-1 text-xs text-teal-300/80">
            {pnl.loading
              ? '正在自動更新市價…'
              : pnl.syncedAt
                ? `市價已自動更新${pnl.quoteDate ? `（${pnl.quoteDate} 收盤）` : ''}，同步於 ${format(parseISO(pnl.syncedAt), 'MM/dd HH:mm')}`
                : '開啟頁面時會自動更新市價'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshPrices()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/15 px-3 py-2 text-sm text-teal-200 hover:bg-teal-500/25 disabled:opacity-60"
          >
            {refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            更新市價
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <FileDown className="h-4 w-4" />
            匯出
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            <FileUp className="h-4 w-4" />
            匯入
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/70"
          >
            <Trash2 className="h-4 w-4" />
            清除
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="總淨值（股票＋現金）"
          value={formatCurrency(exposure.netWorth)}
          subtitle={`股票 ${formatCurrency(exposure.stockValue)}　淨現金 ${formatCurrency(exposure.netCash)}`}
          icon={<Wallet className="h-4 w-4" />}
          accent="teal"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">現金比重</p>
          <p className="mt-1 text-lg font-semibold text-sky-300">
            {formatNumber(exposure.cashRatio, 1)}%
          </p>
          <p className="text-xs text-slate-500">
            負債 {formatCurrency(exposure.debtValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">淨曝險</p>
          <p className="mt-1 text-lg font-semibold text-amber-300">
            {formatCurrency(exposure.netExposure)}
          </p>
          <p className="text-xs text-slate-500">
            槓桿標的 {formatCurrency(exposure.leveragedValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">曝險比率</p>
          <p className="mt-1 text-lg font-semibold text-teal-300">
            {formatNumber(exposure.exposureRatio, 1)}%
          </p>
          <p className="text-xs text-slate-500">
            實質槓桿 {formatNumber(exposure.leverageRatio, 2)} 倍
          </p>
        </div>
      </div>

      <PnlPanel
        series={pnl.series}
        loading={pnl.loading}
        message={pnl.message}
        syncedAt={pnl.syncedAt}
        quoteDate={pnl.quoteDate}
        onRefresh={pnl.refresh}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">資產淨值走勢（估算）</h3>
              <p className="mt-1 text-xs text-slate-500">
                以每日收盤價逐日估算，最後一點等於目前總淨值
              </p>
            </div>
            {equityChange && (
              <div className="text-right">
                <p className={`text-sm font-semibold ${pnlClass(equityChange.diff)}`}>
                  {formatCurrency(equityChange.diff)}（{formatPercent(equityChange.percent)}）
                </p>
                <p className="text-xs text-slate-500">
                  {equityChange.startDate} ~ {equityChange.endDate}
                </p>
              </div>
            )}
          </div>
          <div className="h-64 w-full">
            {equityCurve.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                {pnl.loading
                  ? '正在取得歷史股價並計算淨值走勢…'
                  : '尚無資料，請先到「進出紀錄」新增買進或賣出'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equityCurve}>
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={12}
                    minTickGap={32}
                    tickFormatter={(v) => String(v).slice(5).replace('-', '/')}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    width={64}
                    // 淨值多半只在小區間內波動，固定從 0 起算會讓曲線看起來是一條直線
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => formatCompact(v as number)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      String(name),
                    ]}
                  />
                  <Area
                    name="淨值"
                    type="monotone"
                    dataKey="value"
                    stroke="#2dd4bf"
                    strokeWidth={2}
                    fill="url(#equityFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    name="持股市值"
                    type="monotone"
                    dataKey="marketValue"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-white">持股貢獻 TOP 5</h3>
          {topHoldings.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">尚無持股，請先新增進出紀錄</p>
          ) : (
            <ul className="space-y-3">
              {topHoldings.map((h) => (
                <li
                  key={h.symbol}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {h.symbol}{' '}
                      <span className="text-slate-400">{h.name}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      市值 {formatCurrency(h.marketValue)} · 權重 {h.weight.toFixed(1)}%
                    </p>
                    <StockExternalLinks symbol={h.symbol} />
                  </div>
                  <div className={`text-right text-sm font-semibold ${pnlClass(h.unrealizedPnL)}`}>
                    <div>{formatCurrency(h.unrealizedPnL)}</div>
                    <div className="text-xs">{formatPercent(h.unrealizedPnLPercent)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
