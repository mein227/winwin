export type TransactionType = 'buy' | 'sell'

export interface Transaction {
  id: string
  symbol: string
  name: string
  type: TransactionType
  price: number
  shares: number
  fee: number
  tax: number
  date: string
  note?: string
  createdAt: string
}

export interface StockPrice {
  symbol: string
  currentPrice: number
  updatedAt: string
}

export interface Holding {
  symbol: string
  name: string
  shares: number
  avgCost: number
  totalCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  realizedPnL: number
  weight: number
}

export interface PortfolioSummary {
  totalMarketValue: number
  totalCost: number
  totalInvested: number
  cashFromSales: number
  unrealizedPnL: number
  realizedPnL: number
  totalPnL: number
  totalROI: number
  holdingsCount: number
  transactionCount: number
}

/** 資產類別（用於配置與曝險分群） */
export type AssetClass =
  | 'equity'
  | 'etf'
  | 'leveraged'
  | 'inverse'
  | 'bond'
  | 'reit'
  | 'other'

/** 現金帳戶類型；debt 於計算時視為負值（融資、質借、信貸） */
export type CashAccountType = 'bank' | 'broker' | 'deposit' | 'debt' | 'other'

export interface CashAccount {
  id: string
  name: string
  type: CashAccountType
  amount: number
  /** 年利率 %：存款為收益，負債為借款成本 */
  interestRate?: number
  note?: string
  updatedAt: string
}

/** 個別標的的曝險設定（槓桿倍數、資產類別、再平衡目標） */
export interface AssetSetting {
  symbol: string
  /** 曝險倍數：正 2 為 2、反 1 為 -1、一般個股為 1 */
  leverage: number
  assetClass: AssetClass
  /** 再平衡目標權重 %，未設定則不納入目標 */
  targetWeight?: number
  /** true 表示倍數與類別由代號／名稱自動判定，尚未手動覆寫 */
  auto: boolean
}

export type RebalanceBasis = 'value' | 'exposure'

export interface AllocationSettings {
  /** 現金目標權重 % */
  cashTargetWeight: number
  /** 再平衡觸發門檻（百分點） */
  rebalanceThreshold: number
  rebalanceBasis: RebalanceBasis
  /** 無風險利率 %，用於 Sharpe */
  riskFreeRate: number
  /** 一張股數，台股為 1000 */
  lotSize: number
  /** 曝險比率上限 %，超過時提醒 */
  maxExposureRatio: number
  /** 風險分析的歷史天數 */
  historyDays: number
}

export interface ExposureItem {
  symbol: string
  name: string
  assetClass: AssetClass
  leverage: number
  marketValue: number
  /** 市值 × 槓桿倍數 */
  exposure: number
  /** 佔總淨值 % */
  valueWeight: number
  /** 佔淨曝險 % */
  exposureWeight: number
  /** 槓桿標的內含的借款：曝險 − 市值 */
  impliedBorrow: number
}

export interface ExposureSummary {
  stockValue: number
  cashAsset: number
  debtValue: number
  /** 淨現金＝現金資產 − 負債 */
  netCash: number
  /** 總淨值＝持股市值 + 淨現金 */
  netWorth: number
  grossExposure: number
  netExposure: number
  longExposure: number
  shortExposure: number
  /** 淨曝險 ÷ 總淨值 % */
  exposureRatio: number
  grossExposureRatio: number
  /** 實質槓桿倍數 */
  leverageRatio: number
  cashRatio: number
  impliedBorrow: number
  leveragedValue: number
  leveragedRatio: number
  /** 淨現金能吸收多少市場跌幅 % */
  cashBuffer: number
}

export interface AssetClassBreakdown {
  assetClass: AssetClass
  label: string
  marketValue: number
  exposure: number
  valueWeight: number
  exposureWeight: number
}

export interface RebalanceRow {
  key: string
  symbol: string
  name: string
  isCash: boolean
  price: number
  leverage: number
  currentValue: number
  currentWeight: number
  targetWeight: number
  targetValue: number
  /** 目標 − 目前，正數表示需買進 */
  diffValue: number
  diffWeight: number
  shares: number
  lots: number
  estimatedFee: number
  estimatedTax: number
  action: 'buy' | 'sell' | 'hold'
  overThreshold: boolean
}

export interface RebalancePlan {
  basis: RebalanceBasis
  /** 計算基準金額（總淨值） */
  base: number
  rows: RebalanceRow[]
  totalBuy: number
  totalSell: number
  totalCost: number
  cashBefore: number
  cashAfter: number
  targetSum: number
  /** 目標權重合計不為 100% 時已等比例調整 */
  normalized: boolean
}

export interface AssetRisk {
  symbol: string
  name: string
  weight: number
  annualReturn: number
  annualVolatility: number
  sharpe: number
  beta: number
  maxDrawdown: number
  /** 佔組合風險 % */
  riskContribution: number
  /** 邊際風險貢獻 */
  marginalRisk: number
  dataPoints: number
}

export interface PortfolioRisk {
  /** 股票部位（不含現金）年化報酬 % */
  annualReturn: number
  annualVolatility: number
  sharpe: number
  beta: number
  maxDrawdown: number
  /** 含現金後的總資產年化波動 % */
  totalVolatility: number
  totalReturn: number
  /** 年化 95% VaR 金額（以總淨值計） */
  var95: number
  var95Percent: number
  /** 加權平均個股波動，用於衡量分散效益 */
  weightedVolatility: number
  diversification: number
  returnRiskRatio: number
  assets: AssetRisk[]
  riskParityWeights: { symbol: string; weight: number }[]
  benchmark: {
    symbol: string
    name: string
    annualReturn: number
    annualVolatility: number
    maxDrawdown: number
  } | null
  tradingDays: number
  startDate: string
  endDate: string
  missing: string[]
  updatedAt: string
}

export type TabId =
  | 'dashboard'
  | 'transactions'
  | 'holdings'
  | 'cash'
  | 'allocation'

export type AllocationView = 'overview' | 'exposure' | 'rebalance' | 'risk'
