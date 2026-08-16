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

const views: { id: AllocationView; label: string; icon: typeof PieChart; hint: string }[] = [
  { id: 'overview', label: '配置總覽', icon: PieChart, hint: '股票與現金的實際配置比重' },
  { id: 'exposure', label: '曝險與槓桿', icon: Gauge, hint: '正 2 等槓桿標的的真實曝險' },
  {
    id: 'rebalance',
    label: '資產配置藍圖',
    icon: Scale,
    hint: '正二與現金共生：依生活費倍數給出階段配置與動作提醒',
  },
  { id: 'risk', label: '報酬風險', icon: Activity, hint: '波動度、夏普值與風險貢獻' },
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">資產配置</h2>
        <p className="mt-1 text-sm text-slate-400">{activeView?.hint}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 p-1">
        {views.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
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
