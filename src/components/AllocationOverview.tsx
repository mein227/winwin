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
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import { CASH_COLOR, GAIN_COLOR, LOSS_COLOR, chartColor, tooltipStyle } from '../utils/chartColors'
import { FormulaCard } from './FormulaCard'

interface AllocationOverviewProps {
  holdings: Holding[]
  exposure: ExposureResult
}

export function AllocationOverview({ holdings, exposure }: AllocationOverviewProps) {
  const { items, summary, breakdown } = exposure
  const active = holdings.filter((h) => h.shares > 0)

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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">總淨值</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(summary.netWorth)}
          </p>
          <p className="mt-1 text-xs text-slate-500">股票 + 淨現金</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">股票市值</p>
          <p className="mt-2 text-2xl font-bold text-teal-300">
            {formatCurrency(summary.stockValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            佔淨值{' '}
            {formatNumber(
              summary.netWorth > 0 ? (summary.stockValue / summary.netWorth) * 100 : 0,
              1,
            )}
            %
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">現金比重</p>
          <p className="mt-2 text-2xl font-bold text-sky-300">
            {formatNumber(summary.cashRatio, 1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            淨現金 {formatCurrency(summary.netCash)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">前三大集中度</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">
            {formatNumber(concentration.top3, 1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            最大 {concentration.top1Symbol} {formatNumber(concentration.top1, 1)}%
          </p>
        </div>
      </div>

      {items.length === 0 && summary.netCash === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-slate-500">
          尚無持股或現金資料，請先新增進出紀錄與現金帳戶
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">
              全資產配置（含現金）
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
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
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => (
                      <span className="text-slate-300">{String(value)}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">資產類別分布</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
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
                    wrapperStyle={{ fontSize: 12 }}
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h3 className="mb-4 text-base font-semibold text-white">未實現損益比較</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
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
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="font-semibold text-white">配置明細</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {items.map((item, index) => {
              const holding = active.find((h) => h.symbol === item.symbol)
              return (
                <div
                  key={item.symbol}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: chartColor(index) }}
                    />
                    <div>
                      <p className="font-medium text-white">
                        {item.symbol} <span className="text-slate-400">{item.name}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(item.marketValue)}
                        {holding && ` · 成本 ${formatCurrency(holding.totalCost)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:min-w-[280px]">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(Math.abs(item.valueWeight), 100)}%`,
                          background: chartColor(index),
                        }}
                      />
                    </div>
                    <span className="w-14 text-right text-sm text-slate-300">
                      {formatNumber(item.valueWeight, 1)}%
                    </span>
                    <span
                      className={`w-24 text-right text-sm font-medium ${pnlClass(
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
              <div className="flex items-center justify-between gap-3 bg-slate-950/40 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: CASH_COLOR }}
                  />
                  <div>
                    <p className="font-medium text-white">現金</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(summary.netCash)}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-slate-300">
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
