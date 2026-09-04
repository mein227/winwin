import { useState } from 'react'
import { Activity, Gauge, PieChart, Scale } from 'lucide-react'
import type {
  AllocationSettings,
  AllocationView,
  AssetClass,
  AssetSetting,
  Holding,
  RebalancePlan,
} from '../types'
import type { ExposureResult } from '../utils/exposure'
import { useRiskAnalysis } from '../hooks/useRiskAnalysis'
import { AllocationOverview } from './AllocationOverview'
import { ExposurePanel } from './ExposurePanel'
import { RebalancePanel } from './RebalancePanel'
import { RiskPanel } from './RiskPanel'

interface AllocationProps {
  holdings: Holding[]
  exposure: ExposureResult
  rebalance: RebalancePlan
  assetSettings: AssetSetting[]
  settings: AllocationSettings
  cashRate: number
  onSetAssetOverride: (
    symbol: string,
    override: { leverage: number; assetClass: AssetClass },
  ) => void
  onResetAssetOverride: (symbol: string) => void
  onSetTargetWeight: (symbol: string, weight?: number) => void
  onApplyTargetWeights: (weights: Record<string, number>) => void
  onUpdateSettings: (patch: Partial<AllocationSettings>) => void
}

/** shortLabel 是手機版標籤，四個子頁要並排就得統一縮到四個字 */
const views: {
  id: AllocationView
  label: string
  shortLabel: string
  icon: typeof PieChart
  hint: string
}[] = [
  {
    id: 'overview',
    label: '配置總覽',
    shortLabel: '配置總覽',
    icon: PieChart,
    hint: '股票與現金的實際配置比重',
  },
  {
    id: 'exposure',
    label: '曝險與槓桿',
    shortLabel: '曝險槓桿',
    icon: Gauge,
    hint: '正 2 等槓桿標的的真實曝險',
  },
  {
    id: 'rebalance',
    label: '資產配置藍圖',
    shortLabel: '配置藍圖',
    icon: Scale,
    hint: '正二與現金共生：依生活費倍數給出階段配置與動作提醒',
  },
  {
    id: 'risk',
    label: '報酬風險',
    shortLabel: '報酬風險',
    icon: Activity,
    hint: '波動度、夏普值與風險貢獻',
  },
]

export function Allocation({
  holdings,
  exposure,
  rebalance,
  assetSettings,
  settings,
  cashRate,
  onSetAssetOverride,
  onResetAssetOverride,
  onSetTargetWeight,
  onApplyTargetWeights,
  onUpdateSettings,
}: AllocationProps) {
  const [view, setView] = useState<AllocationView>('overview')
  const { risk, loading, message, analyze } = useRiskAnalysis()

  const handleAnalyze = () => {
    void analyze({
      items: exposure.items,
      netWorth: exposure.summary.netWorth,
      riskFreeRate: settings.riskFreeRate,
      cashRate,
      historyDays: settings.historyDays,
    })
  }

  const activeView = views.find((item) => item.id === view)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:block">
        <h2 className="text-lg font-bold text-white sm:text-2xl">資產配置</h2>
        <p className="text-xs text-slate-400 sm:mt-1 sm:text-sm">{activeView?.hint}</p>
      </div>

      {/* 手機一列塞四個子頁，隱藏圖示避免擠壓文字或被迫橫向捲動 */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1 sm:flex sm:gap-2">
        {views.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-1 py-1.5 text-[0.6875rem] font-medium transition sm:justify-start sm:px-3 sm:py-2 sm:text-sm ${
                active
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="hidden h-4 w-4 sm:block" />
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          )
        })}
      </div>

      {view === 'overview' && (
        <AllocationOverview holdings={holdings} exposure={exposure} />
      )}

      {view === 'exposure' && (
        <ExposurePanel
          exposure={exposure}
          assetSettings={assetSettings}
          settings={settings}
          benchmarkVolatility={risk?.benchmark?.annualVolatility}
          onSetOverride={onSetAssetOverride}
          onReset={onResetAssetOverride}
          onUpdateSettings={onUpdateSettings}
        />
      )}

      {view === 'rebalance' && (
        <RebalancePanel
          plan={rebalance}
          holdings={holdings}
          exposure={exposure}
          assetSettings={assetSettings}
          settings={settings}
          onSetTargetWeight={onSetTargetWeight}
          onApplyTargetWeights={onApplyTargetWeights}
          onUpdateSettings={onUpdateSettings}
        />
      )}

      {view === 'risk' && (
        <RiskPanel
          risk={risk}
          loading={loading}
          message={message}
          exposure={exposure}
          settings={settings}
          onAnalyze={handleAnalyze}
          onUpdateSettings={onUpdateSettings}
        />
      )}
    </div>
  )
}
