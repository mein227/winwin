import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Gauge, RotateCcw, TriangleAlert, Zap } from 'lucide-react'
import type { AllocationSettings, AssetClass, AssetSetting } from '../types'
import type { ExposureResult } from '../utils/exposure'
import {
  assetClassLabel,
  assetClassOptions,
  estimateLeveragedReturn,
  leverageDecay,
  marketScenario,
} from '../utils/exposure'
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import { tooltipStyle } from '../utils/chartColors'
import { FormulaCard } from './FormulaCard'

interface ExposurePanelProps {
  exposure: ExposureResult
  assetSettings: AssetSetting[]
  settings: AllocationSettings
  benchmarkVolatility?: number
  onSetOverride: (
    symbol: string,
    override: { leverage: number; assetClass: AssetClass },
  ) => void
  onReset: (symbol: string) => void
  onUpdateSettings: (patch: Partial<AllocationSettings>) => void
}

const SCENARIOS = [-30, -20, -10, -5, 5, 10, 20, 30]

export function ExposurePanel({
  exposure,
  assetSettings,
  settings,
  benchmarkVolatility,
  onSetOverride,
  onReset,
  onUpdateSettings,
}: ExposurePanelProps) {
  const { items, summary } = exposure
  const [calc, setCalc] = useState({
    leverage: '2',
    volatility: String(Math.round(benchmarkVolatility ?? 22)),
    marketReturn: '8',
    years: '5',
  })

  const chartData = useMemo(
    () =>
      items.map((item) => ({
        name: item.symbol,
        marketValue: Math.round(item.marketValue),
        exposure: Math.round(item.exposure),
      })),
    [items],
  )

  const overLimit = summary.exposureRatio > settings.maxExposureRatio

  const decay = useMemo(() => {
    const k = Number(calc.leverage) || 1
    const sigma = Number(calc.volatility) || 0
    const mu = Number(calc.marketReturn) || 0
    const years = Math.max(Number(calc.years) || 1, 1)
    const drag = leverageDecay(k, sigma)
    const etfReturn = estimateLeveragedReturn(k, mu, sigma)
    const marketGrowth = (Math.pow(1 + mu / 100, years) - 1) * 100
    const etfGrowth = (Math.pow(1 + etfReturn / 100, years) - 1) * 100
    return { k, sigma, mu, years, drag, etfReturn, marketGrowth, etfGrowth }
  }, [calc])

  const isOverridden = (symbol: string) =>
    assetSettings.some((s) => s.symbol.toUpperCase() === symbol.toUpperCase() && !s.auto)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">總淨值</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(summary.netWorth)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            股票 {formatCurrency(summary.stockValue)}／現金 {formatCurrency(summary.netCash)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">淨曝險</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">
            {formatCurrency(summary.netExposure)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            內含借款 {formatCurrency(summary.impliedBorrow)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            overLimit
              ? 'border-rose-500/40 bg-rose-500/10'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Gauge className="h-4 w-4" /> 曝險比率
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${
              overLimit ? 'text-rose-300' : 'text-teal-300'
            }`}
          >
            {formatNumber(summary.exposureRatio, 1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            實質槓桿 {formatNumber(summary.leverageRatio, 2)} 倍
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">現金緩衝</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              summary.netCash > 0 ? pnlClass(summary.cashBuffer) : 'text-rose-300'
            }`}
          >
            {summary.netCash > 0 ? `${formatNumber(summary.cashBuffer, 1)}%` : '0.0%'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.netCash > 0
              ? '市場跌超過此幅度，虧損金額將大於手上現金'
              : '淨現金為負，已無下跌緩衝空間'}
          </p>
        </div>
      </div>

      {summary.netWorth <= 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            負債已超過總資產，淨值為 {formatCurrency(summary.netWorth)}。此狀態下權重與曝險
            比率無法計算（分母為負），請先補充現金或降低負債與槓桿部位。
          </p>
        </div>
      )}

      {overLimit && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            目前曝險比率 {formatNumber(summary.exposureRatio, 1)}% 已超過你設定的上限{' '}
            {settings.maxExposureRatio}%。市場下跌時淨值跌幅會放大約{' '}
            {formatNumber(summary.leverageRatio, 2)} 倍，可考慮降低槓桿標的或提高現金。
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">名目總曝險</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatCurrency(summary.grossExposure)}
          </p>
          <p className="text-xs text-slate-500">
            佔淨值 {formatNumber(summary.grossExposureRatio, 1)}%
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">多方／空方曝險</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatCurrency(summary.longExposure)}
          </p>
          <p className="text-xs text-slate-500">
            反向部位 {formatCurrency(summary.shortExposure)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-400">槓桿型標的市值</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatCurrency(summary.leveragedValue)}
          </p>
          <p className="text-xs text-slate-500">
            佔持股 {formatNumber(summary.leveragedRatio, 1)}%
          </p>
        </div>
        <label className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-sm text-slate-400">曝險上限 %（提醒用）</span>
          <input
            type="number"
            step="5"
            value={settings.maxExposureRatio}
            onChange={(e) =>
              onUpdateSettings({ maxExposureRatio: Number(e.target.value) || 0 })
            }
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
          />
        </label>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-slate-500">
          尚無持股，無法計算曝險
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">市值 vs 曝險</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
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
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      name === 'marketValue' ? '市值' : '曝險',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => (
                      <span className="text-slate-300">
                        {value === 'marketValue' ? '市值' : '曝險'}
                      </span>
                    )}
                  />
                  <Bar dataKey="marketValue" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="exposure" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-1 border-b border-slate-800 px-4 py-3">
              <h3 className="font-semibold text-white">曝險明細</h3>
              <p className="text-xs text-slate-500">
                系統依代號與名稱自動判定倍數（正 2 → 2、反 1 → -1），可手動修改
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">標的</th>
                    <th className="px-4 py-3 font-medium">類別</th>
                    <th className="px-4 py-3 font-medium text-right">倍數</th>
                    <th className="px-4 py-3 font-medium text-right">市值</th>
                    <th className="px-4 py-3 font-medium text-right">曝險</th>
                    <th className="px-4 py-3 font-medium text-right">佔淨值</th>
                    <th className="px-4 py-3 font-medium text-right">佔曝險</th>
                    <th className="px-4 py-3 font-medium text-right">內含借款</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.symbol}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{item.symbol}</div>
                        <div className="text-xs text-slate-500">{item.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.assetClass}
                          onChange={(e) =>
                            onSetOverride(item.symbol, {
                              leverage: item.leverage,
                              assetClass: e.target.value as AssetClass,
                            })
                          }
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-500"
                        >
                          {assetClassOptions.map((option) => (
                            <option key={option} value={option}>
                              {assetClassLabel(option)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={item.leverage}
                            onChange={(e) =>
                              onSetOverride(item.symbol, {
                                leverage: Number(e.target.value) || 0,
                                assetClass: item.assetClass,
                              })
                            }
                            className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-right text-slate-200 outline-none focus:border-teal-500"
                          />
                          {isOverridden(item.symbol) ? (
                            <button
                              type="button"
                              onClick={() => onReset(item.symbol)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-teal-300"
                              title="恢復自動判定"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              自動
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatCurrency(item.marketValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-200">
                        {formatCurrency(item.exposure)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatNumber(item.valueWeight, 1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatNumber(item.exposureWeight, 1)}%
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(-item.impliedBorrow)}`}>
                        {formatCurrency(item.impliedBorrow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-white">市場情境模擬</h3>
            <p className="mt-1 text-xs text-slate-500">
              假設持股跟隨大盤同步變動（Beta = 1），以淨曝險推估淨值變化
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">大盤變動</th>
                    <th className="py-2 pr-4 font-medium text-right">淨值變動金額</th>
                    <th className="py-2 pr-4 font-medium text-right">淨值變動 %</th>
                    <th className="py-2 font-medium text-right">變動後淨值</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIOS.map((scenario) => {
                    const result = marketScenario(summary, scenario)
                    return (
                      <tr key={scenario} className="border-b border-slate-800/60 last:border-0">
                        <td className={`py-2 pr-4 font-medium ${pnlClass(scenario)}`}>
                          {formatPercent(scenario, 0)}
                        </td>
                        <td className={`py-2 pr-4 text-right ${pnlClass(result.changeAmount)}`}>
                          {formatCurrency(result.changeAmount)}
                        </td>
                        <td className={`py-2 pr-4 text-right ${pnlClass(result.changePercent)}`}>
                          {formatPercent(result.changePercent, 1)}
                        </td>
                        <td className="py-2 text-right text-slate-200">
                          {formatCurrency(result.netWorthAfter)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Zap className="h-4 w-4 text-amber-300" />
          槓桿 ETF（正 2）波動耗損試算
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          正 2 每日重設槓桿，長期報酬不等於大盤的兩倍；波動越大，耗損越明顯
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">槓桿倍數 k</span>
            <input
              type="number"
              step="0.5"
              value={calc.leverage}
              onChange={(e) => setCalc((prev) => ({ ...prev, leverage: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">大盤年化波動 σ %</span>
            <input
              type="number"
              step="any"
              value={calc.volatility}
              onChange={(e) => setCalc((prev) => ({ ...prev, volatility: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">大盤年化報酬 %</span>
            <input
              type="number"
              step="any"
              value={calc.marketReturn}
              onChange={(e) => setCalc((prev) => ({ ...prev, marketReturn: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">持有年數</span>
            <input
              type="number"
              step="1"
              min="1"
              value={calc.years}
              onChange={(e) => setCalc((prev) => ({ ...prev, years: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
            <p className="text-xs text-slate-500">年化波動耗損</p>
            <p className="mt-1 text-lg font-semibold text-rose-300">
              -{formatNumber(decay.drag, 2)}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
            <p className="text-xs text-slate-500">槓桿 ETF 年化報酬</p>
            <p className={`mt-1 text-lg font-semibold ${pnlClass(decay.etfReturn)}`}>
              {formatPercent(decay.etfReturn)}
            </p>
            <p className="text-xs text-slate-500">
              單純 k 倍為 {formatPercent(decay.k * decay.mu)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
            <p className="text-xs text-slate-500">{decay.years} 年累積（大盤）</p>
            <p className={`mt-1 text-lg font-semibold ${pnlClass(decay.marketGrowth)}`}>
              {formatPercent(decay.marketGrowth, 1)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
            <p className="text-xs text-slate-500">{decay.years} 年累積（槓桿）</p>
            <p className={`mt-1 text-lg font-semibold ${pnlClass(decay.etfGrowth)}`}>
              {formatPercent(decay.etfGrowth, 1)}
            </p>
          </div>
        </div>
      </div>

      <FormulaCard
        title="曝險與槓桿的計算方式"
        items={[
          {
            label: '單一標的曝險',
            formula: '曝險 = 市值 × 槓桿倍數',
            note: '00631L 正 2 市值 100,000 → 曝險 200,000；00632R 反 1 市值 50,000 → 曝險 -50,000',
          },
          {
            label: '總淨值',
            formula: '總淨值 = 持股市值合計 + 淨現金（現金 − 負債）',
          },
          {
            label: '淨曝險與名目曝險',
            formula: '淨曝險 = Σ(市值 × 倍數)　名目曝險 = Σ|市值 × 倍數|',
            note: '同時持有正 2 與反 1 時，淨曝險會互相抵消，但名目曝險仍反映實際交易規模',
          },
          {
            label: '曝險比率／實質槓桿',
            formula: '曝險比率 = 淨曝險 ÷ 總淨值 × 100%　實質槓桿 = 淨曝險 ÷ 總淨值',
            note: '100% 表示滿倉無槓桿；120% 代表市場跌 10%，淨值約跌 12%',
          },
          {
            label: '內含借款',
            formula: '內含借款 = 曝險 − 市值',
            note: '槓桿 ETF 用你看不到的融資取得額外曝險，需承擔基金內的借券與管理成本',
          },
          {
            label: '現金緩衝',
            formula: '現金緩衝 = 淨現金 ÷ 淨曝險 × 100%',
            note: '代表市場需下跌多少幅度，虧損金額才會等於手上現金',
          },
          {
            label: '槓桿波動耗損',
            formula: '年化耗損 = (k² − k) ÷ 2 × σ²　長期報酬 ≈ k × μ − 耗損',
            note: 'k=2、σ=25% 時每年約耗損 6.25%。例如大盤先漲 10% 再跌 10%（累積 -1%），正 2 為 1.2 × 0.8 = -4%',
          },
        ]}
      />
    </div>
  )
}
