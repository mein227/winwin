import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Holding } from '../types'
import type { ExposureResult } from '../utils/exposure'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import {
  CASH_COLOR,
  CHART_FONT_SIZE,
  GAIN_COLOR,
  LOSS_COLOR,
  chartColor,
  tooltipStyle,
} from '../utils/chartColors'
import { FormulaCard } from './FormulaCard'

interface AllocationOverviewProps {
  holdings: Holding[]
  exposure: ExposureResult
}

export function AllocationOverview({ holdings, exposure }: AllocationOverviewProps) {
  const { items, summary, breakdown } = exposure
  const active = holdings.filter((h) => h.shares > 0)
  const isMobile = useIsMobile()

  const pieData = useMemo(() => {
    const data = items.map((item, index) => ({
      name: `${item.symbol} ${item.name}`,
      value: item.marketValue,
      weight: item.valueWeight,
      color: chartColor(index),
    }))
    if (summary.netCash > 0) {
      data.push({
        name: '現金',
        value: summary.netCash,
        weight: summary.cashRatio,
        color: CASH_COLOR,
      })
    }
    return data
  }, [items, summary.netCash, summary.cashRatio])

  const classData = useMemo(() => {
    const data = breakdown.map((group, index) => ({
      name: group.label,
      value: group.marketValue,
      weight: group.valueWeight,
      color: chartColor(index + 2),
    }))
    if (summary.netCash > 0) {
      data.push({
        name: '現金',
        value: summary.netCash,
        weight: summary.cashRatio,
        color: CASH_COLOR,
      })
    }
    return data
  }, [breakdown, summary.netCash, summary.cashRatio])

  const pnlData = useMemo(
    () =>
      active.map((h) => ({
        name: h.symbol,
        pnl: Math.round(h.unrealizedPnL),
        pct: h.unrealizedPnLPercent,
      })),
    [active],
  )

  const concentration = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.valueWeight - a.valueWeight)
    return {
      top1: sorted[0]?.valueWeight ?? 0,
      top1Symbol: sorted[0]?.symbol ?? '—',
      top3: sorted.slice(0, 3).reduce((sum, item) => sum + item.valueWeight, 0),
    }
  }, [items])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
          <p className="text-xs text-slate-400 sm:text-sm">總淨值</p>
          <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
            {formatCurrency(summary.netWorth)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            股票 + 淨現金
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
          <p className="text-xs text-slate-400 sm:text-sm">股票市值</p>
          <p className="mt-1 text-lg font-bold text-teal-300 sm:mt-2 sm:text-2xl">
            {formatCurrency(summary.stockValue)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            佔淨值{' '}
            {formatNumber(
              summary.netWorth > 0 ? (summary.stockValue / summary.netWorth) * 100 : 0,
              1,
            )}
            %
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
          <p className="text-xs text-slate-400 sm:text-sm">現金比重</p>
          <p className="mt-1 text-lg font-bold text-sky-300 sm:mt-2 sm:text-2xl">
            {formatNumber(summary.cashRatio, 1)}%
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            淨現金 {formatCurrency(summary.netCash)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
          <p className="text-xs text-slate-400 sm:text-sm">前三大集中度</p>
          <p className="mt-1 text-lg font-bold text-amber-300 sm:mt-2 sm:text-2xl">
            {formatNumber(concentration.top3, 1)}%
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            最大 {concentration.top1Symbol} {formatNumber(concentration.top1, 1)}%
          </p>
        </div>
      </div>

      {items.length === 0 && summary.netCash === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-slate-500">
          尚無持股或現金資料，請先新增進出紀錄與現金帳戶
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-white sm:mb-4 sm:text-base">
              全資產配置（含現金）
            </h3>
            <div className="h-48 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => [
                      `${formatCurrency(Number(value ?? 0))}（${Number(item?.payload?.weight ?? 0).toFixed(1)}%）`,
                      '金額',
                    ]}
                  />
                  {/* 手機省略圖例，下方「配置明細」已用同一組顏色列出每檔標的 */}
                  {!isMobile && (
                    <Legend
                      wrapperStyle={{ fontSize: CHART_FONT_SIZE }}
                      formatter={(value) => (
                        <span className="text-slate-300">{String(value)}</span>
                      )}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-white sm:mb-4 sm:text-base">
              資產類別分布
            </h3>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    paddingAngle={2}
                  >
                    {classData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => [
                      `${formatCurrency(Number(value ?? 0))}（${Number(item?.payload?.weight ?? 0).toFixed(1)}%）`,
                      '金額',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: CHART_FONT_SIZE }}
                    formatter={(value) => (
                      <span className="text-slate-300">{String(value)}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {pnlData.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-white sm:mb-4 sm:text-base">
            未實現損益比較
          </h3>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={CHART_FONT_SIZE} />
                <YAxis
                  stroke="#64748b"
                  fontSize={CHART_FONT_SIZE}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('zh-TW', { notation: 'compact' }).format(
                      v as number,
                    )
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, _name, item) => [
                    `${formatCurrency(Number(value ?? 0))}（${formatPercent(Number(item?.payload?.pct ?? 0))}）`,
                    '未實現損益',
                  ]}
                />
                <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
                  {pnlData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.pnl >= 0 ? GAIN_COLOR : LOSS_COLOR}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-3 py-2 sm:px-4 sm:py-3">
            <h3 className="text-sm font-semibold text-white sm:text-base">配置明細</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {items.map((item, index) => {
              const holding = active.find((h) => h.symbol === item.symbol)
              const bar = (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.abs(item.valueWeight), 100)}%`,
                    background: chartColor(index),
                  }}
                />
              )
              return (
                <div
                  key={item.symbol}
                  className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5"
                >
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 self-start rounded-full sm:mt-0 sm:h-3 sm:w-3 sm:self-center"
                    style={{ background: chartColor(index) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white sm:text-base">
                      {item.symbol} <span className="text-slate-400">{item.name}</span>
                    </p>
                    <p className="truncate text-[0.6875rem] text-slate-500 sm:text-xs">
                      {formatCurrency(item.marketValue)}
                      {holding && ` · 成本 ${formatCurrency(holding.totalCost)}`}
                    </p>
                    {/* 手機沒有寬度並排長條，改放在標的下方 */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800 sm:hidden">
                      {bar}
                    </div>
                  </div>
                  <div className="hidden h-2 w-40 shrink-0 overflow-hidden rounded-full bg-slate-800 sm:block lg:w-56">
                    {bar}
                  </div>
                  <div className="shrink-0 text-right sm:flex sm:items-center sm:gap-4">
                    <span className="block text-sm text-slate-300 sm:w-14">
                      {formatNumber(item.valueWeight, 1)}%
                    </span>
                    <span
                      className={`block text-[0.6875rem] font-medium sm:w-24 sm:text-sm ${pnlClass(
                        holding?.unrealizedPnL ?? 0,
                      )}`}
                    >
                      {formatPercent(holding?.unrealizedPnLPercent ?? 0)}
                    </span>
                  </div>
                </div>
              )
            })}
            {summary.netCash > 0 && (
              <div className="flex items-center justify-between gap-3 bg-slate-950/40 px-3 py-2.5 sm:px-4 sm:py-3.5">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3"
                    style={{ background: CASH_COLOR }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white sm:text-base">現金</p>
                    <p className="truncate text-[0.6875rem] text-slate-500 sm:text-xs">
                      {formatCurrency(summary.netCash)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm text-slate-300">
                  {formatNumber(summary.cashRatio, 1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <FormulaCard
        items={[
          {
            label: '配置權重（佔淨值）',
            formula: '權重 = 個別市值 ÷ 總淨值 × 100%',
            note: '分母含現金，才看得出真正的股票／現金配置',
          },
          {
            label: '集中度',
            formula: '前三大集中度 = 權重最高三檔的權重合計',
            note: '單一標的建議不超過 20~25%，前三大不超過 50~60%',
          },
        ]}
      />
    </div>
  )
}
