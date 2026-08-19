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
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Landmark,
  LoaderCircle,
  Map,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import type {
  AllocationSettings,
  AssetSetting,
  BlueprintRetirementPreset,
  Holding,
  RebalancePlan,
  SellReason,
} from '../types'
import type { ExposureResult } from '../utils/exposure'
import {
  analyzeBlueprint,
  blueprintTargetWeights,
  resolveDipThresholds,
  type BlueprintActionSeverity,
} from '../utils/blueprint'
import { formatCurrency, formatNumber, formatPercent, pnlClass } from '../utils/calculations'
import { tooltipStyle } from '../utils/chartColors'
import { useBlueprintMarketData } from '../hooks/useBlueprintMarketData'
import { FormulaCard } from './FormulaCard'

interface RebalancePanelProps {
  plan: RebalancePlan
  holdings: Holding[]
  exposure: ExposureResult
  assetSettings: AssetSetting[]
  settings: AllocationSettings
  onSetTargetWeight: (symbol: string, weight?: number) => void
  onApplyTargetWeights: (weights: Record<string, number>) => void
  onUpdateSettings: (patch: Partial<AllocationSettings>) => void
}

const sellReasonLabels: Record<SellReason, string> = {
  takeProfit: '停利',
  trimOverweight: '超出目標',
  lossShortfall: '獲利不足，補缺口',
}

const severityStyle: Record<
  BlueprintActionSeverity,
  { wrap: string; icon: typeof Info }
> = {
  ok: { wrap: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100', icon: CheckCircle2 },
  info: { wrap: 'border-sky-500/30 bg-sky-500/10 text-sky-100', icon: Info },
  warn: { wrap: 'border-amber-500/30 bg-amber-500/10 text-amber-100', icon: AlertTriangle },
  urgent: { wrap: 'border-rose-500/30 bg-rose-500/10 text-rose-100', icon: AlertTriangle },
}

const retirementOptions: {
  id: BlueprintRetirementPreset
  label: string
  hint: string
}[] = [
  {
    id: '333',
    label: '333 配置',
    hint: '正二、原型、現金各約三分之一（上漲報酬與安全性較均衡）',
  },
  {
    id: '433',
    label: '433 配置',
    hint: '三成正二、四成原型、三成現金（原型比重較高、波動較溫和）',
  },
]

export function RebalancePanel({
  plan,
  holdings,
  exposure,
  assetSettings,
  settings,
  onSetTargetWeight,
  onApplyTargetWeights,
  onUpdateSettings,
}: RebalancePanelProps) {
  const market = useBlueprintMarketData(holdings, exposure)
  const blueprint = useMemo(
    () =>
      analyzeBlueprint(exposure, settings, {
        indexSymbol: market.indexSymbol,
        indexName: market.indexQuote?.name ?? '加權指數',
        indexClose: market.indexQuote?.price ?? null,
        indexDate: market.indexQuote?.date ?? '',
        leveragedDailyGain: market.leveragedDailyGain,
      }),
    [exposure, market, settings],
  )
  const dipThresholds = resolveDipThresholds(settings)
  const dipThresholdLabel = dipThresholds.map((threshold) => `${threshold}%`).join('／')

  const updateDipThreshold = (index: 0 | 1 | 2, next: number) => {
    const updated = [...dipThresholds] as [number, number, number]
    updated[index] = Math.min(Math.max(next, 0), 100)
    onUpdateSettings({ blueprintDipThresholds: updated })
  }

  const stockRows = plan.rows.filter((row) => !row.isCash)
  const cashRow = plan.rows.find((row) => row.isCash)
  const hasTargets = plan.targetSum > 0

  const rawTarget = (symbol: string) => {
    const setting = assetSettings.find(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase(),
    )
    return setting?.targetWeight === undefined ? '' : String(setting.targetWeight)
  }

  const compareChart = useMemo(
    () => [
      {
        name: '正二',
        current: Number(blueprint.current.leveraged.toFixed(1)),
        target: Number(blueprint.targets.leveraged.toFixed(1)),
      },
      {
        name: '原型／債券',
        current: Number(blueprint.current.prototype.toFixed(1)),
        target: Number(blueprint.targets.prototype.toFixed(1)),
      },
      {
        name: '現金',
        current: Number(blueprint.current.cash.toFixed(1)),
        target: Number(blueprint.targets.cash.toFixed(1)),
      },
    ],
    [blueprint],
  )

  const detailChart = useMemo(
    () =>
      plan.rows.map((row) => ({
        name: row.isCash ? '現金' : row.symbol,
        current: Number(row.currentWeight.toFixed(2)),
        target: Number(row.targetWeight.toFixed(2)),
      })),
    [plan.rows],
  )

  const applyBlueprint = () => {
    const weights = blueprintTargetWeights(exposure, blueprint.targets)
    onUpdateSettings({
      cashTargetWeight: Math.round(blueprint.targets.cash * 10) / 10,
      rebalanceThreshold: Math.max(settings.rebalanceThreshold, 5),
    })
    onApplyTargetWeights(weights)
  }

  const numberField = (
    label: string,
    value: number,
    onChange: (next: number) => void,
    hint?: string,
    opts?: { step?: string; min?: number; max?: number },
  ) => (
    <label className="block space-y-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        step={opts?.step ?? '1'}
        min={opts?.min}
        max={opts?.max}
        value={value || ''}
        placeholder="0"
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
      />
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </label>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-teal-950/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-teal-300">
              <Map className="h-4 w-4" />
              <p className="text-xs font-semibold tracking-wide">正二與現金共生</p>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">資產配置藍圖</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              依「生活費倍數」動態調整正二／原型／現金比例，保留三成防禦現金，並在退休期以質押原型創造現金流。
            </p>
          </div>
          <button
            type="button"
            onClick={applyBlueprint}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/20 px-4 py-2.5 text-sm font-semibold text-teal-100 transition hover:bg-teal-500/30"
          >
            <Sparkles className="h-4 w-4" />
            套用本階段目標（{blueprint.targets.label}）
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {numberField(
            '年生活費（元）',
            settings.blueprintAnnualLivingExpense,
            (next) => onUpdateSettings({ blueprintAnnualLivingExpense: next }),
            '用來計算資產是生活費的幾倍，決定 73／253／343／333 階段',
          )}
          {numberField(
            '金融資產歷史最高點（元）',
            settings.blueprintPeakNetWorth,
            (next) => onUpdateSettings({ blueprintPeakNetWorth: next }),
            '退休提領上限以此計算；可先填目前淨值，之後再更新真正高點',
          )}
          {numberField(
            '加權指數歷史最高點',
            settings.blueprintMarketPeak,
            (next) => onUpdateSettings({ blueprintMarketPeak: Math.max(next, 0) }),
            '手動輸入並在創高後更新；系統會以加權指數最新收盤自動計算回撤',
            { step: '0.01', min: 0 },
          )}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400">下跌加碼門檻（% 回撤）</span>
            <div className="grid grid-cols-3 gap-2">
              {([0, 1, 2] as const).map((index) => (
                <label key={index} className="block space-y-1">
                  <span className="text-[11px] text-slate-500">第 {index + 1} 筆</span>
                  <input
                    type="number"
                    step="1"
                    min={0}
                    max={100}
                    value={dipThresholds[index] || ''}
                    placeholder="0"
                    onChange={(event) =>
                      updateDipThreshold(index, Number(event.target.value) || 0)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
                  />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              預設 10／20／30；加權指數自高點回撤達各門檻時，依序分批加碼
            </p>
          </div>
          {numberField(
            '每年安全提領上限（%）',
            settings.blueprintWithdrawalRate,
            (next) =>
              onUpdateSettings({
                blueprintWithdrawalRate: Math.min(Math.max(next, 0), 10),
              }),
            '預設 4%；保守者可設 2%',
            { step: '0.5', min: 0, max: 10 },
          )}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400">自動行情</span>
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">
                    加權指數收盤：
                    {market.indexQuote ? formatNumber(market.indexQuote.price, 2) : '—'}
                  </p>
                  <p className={`mt-1 text-xs ${pnlClass(market.leveragedDailyGain ?? 0)}`}>
                    今日正二損益：
                    {market.leveragedDailyGain == null
                      ? '—'
                      : formatCurrency(market.leveragedDailyGain)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={market.refresh}
                  disabled={market.loading}
                  title="更新最新收盤價"
                  className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {market.loading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {market.message ||
                (market.indexQuote
                  ? `${market.indexQuote.date} 收盤；正二損益＝持有股數 × 當日價差`
                  : '正在取得最新收盤價')}
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400">退休期偏好配置</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
              {retirementOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUpdateSettings({ blueprintRetirementPreset: option.id })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    settings.blueprintRetirementPreset === option.id
                      ? 'bg-teal-500/20 text-teal-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              {
                retirementOptions.find(
                  (option) => option.id === settings.blueprintRetirementPreset,
                )?.hint
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Target className="h-4 w-4 text-teal-300" />
            <p className="text-sm">目前階段</p>
          </div>
          <p className="mt-2 text-xl font-bold text-white">{blueprint.stageLabel}</p>
          <p className="mt-2 text-xs text-slate-400">{blueprint.stageHint}</p>
          <p className="mt-3 text-sm text-slate-300">
            生活費倍數：{' '}
            <span className="font-semibold text-teal-200">
              {blueprint.livingExpenseMultiple == null
                ? '—'
                : `${formatNumber(blueprint.livingExpenseMultiple, 1)} 倍`}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-300">
            總淨值 {formatCurrency(exposure.summary.netWorth)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Shield className="h-4 w-4 text-sky-300" />
            <p className="text-sm">本階段目標</p>
          </div>
          <p className="mt-2 text-xl font-bold text-sky-200">{blueprint.targets.label}</p>
          <p className="mt-2 text-xs text-slate-400">{blueprint.targets.description}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-slate-950/80 px-2 py-2">
              <p className="text-slate-500">正二</p>
              <p className="mt-1 font-semibold text-white">
                {formatNumber(blueprint.targets.leveraged, 1)}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/80 px-2 py-2">
              <p className="text-slate-500">原型</p>
              <p className="mt-1 font-semibold text-white">
                {formatNumber(blueprint.targets.prototype, 1)}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/80 px-2 py-2">
              <p className="text-slate-500">現金</p>
              <p className="mt-1 font-semibold text-white">
                {formatNumber(blueprint.targets.cash, 1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Wallet className="h-4 w-4 text-amber-300" />
            <p className="text-sm">現況對照</p>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <WeightLine
              label="正二"
              current={blueprint.current.leveraged}
              target={blueprint.targets.leveraged}
            />
            <WeightLine
              label="原型／債券"
              current={blueprint.current.prototype}
              target={blueprint.targets.prototype}
            />
            <WeightLine
              label="現金"
              current={blueprint.current.cash}
              target={blueprint.targets.cash}
            />
            {blueprint.current.other > 0.05 && (
              <p className="pt-1 text-xs text-slate-500">
                另有藍圖外個股 {formatNumber(blueprint.current.other, 1)}%
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">現階段該做什麼</h3>
        <p className="mt-1 text-sm text-slate-400">
          依你填寫的生活費、加權指數最高點與目前持股，自動排出優先動作。
        </p>
        <div className="mt-4 space-y-3">
          {blueprint.actions.map((action) => {
            const style = severityStyle[action.severity]
            const Icon = style.icon
            return (
              <div
                key={action.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style.wrap}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="mt-1 text-xs opacity-90">{action.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className={`rounded-2xl border p-4 ${
            blueprint.dipBuy.eligible
              ? 'border-rose-500/30 bg-rose-500/10'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-300" />
            <p className="text-sm font-semibold text-white">下跌加碼</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">{blueprint.dipBuy.note}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            <p>
              最高 {blueprint.dipBuy.marketPeak > 0
                ? formatNumber(blueprint.dipBuy.marketPeak, 2)
                : '—'} · 最新 {blueprint.dipBuy.marketClose != null
                ? formatNumber(blueprint.dipBuy.marketClose, 2)
                : '—'} · 回撤 {formatNumber(blueprint.dipBuy.drawdown, 1)}%
            </p>
            <p>
              {dipThresholdLabel} 各加碼一次，每筆約{' '}
              {formatCurrency(blueprint.dipBuy.trancheAmount)}（淨值 5%）
            </p>
            <p>
              已達 {blueprint.dipBuy.triggeredTranches}/3 筆門檻
              {blueprint.dipBuy.nextTrigger != null
                ? ` · 下一筆：回撤 ${blueprint.dipBuy.nextTrigger}%`
                : blueprint.dipBuy.triggeredTranches === 3
                  ? ' · 三筆門檻皆已達'
                  : ''}
            </p>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            blueprint.retirement.eligible
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-amber-300" />
            <p className="text-sm font-semibold text-white">質押退休現金流</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">{blueprint.retirement.note}</p>
          {blueprint.retirement.eligible && blueprint.retirement.maxAnnualWithdrawal > 0 && (
            <p className="mt-3 text-sm text-amber-100">
              約 {formatCurrency(blueprint.retirement.suggestedMonthly)}／月
              （年 {formatCurrency(blueprint.retirement.maxAnnualWithdrawal)}）
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-300" />
            <p className="text-sm font-semibold text-white">微量動態再平衡</p>
          </div>
          <p className="mt-2 text-xs text-slate-300">{blueprint.microRebalance.note}</p>
          {blueprint.microRebalance.trimAmount > 0 && (
            <p className="mt-3 text-sm text-teal-100">
              建議轉回現金 {formatCurrency(blueprint.microRebalance.trimAmount)}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="mb-4 text-base font-semibold text-white">藍圖桶：目前 vs 目標</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
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
          執行層：股權 {formatNumber(plan.equityCurrentWeight, 1)}% · 現金{' '}
          {formatNumber(cashRow?.currentWeight ?? 0, 1)}%
          （目標股權 {formatNumber(plan.equityTargetWeight, 0)}% ±{' '}
          {formatNumber(settings.rebalanceThreshold, 0)}pt）
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {plan.trigger === 'sell'
            ? `已達停利線，建議賣出 ${formatCurrency(plan.totalSell)}，將現金拉回約 ${formatNumber(settings.cashTargetWeight, 0)}%。`
            : plan.trigger === 'buy'
              ? `已達買進線，建議動用現金加碼，將股權拉回 ${formatNumber(plan.equityTargetWeight, 0)}%。`
              : `仍在安全區間內。可先按「套用本階段目標」對齊藍圖；未碰上下限時不必頻繁交易。`}
        </p>
      </div>

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
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-col gap-1 border-b border-slate-800 px-4 py-3">
              <h3 className="font-semibold text-white">標的調整建議</h3>
              <p className="text-xs text-slate-500">
                套用藍圖後，這裡會依股權／現金偏離給出買賣金額；也可手動微調目標權重。
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
                    <th className="px-4 py-3 font-medium text-right">調整金額</th>
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
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(row.diffWeight)}`}>
                        {formatPercent(row.diffWeight, 1)}
                      </td>
                      <td className={`px-4 py-3 text-right ${pnlClass(row.tradeValue)}`}>
                        {row.action === 'hold' ? '—' : formatCurrency(row.tradeValue)}
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
                        {row.sellReason && (
                          <div className="mt-1 text-[10px] text-slate-500">
                            {sellReasonLabels[row.sellReason]}
                          </div>
                        )}
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
                      <td className={`px-4 py-3 text-right ${pnlClass(cashRow.diffValue)}`}>
                        {formatCurrency(cashRow.diffValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">由藍圖調整</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-white">個股權重 vs 目標</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detailChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      `${formatNumber(Number(value ?? 0), 1)}%`,
                      name === 'current' ? '目前' : '目標',
                    ]}
                  />
                  <Bar dataKey="current" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="target" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <summary className="cursor-pointer text-base font-semibold text-white">
          藍圖說明：防禦現金 · 階段配置 · 質押現金流 · 波動賺錢
        </summary>
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <section>
            <h4 className="font-semibold text-teal-200">一、保留三成現金的防禦機制</h4>
            <p className="mt-1 text-slate-400">
              累積資產時至少保留三成現金（或「兩成原型 ETF + 兩成現金」等效）。市場自高點下跌
              {dipThresholds[0]}% 時投入第一筆 5%；若再跌至 {dipThresholds[1]}% 投入第二筆 5%，跌至{' '}
              {dipThresholds[2]}% 投入第三筆 5%，
              三筆合計為淨值的 15%。
            </p>
          </section>
          <section>
            <h4 className="font-semibold text-teal-200">二、依生活費倍數動態調整</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-400">
              <li>未達 10 倍：73（七成正二、三成現金）</li>
              <li>10～15 倍：253（五成正二、二成原型、三成現金）</li>
              <li>15～20 倍：343（四成正二、三成原型、三成現金）</li>
              <li>達 20 倍：333 或 433（退休期）</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-teal-200">三、質押打造不減資產的退休現金流</h4>
            <p className="mt-1 text-slate-400">
              絕對不質押正二；只質押原型或債券 ETF，維持極低質押比例。每年借出生活費控制在歷史最高點的
              4%（或 2%）以內，並善用到期續借「只還利息不還本金」。預留現金不能全部來自質押。
            </p>
          </section>
          <section>
            <h4 className="font-semibold text-teal-200">四、動態平衡與波動賺錢</h4>
            <p className="mt-1 text-slate-400">
              正二上漲時可微量再平衡（獲利約三分之一轉現金）；加權指數創高後重設下跌加碼基準。落實「正二
              + 原型 + 三成現金」後，即使短期不看盤，組合也不易因單一波動而失控。
            </p>
          </section>
        </div>
      </details>

      <FormulaCard
        title="資產配置藍圖的計算方式"
        items={[
          {
            label: '生活費倍數',
            formula: '生活費倍數 = 總淨值 ÷ 年生活費',
            note:
              blueprint.livingExpenseMultiple == null
                ? '填寫年生活費後即可判定階段'
                : `目前約 ${formatNumber(blueprint.livingExpenseMultiple, 1)} 倍 → ${blueprint.targets.label}`,
          },
          {
            label: '階段目標配置',
            formula: '<10×→73｜10–15×→253｜15–20×→343｜≥20×→333/433',
            note: '現金目標通常維持約 30%，正二與原型隨階段此消彼長',
          },
          {
            label: '下跌加碼',
            formula: `回撤 ${dipThresholdLabel} → 依序加碼 5%／5%／5% 淨值`,
            note: '回撤＝（手動設定的加權指數最高點 − 最新收盤）÷ 最高點；三筆合計 15%',
          },
          {
            label: '安全提領（質押）',
            formula: '年提領上限 = 金融資產歷史最高點 × 提領率（預設 4%）',
            note: '只質押原型／債券，不質押正二；現金不能全部來自質押',
          },
          {
            label: '微量動態再平衡',
            formula: '今日正二損益 = Σ 持有股數 ×（最新收盤 − 前一日收盤）',
            note: '正數時建議約三分之一轉回現金；收盤價每日自動更新',
          },
          {
            label: '執行層觸發',
            formula: '整體股權超過上限只賣、低於下限只買，區間內可不動作',
            note: `目前界線 ${formatNumber(plan.equityLowerBound, 0)}%～${formatNumber(plan.equityUpperBound, 0)}%，目標 ${formatNumber(plan.equityTargetWeight, 0)}%`,
          },
        ]}
      />
    </div>
  )
}

function WeightLine({
  label,
  current,
  target,
}: {
  label: string
  current: number
  target: number
}) {
  const diff = current - target
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-200">
        {formatNumber(current, 1)}%
        <span className={`ml-2 text-xs ${pnlClass(-diff)}`}>
          {diff === 0 ? '對齊' : diff > 0 ? `高 ${formatNumber(diff, 1)}pt` : `低 ${formatNumber(-diff, 1)}pt`}
        </span>
      </span>
    </div>
  )
}
