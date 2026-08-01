import { useMemo } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { Holding, PortfolioSummary } from '../types'
import { formatCurrency, formatPercent, pnlClass } from '../utils/calculations'

interface AllocationProps {
  holdings: Holding[]
  summary: PortfolioSummary
}

const COLORS = [
  '#14b8a6',
  '#38bdf8',
  '#a78bfa',
  '#fbbf24',
  '#f472b6',
  '#34d399',
  '#fb7185',
  '#60a5fa',
  '#c084fc',
  '#fcd34d',
]

export function Allocation({ holdings, summary }: AllocationProps) {
  const active = holdings.filter((h) => h.shares > 0)

  const pieData = useMemo(
    () =>
      active.map((h) => ({
        name: `${h.symbol} ${h.name}`,
        symbol: h.symbol,
        value: h.marketValue,
        weight: h.weight,
      })),
    [active],
  )

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
    const top3 = active.slice(0, 3).reduce((s, h) => s + h.weight, 0)
    const top1 = active[0]?.weight ?? 0
    return { top1, top3 }
  }, [active])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">資產配置</h2>
        <p className="mt-1 text-sm text-slate-400">
          依市值檢視持股配置、集中度與各標的損益貢獻
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">投資組合市值</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(summary.totalMarketValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">最大持股權重</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">
            {formatPercent(concentration.top1).replace('+', '')}
          </p>
          <p className="mt-1 text-xs text-slate-500">{active[0]?.symbol ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">前三大集中度</p>
          <p className="mt-2 text-2xl font-bold text-sky-300">
            {formatPercent(concentration.top3).replace('+', '')}
          </p>
          <p className="mt-1 text-xs text-slate-500">建議留意過度集中風險</p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-slate-500">
          尚無持股可分析配置
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">市值配置比例</h3>
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
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                    }}
                    formatter={(value, _name, item) => [
                      `${formatCurrency(Number(value ?? 0))}（${Number(item?.payload?.weight ?? 0).toFixed(1)}%）`,
                      '市值',
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
                      new Intl.NumberFormat('zh-TW', {
                        notation: 'compact',
                      }).format(v as number)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 12,
                    }}
                    formatter={(value, _name, item) => [
                      `${formatCurrency(Number(value ?? 0))}（${formatPercent(Number(item?.payload?.pct ?? 0))}）`,
                      '未實現損益',
                    ]}
                  />
                  <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
                    {pnlData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.pnl >= 0 ? '#34d399' : '#fb7185'}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="font-semibold text-white">配置明細</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {active.map((h, index) => (
              <div
                key={h.symbol}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <p className="font-medium text-white">
                      {h.symbol} <span className="text-slate-400">{h.name}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(h.marketValue)} · 成本 {formatCurrency(h.totalCost)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:min-w-[280px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(h.weight, 100)}%`,
                        background: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm text-slate-300">
                    {h.weight.toFixed(1)}%
                  </span>
                  <span className={`w-24 text-right text-sm font-medium ${pnlClass(h.unrealizedPnL)}`}>
                    {formatPercent(h.unrealizedPnLPercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
