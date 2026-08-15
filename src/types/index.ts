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
  /** 未觸發門檻時，定期檢查配置的月份（1–12） */
  rebalanceReviewMonths: number[]
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
  /** 整體股權目前權重 % */
  equityCurrentWeight: number
  /** 整體股權目標權重 % */
  equityTargetWeight: number
  /** 整體股權觸發下限 % */
  equityLowerBound: number
  /** 整體股權觸發上限 % */
  equityUpperBound: number
  trigger: 'buy' | 'sell' | 'none'
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

/** 單一交易日的損益（以收盤市值變化扣除當日現金流計算） */
export interface DailyPnL {
  /** yyyy-MM-dd */
  date: string
  pnl: number
  /** 前一交易日收盤市值，作為報酬率分母 */
  baseValue: number
  /** 當日收盤市值 */
  marketValue: number
  pnlPercent: number
  /** 當日賣出實現的損益 */
  realizedPnL: number
  /** 當日買進金額 − 賣出淨收入 */
  netCashFlow: number
  tradeCount: number
}

/** 一段期間（週、月或自訂區間）的損益統計 */
export interface PnlBucket {
  key: string
  label: string
  startDate: string
  endDate: string
  pnl: number
  pnlPercent: number
  tradingDays: number
  tradeCount: number
}

/** 自訂區間的起訖日 */
export interface DateRange {
  start: string
  end: string
}

export interface PnlSeries {
  days: DailyPnL[]
  startDate: string
  endDate: string
  /** 缺少歷史股價、僅以成交價估算的標的 */
  missing: string[]
  updatedAt: string
}

export interface CalendarCell {
  date: string
  dayOfMonth: number
  /** false 表示補齊週次用的鄰月日期 */
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  data: DailyPnL | null
}

export interface CalendarWeek {
  key: string
  startDate: string
  endDate: string
  /** 週次序號（一年中的第幾週） */
  weekOfYear: number
  cells: CalendarCell[]
  /** 整週損益，含鄰月日期 */
  total: PnlBucket
}

export interface CalendarMonth {
  monthKey: string
  label: string
  startDate: string
  endDate: string
  weeks: CalendarWeek[]
  /** 僅計入本月日期的損益 */
  total: PnlBucket
}

export type TabId =
  | 'dashboard'
  | 'transactions'
  | 'holdings'
  | 'cash'
  | 'allocation'

export type AllocationView = 'overview' | 'exposure' | 'rebalance' | 'risk'
