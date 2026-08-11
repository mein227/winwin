import { useMemo } from 'react'
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
import { Eraser, Scale, Shuffle, TriangleAlert, Wand } from 'lucide-react'
import type {
  AllocationSettings,
  AssetSetting,
  PortfolioRisk,
  RebalanceBasis,
  RebalancePlan,
} from '../types'
import type { ExposureResult } from '../utils/exposure'
import {
  currentWeightTargets,
  equalWeightTargets,
  riskParityTargets,
} from '../utils/exposure'
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import { tooltipStyle } from '../utils/chartColors'
import { FormulaCard } from './FormulaCard'

interface RebalancePanelProps {
  plan: RebalancePlan
  exposure: ExposureResult
  assetSettings: AssetSetting[]
  settings: AllocationSettings
  risk: PortfolioRisk | null
  onSetTargetWeight: (symbol: string, weight?: number) => void
  onApplyTargetWeights: (weights: Record<string, number>) => void
  onClearTargetWeights: () => void
  onUpdateSettings: (patch: Partial<AllocationSettings>) => void
}

const basisOptions: { id: RebalanceBasis; label: string; hint: string }[] = [
  { id: 'value', label: '依市值', hint: '目標權重套用在持股市值，適合一般存股配置' },
  { id: 'exposure', label: '依曝險', hint: '目標權重套用在曝險金額，持有正 2 時更能控制風險' },
]

export function RebalancePanel({
  plan,
  exposure,
  assetSettings,
  settings,
  risk,
  onSetTargetWeight,
  onApplyTargetWeights,
  onClearTargetWeights,
  onUpdateSettings,
}: RebalancePanelProps) {
  const stockRows = plan.rows.filter((row) => !row.isCash)
  const cashRow = plan.rows.find((row) => row.isCash)
  const hasTargets = plan.targetSum > 0

  const rawTarget = (symbol: string) => {
    const setting = assetSettings.find(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase(),
    )
    return setting?.targetWeight === undefined ? '' : String(setting.targetWeight)
  }

  const chartData = useMemo(
    () =>
      plan.rows.map((row) => ({
        name: row.isCash ? '現金' : row.symbol,
        current: Number(row.currentWeight.toFixed(2)),
        target: Number(row.targetWeight.toFixed(2)),
      })),
    [plan.rows],
  )

  const symbols = exposure.items.map((item) => item.symbol)
  const riskParityAvailable = (risk?.assets.length ?? 0) > 0

  const applyEqual = () =>
    onApplyTargetWeights(equalWeightTargets(symbols, settings.cashTargetWeight))

  const applyCurrent = () =>
    onApplyTargetWeights(
      currentWeightTargets(exposure.items, settings.cashTargetWeight),
    )

  const applyRiskParity = () => {
    if (!risk) return
    onApplyTargetWeights(
      riskParityTargets(
        risk.assets.map((asset) => ({
          symbol: asset.symbol,
          annualVolatility: asset.annualVolatility,
        })),
        settings.cashTargetWeight,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">再平衡設定</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="mb-1.5 text-sm text-slate-400">計算基準</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
              {basisOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUpdateSettings({ rebalanceBasis: option.id })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    settings.rebalanceBasis === option.id
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {basisOptions.find((option) => option.id === settings.rebalanceBasis)?.hint}
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">現金目標權重 %</span>
            <input
              type="number"
              step="any"
              min="0"
              max="100"
              value={settings.cashTargetWeight}
              onChange={(e) =>
                onUpdateSettings({ cashTargetWeight: Number(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">觸發門檻（百分點）</span>
            <input
              type="number"
              step="any"
              min="0"
              value={settings.rebalanceThreshold}
              onChange={(e) =>
                onUpdateSettings({ rebalanceThreshold: Number(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyEqual}
            disabled={symbols.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <Scale className="h-4 w-4" />
            等權重
          </button>
          <button
            type="button"
            onClick={applyCurrent}
            disabled={symbols.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <Shuffle className="h-4 w-4" />
            依現有市值
          </button>
          <button
            type="button"
            onClick={applyRiskParity}
            disabled={!riskParityAvailable}
            title={riskParityAvailable ? '' : '請先到「報酬風險」頁執行分析'}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/15 px-3 py-2 text-sm text-teal-200 hover:bg-teal-500/25 disabled:opacity-50"
          >
            <Wand className="h-4 w-4" />
            風險平價
          </button>
          <button
            type="button"
            onClick={onClearTargetWeights}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <Eraser className="h-4 w-4" />
            清除目標
          </button>
        </div>
      </div>

      {plan.normalized && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            目標權重合計為 {formatNumber(plan.targetSum, 1)}%（含現金），已自動等比例換算成
            100% 再計算調整金額。
          </p>
        </div>
      )}

      {!hasTargets && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-slate-500">
          尚未設定目標權重，可先按上方「等權重」或「依現有市值」快速帶入
        </div>
      )}

      {hasTargets && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">需買進</p>
              <p className="mt-2 text-xl font-bold text-emerald-300">
                {formatCurrency(plan.totalBuy)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">需賣出</p>
              <p className="mt-2 text-xl font-bold text-rose-300">
                {formatCurrency(plan.totalSell)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm text-slate-400">預估手續費＋稅</p>
              <p className="mt-2 text-xl font-bold text-amber-300">
                {formatCurrency(plan.totalCost)}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-4 ${
                plan.cashAfter < 0
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <p className="text-sm text-slate-400">執行後現金</p>
              <p className={`mt-2 text-xl font-bold ${pnlClass(plan.cashAfter)}`}>
                {formatCurrency(plan.cashAfter)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                目前 {formatCurrency(plan.cashBefore)}
              </p>
            </div>
          </div>

          {plan.cashAfter < 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                依此計畫執行後現金為負數，代表需動用融資。建議先降低買進金額或調高現金目標權重。
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-1 border-b border-slate-800 px-4 py-3">
              <h3 className="font-semibold text-white">再平衡建議</h3>
              <p className="text-xs text-slate-500">
                偏離未達 {formatNumber(settings.rebalanceThreshold, 1)} 個百分點時建議不動作，
                避免頻繁交易被手續費吃掉報酬
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">標的</th>
                    <th className="px-4 py-3 font-medium text-right">目前權重</th>
                    <th className="px-4 py-3 font-medium text-right">目標權重 %</th>
                    <th className="px-4 py-3 font-medium text-right">偏離</th>
                    <th className="px-4 py-3 font-medium text-right">目標金額</th>
                    <th className="px-4 py-3 font-medium text-right">調整金額</th>
                    <th className="px-4 py-3 font-medium text-right">股數</th>
                    <th className="px-4 py-3 font-medium text-right">建議</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{row.symbol}</div>
                        <div className="text-xs text-slate-500">
                          {row.name}
                          {row.leverage !== 1 && ` · ${formatNumber(row.leverage, 1)}x`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatNumber(row.currentWeight, 1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={rawTarget(row.symbol)}
                          onChange={(e) =>
                            onSetTargetWeight(
                              row.symbol,
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          placeholder="—"
                          className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-right text-slate-200 outline-none focus:border-teal-500"
                        />
                        {plan.normalized && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            換算 {formatNumber(row.targetWeight, 1)}%
                          </p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(row.diffWeight)}`}>
                        {formatPercent(row.diffWeight, 1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(row.targetValue)}
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(row.diffValue)}`}>
                        {formatCurrency(row.diffValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {row.price > 0 && row.action !== 'hold' ? (
                          <>
                            {formatNumber(Math.abs(row.shares), 0)}
                            <span className="ml-1 text-xs text-slate-500">
                              （{formatNumber(Math.abs(row.lots), 2)} 張）
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                            row.action === 'buy'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : row.action === 'sell'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {row.action === 'buy' ? '買進' : row.action === 'sell' ? '賣出' : '不動作'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {cashRow && (
                    <tr className="bg-slate-950/40">
                      <td className="px-4 py-3 font-medium text-white">現金</td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatNumber(cashRow.currentWeight, 1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatNumber(cashRow.targetWeight, 1)}%
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(cashRow.diffWeight)}`}>
                        {formatPercent(cashRow.diffWeight, 1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(cashRow.targetValue)}
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(cashRow.diffValue)}`}>
                        {formatCurrency(cashRow.diffValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">—</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        由設定調整
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">目前權重 vs 目標權重</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      `${formatNumber(Number(value ?? 0), 1)}%`,
                      name === 'current' ? '目前' : '目標',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => (
                      <span className="text-slate-300">
                        {value === 'current' ? '目前權重' : '目標權重'}
                      </span>
                    )}
                  />
                  <Bar dataKey="current" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="target" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <FormulaCard
        title="再平衡的計算方式"
        items={[
          {
            label: '目標金額',
            formula: '目標金額 = 目標權重 × 總淨值',
            note: `目前基準為「${settings.rebalanceBasis === 'exposure' ? '依曝險' : '依市值'}」，總淨值 ${formatCurrency(plan.base)}`,
          },
          {
            label: '需調整金額與股數',
            formula:
              '調整金額 = 目標金額 − 目前金額　股數 = 調整金額 ÷ 現價（依曝險時再除以槓桿倍數）',
            note: '正數為買進、負數為賣出；賣出股數不會超過持有股數',
          },
          {
            label: '偏離與觸發門檻',
            formula: '偏離 = 目標權重 − 目前權重，|偏離| ≥ 門檻 才建議調整',
            note: '常見做法是 5 個百分點或每半年／一年檢視一次，減少交易成本與稅費',
          },
          {
            label: '執行後現金',
            formula: '執行後現金 = 目前淨現金 + 賣出金額 − 買進金額 − 預估手續費與證交稅',
            note: '手續費以 0.1425% × 6 折、證交稅 0.3% 估算',
          },
          {
            label: '再平衡的意義',
            formula: '賣掉漲多的、買進跌深的 → 自動維持風險水位',
            note: '長期可降低組合波動並貢獻「再平衡溢酬」，但要留意台股賣出的證交稅與手續費',
          },
        ]}
      />
    </div>
  )
}
