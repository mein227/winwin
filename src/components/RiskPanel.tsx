import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Activity, LoaderCircle, RefreshCw, Shield, TrendingDown } from 'lucide-react'
import type { AllocationSettings, PortfolioRisk } from '../types'
import type { ExposureResult } from '../utils/exposure'
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import { chartColor, tooltipStyle } from '../utils/chartColors'
import { FormulaCard } from './FormulaCard'

interface RiskPanelProps {
  risk: PortfolioRisk | null
  loading: boolean
  message: string
  exposure: ExposureResult
  settings: AllocationSettings
  onAnalyze: () => void
  onUpdateSettings: (patch: Partial<AllocationSettings>) => void
}

export function RiskPanel({
  risk,
  loading,
  message,
  exposure,
  settings,
  onAnalyze,
  onUpdateSettings,
}: RiskPanelProps) {
  const scatterData = useMemo(() => {
    if (!risk) return { assets: [], portfolio: [], benchmark: [] }
    return {
      assets: risk.assets.map((asset) => ({
        name: `${asset.symbol} ${asset.name}`,
        volatility: Number(asset.annualVolatility.toFixed(2)),
        return: Number(asset.annualReturn.toFixed(2)),
        weight: asset.weight,
      })),
      portfolio: [
        {
          name: '我的投資組合',
          volatility: Number(risk.annualVolatility.toFixed(2)),
          return: Number(risk.annualReturn.toFixed(2)),
          weight: 100,
        },
      ],
      benchmark: risk.benchmark
        ? [
            {
              name: `${risk.benchmark.symbol} ${risk.benchmark.name}`,
              volatility: Number(risk.benchmark.annualVolatility.toFixed(2)),
              return: Number(risk.benchmark.annualReturn.toFixed(2)),
              weight: 100,
            },
          ]
        : [],
    }
  }, [risk])

  const contributionData = useMemo(
    () =>
      risk?.assets.map((asset) => ({
        name: asset.symbol,
        weight: Number(asset.weight.toFixed(2)),
        risk: Number(asset.riskContribution.toFixed(2)),
      })) ?? [],
    [risk],
  )

  const parityCompare = useMemo(() => {
    if (!risk) return []
    return risk.riskParityWeights
      .map((item) => {
        const asset = risk.assets.find((a) => a.symbol === item.symbol)
        return {
          symbol: item.symbol,
          name: asset?.name ?? item.symbol,
          current: asset?.weight ?? 0,
          suggested: item.weight,
          volatility: asset?.annualVolatility ?? 0,
        }
      })
      .sort((a, b) => b.suggested - a.suggested)
  }, [risk])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">報酬風險分析</h3>
            <p className="mt-1 text-sm text-slate-400">
              抓取持股歷史收盤價，計算年化報酬、波動度、Beta、最大回撤與風險貢獻
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">無風險利率 %</span>
              <input
                type="number"
                step="any"
                value={settings.riskFreeRate}
                onChange={(e) =>
                  onUpdateSettings({ riskFreeRate: Number(e.target.value) || 0 })
                }
                className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">歷史天數</span>
              <input
                type="number"
                step="30"
                min="90"
                value={settings.historyDays}
                onChange={(e) =>
                  onUpdateSettings({ historyDays: Number(e.target.value) || 365 })
                }
                className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
              />
            </label>
            <button
              type="button"
              onClick={onAnalyze}
              disabled={loading || exposure.items.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              開始分析
            </button>
          </div>
        </div>
        {message && (
          <p className="mt-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200">
            {message}
          </p>
        )}
      </div>

      {!risk || risk.assets.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-slate-500">
          尚未分析，按下「開始分析」即會抓取歷史股價並計算報酬與風險
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">年化報酬（股票部位）</p>
              <p className={`mt-2 text-2xl font-bold ${pnlClass(risk.annualReturn)}`}>
                {formatPercent(risk.annualReturn, 1)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                含現金後 {formatPercent(risk.totalReturn, 1)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Activity className="h-4 w-4" /> 年化波動度
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-300">
                {formatNumber(risk.annualVolatility, 1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                含現金後 {formatNumber(risk.totalVolatility, 1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Shield className="h-4 w-4" /> 夏普值
              </p>
              <p className={`mt-2 text-2xl font-bold ${pnlClass(risk.sharpe)}`}>
                {formatNumber(risk.sharpe, 2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                報酬風險比 {formatNumber(risk.returnRiskRatio, 2)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <TrendingDown className="h-4 w-4" /> 最大回撤
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-300">
                -{formatNumber(risk.maxDrawdown, 1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                期間 {risk.startDate} ~ {risk.endDate}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">組合 Beta</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatNumber(risk.beta, 2)}
              </p>
              <p className="text-xs text-slate-500">相對 0050，大於 1 表示比大盤敏感</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">年度 95% VaR</p>
              <p className="mt-1 text-lg font-semibold text-rose-300">
                {formatCurrency(risk.var95)}
              </p>
              <p className="text-xs text-slate-500">
                約佔淨值 {formatNumber(risk.var95Percent, 1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">分散效益</p>
              <p className="mt-1 text-lg font-semibold text-teal-300">
                {formatNumber(risk.diversification, 1)} 個百分點
              </p>
              <p className="text-xs text-slate-500">
                加權平均波動 {formatNumber(risk.weightedVolatility, 1)}% → 組合{' '}
                {formatNumber(risk.annualVolatility, 1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">基準（0050）</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {risk.benchmark ? formatPercent(risk.benchmark.annualReturn, 1) : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {risk.benchmark
                  ? `波動 ${formatNumber(risk.benchmark.annualVolatility, 1)}%／回撤 -${formatNumber(risk.benchmark.maxDrawdown, 1)}%`
                  : '無基準資料'}
              </p>
            </div>
          </div>

          {risk.missing.length > 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
              {risk.missing.join('、')} 缺少足夠歷史資料，未納入計算
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <h3 className="mb-1 text-base font-semibold text-white">風險報酬分布</h3>
              <p className="mb-4 text-xs text-slate-500">
                越靠左上方越好（低波動、高報酬）
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      dataKey="volatility"
                      name="年化波動"
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="number"
                      dataKey="return"
                      name="年化報酬"
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ZAxis type="number" dataKey="weight" range={[60, 400]} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        `${formatNumber(Number(value ?? 0), 1)}%`,
                        name === 'volatility' ? '年化波動' : '年化報酬',
                      ]}
                      labelFormatter={() => ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Scatter name="個股／ETF" data={scatterData.assets} fill="#38bdf8">
                      {scatterData.assets.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColor(index)} />
                      ))}
                    </Scatter>
                    <Scatter
                      name="我的組合"
                      data={scatterData.portfolio}
                      fill="#14b8a6"
                      shape="star"
                    />
                    <Scatter
                      name="0050 基準"
                      data={scatterData.benchmark}
                      fill="#fbbf24"
                      shape="diamond"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <h3 className="mb-1 text-base font-semibold text-white">權重 vs 風險貢獻</h3>
              <p className="mb-4 text-xs text-slate-500">
                風險貢獻明顯高於權重的標的，是波動的主要來源
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        `${formatNumber(Number(value ?? 0), 1)}%`,
                        name === 'weight' ? '市值權重' : '風險貢獻',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) => (
                        <span className="text-slate-300">
                          {value === 'weight' ? '市值權重' : '風險貢獻'}
                        </span>
                      )}
                    />
                    <Bar dataKey="weight" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="risk" fill="#fb7185" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 px-4 py-3">
              <h3 className="font-semibold text-white">個別標的風險指標</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">標的</th>
                    <th className="px-4 py-3 font-medium text-right">權重</th>
                    <th className="px-4 py-3 font-medium text-right">年化報酬</th>
                    <th className="px-4 py-3 font-medium text-right">年化波動</th>
                    <th className="px-4 py-3 font-medium text-right">夏普值</th>
                    <th className="px-4 py-3 font-medium text-right">Beta</th>
                    <th className="px-4 py-3 font-medium text-right">最大回撤</th>
                    <th className="px-4 py-3 font-medium text-right">風險貢獻</th>
                  </tr>
                </thead>
                <tbody>
                  {risk.assets.map((asset) => (
                    <tr
                      key={asset.symbol}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{asset.symbol}</div>
                        <div className="text-xs text-slate-500">{asset.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatNumber(asset.weight, 1)}%
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(asset.annualReturn)}`}>
                        {formatPercent(asset.annualReturn, 1)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-200">
                        {formatNumber(asset.annualVolatility, 1)}%
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(asset.sharpe)}`}>
                        {formatNumber(asset.sharpe, 2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatNumber(asset.beta, 2)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-300">
                        -{formatNumber(asset.maxDrawdown, 1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-200">
                        {formatNumber(asset.riskContribution, 1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parityCompare.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <h3 className="text-base font-semibold text-white">風險平價建議權重</h3>
              <p className="mt-1 text-xs text-slate-500">
                以「權重與波動度成反比」配置，讓每檔標的貢獻相近的風險；可到「資產再平衡」頁一鍵套用。
                此方法只看波動不看報酬，債券等低波動標的權重會偏高，請搭配自己的預期報酬調整
              </p>
              <div className="mt-4 space-y-3">
                {parityCompare.map((item) => (
                  <div key={item.symbol} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-medium text-white">{item.symbol}</p>
                      <p className="text-xs text-slate-500">
                        σ {formatNumber(item.volatility, 1)}%
                      </p>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-xs text-slate-500">目前</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${Math.min(item.current, 100)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs text-slate-300">
                          {formatNumber(item.current, 1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-xs text-slate-500">建議</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-teal-400"
                            style={{ width: `${Math.min(item.suggested, 100)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs text-teal-300">
                          {formatNumber(item.suggested, 1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <FormulaCard
        title="報酬與風險的計算方式"
        items={[
          {
            label: '日報酬與年化報酬',
            formula:
              '日報酬 r = 漲跌價差 ÷ 前一日參考價　年化報酬 = (Π(1+r))^(252/n) − 1',
            note: '以交易所參考價還原，已排除 ETF 分割並計入配息；以 252 個交易日年化',
          },
          {
            label: '年化波動度',
            formula: '年化波動 σ = 日報酬標準差 × √252',
            note: '波動度是最常用的風險代表值，數字越大代表淨值上下震盪越劇烈',
          },
          {
            label: '組合波動（含相關性）',
            formula: 'σ_p = √(wᵀ Σ w)，Σ 為年化共變異數矩陣',
            note: '因為個股不會同步漲跌，組合波動會小於各標的波動的加權平均，差額就是分散效益',
          },
          {
            label: '夏普值（報酬風險平衡）',
            formula: '夏普值 = (年化報酬 − 無風險利率) ÷ 年化波動',
            note: '每承擔 1 單位風險換到多少超額報酬；大於 1 通常視為不錯',
          },
          {
            label: 'Beta',
            formula: 'Beta = Cov(個股報酬, 0050 報酬) ÷ Var(0050 報酬)',
            note: '衡量對大盤的敏感度；正 2 ETF 的 Beta 通常接近 2',
          },
          {
            label: '風險貢獻',
            formula: '邊際風險 = (Σw)_i ÷ σ_p　風險貢獻 = w_i × 邊際風險（合計等於 σ_p）',
            note: '權重不高但風險貢獻很高的標的，就是波動的真正來源',
          },
          {
            label: '最大回撤與 VaR',
            formula: '最大回撤 = min(淨值 ÷ 歷史高點 − 1)　年 95% VaR = 1.645 × σ × 總淨值',
            note: 'VaR 表示常態假設下，一年內有 5% 機率虧損會超過此金額',
          },
          {
            label: '槓桿 ETF 的處理',
            formula: '以市值權重搭配該 ETF 自身的歷史波動計算',
            note: '正 2 的歷史報酬已含槓桿效果，若再乘倍數會重複計算風險',
          },
        ]}
      />
    </div>
  )
}
