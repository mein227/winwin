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
import { CalendarClock, Eraser, Scale, Shuffle, TriangleAlert, Wand } from 'lucide-react'
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

function nextReviewLabel(months: number[]): string {
  const now = new Date()
  const sorted = [...months].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b)
  const nextMonth = sorted.find((month) => month > now.getMonth() + 1)
  const year = nextMonth ? now.getFullYear() : now.getFullYear() + 1
  const month = nextMonth ?? sorted[0]
  return month ? `${year} 年 ${month} 月底` : '尚未設定'
}

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
  const equityTarget = 100 - settings.cashTargetWeight

  const explicitTargets = useMemo(() => {
    const map: Record<string, number> = {}
    for (const setting of assetSettings) {
      const weight = Number(setting.targetWeight)
      if (Number.isFinite(weight) && weight > 0) {
        map[setting.symbol.toUpperCase()] = weight
      }
    }
    return map
  }, [assetSettings])

  const presets = useMemo(() => {
    const equal = equalWeightTargets(symbols, settings.cashTargetWeight)
    const current = currentWeightTargets(exposure.items, settings.cashTargetWeight)
    const parity = risk
      ? riskParityTargets(
          risk.assets.map((asset) => ({
            symbol: asset.symbol,
            annualVolatility: asset.annualVolatility,
          })),
          settings.cashTargetWeight,
        )
      : {}
    return { equal, current, parity }
  }, [symbols, exposure.items, risk, settings.cashTargetWeight])

  /** 四捨五入到 0.1% 後比對，避免正規化誤差讓選中狀態閃動 */
  const matchesPreset = (preset: Record<string, number>) => {
    const keys = new Set([...Object.keys(explicitTargets), ...Object.keys(preset)])
    if (keys.size === 0) return false
    for (const key of keys) {
      if (Math.abs((explicitTargets[key] ?? 0) - (preset[key] ?? 0)) > 0.15) return false
    }
    return true
  }

  const activePreset =
    Object.keys(explicitTargets).length === 0
      ? 'auto'
      : matchesPreset(presets.equal)
        ? 'equal'
        : matchesPreset(presets.current)
          ? 'current'
          : riskParityAvailable && matchesPreset(presets.parity)
            ? 'parity'
            : 'custom'

  const presetClass = (id: string) =>
    `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition disabled:opacity-50 ${
      activePreset === id
        ? 'border-teal-400 bg-teal-500/25 text-teal-100'
        : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
    }`
  const reviewMonths =
    settings.rebalanceReviewMonths?.length === 2 ? settings.rebalanceReviewMonths : [6, 12]

  const updateEquityTarget = (value: number) => {
    const nextEquity = Math.min(Math.max(value || 0, 0), 100)
    const nextCash = 100 - nextEquity
    const existing = Object.fromEntries(
      assetSettings
        .filter((setting) => setting.targetWeight !== undefined)
        .map((setting) => [setting.symbol.toUpperCase(), setting.targetWeight ?? 0]),
    )
    const existingTotal = Object.values(existing).reduce((sum, weight) => sum + weight, 0)

    onUpdateSettings({ cashTargetWeight: nextCash })
    // 沒有個別目標時維持自動模式，股票內部比例交由計算層依市值推算
    if (existingTotal > 0) {
      onApplyTargetWeights(
        Object.fromEntries(
          Object.entries(existing).map(([symbol, weight]) => [
            symbol,
            (weight / existingTotal) * nextEquity,
          ]),
        ),
      )
    }
  }

  const updateReviewMonth = (index: number, month: number) => {
    const next = [...reviewMonths]
    next[index] = month
    onUpdateSettings({ rebalanceReviewMonths: next })
  }

  const applyEqual = () => onApplyTargetWeights(presets.equal)

  const applyCurrent = () => onApplyTargetWeights(presets.current)

  const applyRiskParity = () => {
    if (!riskParityAvailable) return
    onApplyTargetWeights(presets.parity)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">股權／現金再平衡策略</h3>
        <p className="mt-1 text-sm text-slate-400">
          先決定整體資產配置；只有碰到上下限時才交易，平時每半年檢查一次。
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">1. 設定目標配置</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">股權部位 %</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={equityTarget}
                  onChange={(event) => updateEquityTarget(Number(event.target.value))}
                  className="w-full rounded-xl border border-teal-500/50 bg-slate-950 px-3 py-2.5 font-semibold text-teal-200 outline-none focus:border-teal-400"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-slate-400">現金部位 %</span>
                <input
                  type="number"
                  value={settings.cashTargetWeight}
                  readOnly
                  aria-label="現金部位（自動計算）"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sky-200"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">兩者合計固定為 100%，現金會自動計算。</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">2. 設定動態觸發範圍</p>
            <label className="mt-3 block space-y-1.5">
              <span className="text-xs text-slate-400">允許偏離（百分點）</span>
              <input
                type="number"
                step="1"
                min="0"
                max="50"
                value={settings.rebalanceThreshold}
                onChange={(event) =>
                  onUpdateSettings({
                    rebalanceThreshold: Math.min(
                      Math.max(Number(event.target.value) || 0, 0),
                      50,
                    ),
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
            </label>
            <div className="mt-3 space-y-1.5 text-xs">
              <p className="text-rose-300">
                股權達 {formatNumber(plan.equityUpperBound, 0)}%：停利賣出，回到{' '}
                {formatNumber(plan.equityTargetWeight, 0)}%
              </p>
              <p className="text-emerald-300">
                股權降至 {formatNumber(plan.equityLowerBound, 0)}%：動用現金買進，回到{' '}
                {formatNumber(plan.equityTargetWeight, 0)}%
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-sky-300" />
              <p className="text-sm font-semibold text-white">3. 每半年定期檢查</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs text-slate-400">上半年</span>
                <select
                  value={reviewMonths[0]}
                  onChange={(event) => updateReviewMonth(0, Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
                >
                  {[1, 2, 3, 4, 5, 6].map((month) => (
                    <option key={month} value={month}>{month} 月底</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-slate-400">下半年</span>
                <select
                  value={reviewMonths[1]}
                  onChange={(event) => updateReviewMonth(1, Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
                >
                  {[7, 8, 9, 10, 11, 12].map((month) => (
                    <option key={month} value={month}>{month} 月底</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-sky-300">下次檢查：{nextReviewLabel(reviewMonths)}</p>
            <p className="mt-1 text-xs text-slate-500">未碰到上下限時不交易，降低摩擦成本。</p>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            進階設定：個別標的分配與計算基準
          </summary>
          <div className="mt-4">
            <p className="mb-1.5 text-sm text-slate-400">計算基準</p>
            <div className="grid max-w-xl grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
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
          <p className="mt-4 mb-1.5 text-sm text-slate-400">股票部位的內部分配</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearTargetWeights}
              className={presetClass('auto')}
            >
              <Eraser className="h-4 w-4" />
              依目前比例重設
            </button>
            <button
              type="button"
              onClick={applyEqual}
              disabled={symbols.length === 0}
              className={presetClass('equal')}
            >
              <Scale className="h-4 w-4" />
              等權重
            </button>
            <button
              type="button"
              onClick={applyCurrent}
              disabled={symbols.length === 0}
              className={presetClass('current')}
            >
              <Shuffle className="h-4 w-4" />
              依現有市值
            </button>
            <button
              type="button"
              onClick={applyRiskParity}
              disabled={!riskParityAvailable}
              title={riskParityAvailable ? '' : '請先到「報酬風險」頁執行分析'}
              className={presetClass('parity')}
            >
              <Wand className="h-4 w-4" />
              風險平價
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {activePreset === 'auto'
              ? '目前為自動模式：股票內部比例跟著市值變動，只調整股權與現金的比重'
              : activePreset === 'custom'
                ? '目前為自訂比例：可在下方表格逐檔調整目標權重'
                : '已套用上方選取的分配方式，可在下方表格再微調'}
          </p>
        </details>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 ${
          plan.trigger === 'sell'
            ? 'border-rose-500/30 bg-rose-500/10'
            : plan.trigger === 'buy'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <p className="text-sm font-semibold text-white">
          目前股權 {formatNumber(plan.equityCurrentWeight, 1)}% · 現金{' '}
          {formatNumber(cashRow?.currentWeight ?? 0, 1)}%
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {plan.trigger === 'sell'
            ? `已達 ${formatNumber(plan.equityUpperBound, 0)}% 停利線，建議賣出部分股票，將現金拉回 ${formatNumber(settings.cashTargetWeight, 0)}%。`
            : plan.trigger === 'buy'
              ? `已達 ${formatNumber(plan.equityLowerBound, 0)}% 買進線，建議動用現金加碼，將股權拉回 ${formatNumber(plan.equityTargetWeight, 0)}%。`
              : `仍在 ${formatNumber(plan.equityLowerBound, 0)}%～${formatNumber(plan.equityUpperBound, 0)}% 範圍內，暫時不需交易。`}
        </p>
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
            label: '動態觸發門檻',
            formula: '股權上限／下限 = 股權目標 ± 允許偏離；碰到界線才建議調整',
            note: `目前為 ${formatNumber(plan.equityLowerBound, 0)}%～${formatNumber(plan.equityUpperBound, 0)}%，回到 ${formatNumber(plan.equityTargetWeight, 0)}% 後停止交易`,
          },
          {
            label: '定期檢查',
            formula: `每年 ${[...reviewMonths].sort((a, b) => a - b).join(' 月底、')} 月底檢查一次`,
            note: '若整體股權仍在上下限內就不交易，減少手續費、稅費與價格摩擦',
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
