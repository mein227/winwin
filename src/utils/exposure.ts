import type {
  AllocationSettings,
  AssetClass,
  AssetClassBreakdown,
  AssetSetting,
  CashAccount,
  CashAccountType,
  ExposureItem,
  ExposureSummary,
  Holding,
  RebalancePlan,
  RebalanceRow,
} from '../types'
import { suggestFee, suggestTax } from './calculations'

export const CASH_KEY = '__CASH__'

export const defaultAllocationSettings: AllocationSettings = {
  cashTargetWeight: 20,
  rebalanceThreshold: 5,
  rebalanceBasis: 'value',
  riskFreeRate: 1.5,
  lotSize: 1000,
  maxExposureRatio: 120,
  historyDays: 365,
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: '個股',
  etf: '一般 ETF',
  leveraged: '槓桿 ETF',
  inverse: '反向 ETF',
  bond: '債券 ETF',
  reit: '不動產',
  other: '其他',
}

const CASH_TYPE_LABELS: Record<CashAccountType, string> = {
  bank: '銀行活存',
  broker: '券商交割戶',
  deposit: '定存／貨幣基金',
  debt: '負債（融資、質借）',
  other: '其他',
}

/**
 * 常見台股槓桿／反向 ETF 的曝險倍數。
 * 代號後綴 L（槓桿）／R（反向）已可推斷，此表用於名稱缺漏時的保險。
 */
const KNOWN_LEVERAGE: Record<string, number> = {
  '00631L': 2,
  '00632R': -1,
  '00633L': 2,
  '00634R': -1,
  '00637L': 2,
  '00638R': -1,
  '00647L': 2,
  '00648R': -1,
  '00655L': 2,
  '00656R': -1,
  '00663L': 2,
  '00664R': -1,
  '00670L': 2,
  '00671R': -1,
  '00675L': 2,
  '00676R': -1,
  '00680L': 2,
  '00681R': -1,
  '00683L': 2,
  '00684R': -1,
  '00685L': 2,
  '00686R': -1,
  '00688L': 2,
  '00689R': -1,
}

export function assetClassLabel(assetClass: AssetClass): string {
  return ASSET_CLASS_LABELS[assetClass] ?? ASSET_CLASS_LABELS.other
}

export function cashTypeLabel(type: CashAccountType): string {
  return CASH_TYPE_LABELS[type] ?? CASH_TYPE_LABELS.other
}

export const assetClassOptions = Object.keys(ASSET_CLASS_LABELS) as AssetClass[]
export const cashTypeOptions = Object.keys(CASH_TYPE_LABELS) as CashAccountType[]

/**
 * 由代號與名稱自動判定曝險倍數與資產類別。
 * 台股慣例：代號後綴 L 為槓桿（多為正 2）、R 為反向（多為反 1）、B 為債券、T 為不動產。
 */
export function detectAssetProfile(
  symbol: string,
  name = '',
): { leverage: number; assetClass: AssetClass } {
  const key = symbol.trim().toUpperCase()

  let leverage = KNOWN_LEVERAGE[key] ?? 0

  if (leverage === 0) {
    const positive = name.match(/正\s*([2-9２３４５６７８９二三四五六七八九])/)
    const negative = name.match(/反\s*([1-9１２３４５６７８９一二三四五六七八九])/)
    if (positive) leverage = parseMultiplier(positive[1], 2)
    else if (negative) leverage = -parseMultiplier(negative[1], 1)
    else if (/^0\d{3,5}L$/.test(key)) leverage = 2
    else if (/^0\d{3,5}R$/.test(key)) leverage = -1
    else leverage = 1
  }

  let assetClass: AssetClass = 'equity'
  if (leverage > 1) assetClass = 'leveraged'
  else if (leverage < 0) assetClass = 'inverse'
  else if (/債/.test(name) || /^0\d{3,5}B$/.test(key)) assetClass = 'bond'
  else if (/REIT|不動產|地產/i.test(name) || /^0\d{3,5}T$/.test(key)) assetClass = 'reit'
  else if (/^0\d{3,5}[A-Z]?$/.test(key)) assetClass = 'etf'

  return { leverage, assetClass }
}

function parseMultiplier(raw: string, fallback: number): number {
  const table: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  if (table[raw]) return table[raw]
  const normalized = raw.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
  const num = Number(normalized)
  return Number.isFinite(num) && num !== 0 ? num : fallback
}

/** 取得標的設定，缺少時以自動判定結果補上 */
export function resolveAssetSetting(
  symbol: string,
  name: string,
  settings: AssetSetting[],
): AssetSetting {
  const key = symbol.trim().toUpperCase()
  const existing = settings.find((s) => s.symbol.toUpperCase() === key)
  if (existing && !existing.auto) return existing

  const detected = detectAssetProfile(key, name)
  return {
    symbol: key,
    leverage: detected.leverage,
    assetClass: detected.assetClass,
    targetWeight: existing?.targetWeight,
    auto: true,
  }
}

export function summarizeCash(accounts: CashAccount[]): {
  asset: number
  debt: number
  net: number
} {
  let asset = 0
  let debt = 0
  for (const account of accounts) {
    const amount = Number(account.amount) || 0
    if (account.type === 'debt') debt += Math.abs(amount)
    else asset += amount
  }
  return { asset, debt, net: asset - debt }
}

/** 現金加權平均利率 %（負債以借款成本計） */
export function cashWeightedRate(accounts: CashAccount[]): number {
  let weight = 0
  let sum = 0
  for (const account of accounts) {
    const amount = Math.abs(Number(account.amount) || 0)
    if (amount <= 0 || account.interestRate === undefined) continue
    const rate = account.type === 'debt' ? -account.interestRate : account.interestRate
    sum += amount * rate
    weight += amount
  }
  return weight > 0 ? sum / weight : 0
}

export interface ExposureResult {
  items: ExposureItem[]
  summary: ExposureSummary
  breakdown: AssetClassBreakdown[]
}

/**
 * 計算資產曝險。
 *
 * 單一標的曝險 = 市值 × 槓桿倍數
 * 總淨值       = 持股市值 + 淨現金（現金資產 − 負債）
 * 淨曝險比率   = 淨曝險 ÷ 總淨值
 */
export function calculateExposure(
  holdings: Holding[],
  cashAccounts: CashAccount[],
  assetSettings: AssetSetting[],
): ExposureResult {
  const active = holdings.filter((h) => h.shares > 0)
  const cash = summarizeCash(cashAccounts)

  const stockValue = active.reduce((sum, h) => sum + h.marketValue, 0)
  const netWorth = stockValue + cash.net

  const raw = active.map((h) => {
    const setting = resolveAssetSetting(h.symbol, h.name, assetSettings)
    const exposure = h.marketValue * setting.leverage
    return {
      symbol: h.symbol,
      name: h.name,
      assetClass: setting.assetClass,
      leverage: setting.leverage,
      marketValue: h.marketValue,
      exposure,
      impliedBorrow: exposure - h.marketValue,
    }
  })

  const netExposure = raw.reduce((sum, item) => sum + item.exposure, 0)
  const grossExposure = raw.reduce((sum, item) => sum + Math.abs(item.exposure), 0)
  const longExposure = raw.reduce((sum, item) => sum + Math.max(item.exposure, 0), 0)
  const shortExposure = raw.reduce((sum, item) => sum + Math.min(item.exposure, 0), 0)
  const impliedBorrow = netExposure - stockValue
  const leveragedValue = raw
    .filter((item) => item.leverage !== 1)
    .reduce((sum, item) => sum + item.marketValue, 0)

  const items: ExposureItem[] = raw
    .map((item) => ({
      ...item,
      valueWeight: netWorth > 0 ? (item.marketValue / netWorth) * 100 : 0,
      exposureWeight: netExposure !== 0 ? (item.exposure / netExposure) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure))

  const summary: ExposureSummary = {
    stockValue,
    cashAsset: cash.asset,
    debtValue: cash.debt,
    netCash: cash.net,
    netWorth,
    grossExposure,
    netExposure,
    longExposure,
    shortExposure: Math.abs(shortExposure),
    exposureRatio: netWorth > 0 ? (netExposure / netWorth) * 100 : 0,
    grossExposureRatio: netWorth > 0 ? (grossExposure / netWorth) * 100 : 0,
    leverageRatio: netWorth > 0 ? netExposure / netWorth : 0,
    cashRatio: netWorth > 0 ? (cash.net / netWorth) * 100 : 0,
    impliedBorrow,
    leveragedValue,
    leveragedRatio: stockValue > 0 ? (leveragedValue / stockValue) * 100 : 0,
    cashBuffer: netExposure > 0 ? (cash.net / netExposure) * 100 : 0,
  }

  const groups = new Map<AssetClass, { marketValue: number; exposure: number }>()
  for (const item of items) {
    const group = groups.get(item.assetClass) ?? { marketValue: 0, exposure: 0 }
    group.marketValue += item.marketValue
    group.exposure += item.exposure
    groups.set(item.assetClass, group)
  }

  const breakdown: AssetClassBreakdown[] = [...groups.entries()]
    .map(([assetClass, group]) => ({
      assetClass,
      label: assetClassLabel(assetClass),
      marketValue: group.marketValue,
      exposure: group.exposure,
      valueWeight: netWorth > 0 ? (group.marketValue / netWorth) * 100 : 0,
      exposureWeight: netExposure !== 0 ? (group.exposure / netExposure) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue)

  return { items, summary, breakdown }
}

/**
 * 每日重設型槓桿 ETF 的年化波動耗損（%）。
 *
 * 以幾何布朗運動近似：k 倍每日重設商品的長期報酬 ≈ k·μ − (k² − k)/2·σ²
 * 因此波動耗損 = (k² − k)/2 × σ²，k=2、σ=25% 時約每年 6.25%。
 */
export function leverageDecay(leverage: number, annualVolatility: number): number {
  const sigma = annualVolatility / 100
  return (((leverage * leverage - leverage) / 2) * sigma * sigma) * 100
}

/** 槓桿 ETF 長期年化報酬估算（%）：k×市場報酬 − 波動耗損 */
export function estimateLeveragedReturn(
  leverage: number,
  marketReturn: number,
  annualVolatility: number,
): number {
  return leverage * marketReturn - leverageDecay(leverage, annualVolatility)
}

/** 市場漲跌 marketReturn% 時，整體淨值的變動 */
export function marketScenario(
  summary: ExposureSummary,
  marketReturn: number,
): { changeAmount: number; changePercent: number; netWorthAfter: number } {
  const changeAmount = summary.netExposure * (marketReturn / 100)
  return {
    changeAmount,
    changePercent: summary.netWorth > 0 ? (changeAmount / summary.netWorth) * 100 : 0,
    netWorthAfter: summary.netWorth + changeAmount,
  }
}

/**
 * 產生再平衡計畫。
 *
 * 目標金額 = 目標權重 × 總淨值
 * 差額     = 目標金額 − 目前金額
 * 股數     = 差額 ÷ 現價（曝險模式再除以槓桿倍數）
 * 僅在 |偏離| ≥ 門檻 時建議調整
 */
export function buildRebalancePlan(
  holdings: Holding[],
  exposure: ExposureResult,
  assetSettings: AssetSetting[],
  settings: AllocationSettings,
): RebalancePlan {
  const basis = settings.rebalanceBasis
  // 負債大於資產時淨值為負，權重與目標金額都失去意義，一律視為 0
  const base = Math.max(exposure.summary.netWorth, 0)
  const lotSize = settings.lotSize > 0 ? settings.lotSize : 1000
  const holdingMap = new Map(holdings.map((h) => [h.symbol.toUpperCase(), h]))

  const targets = new Map<string, number>()
  for (const setting of assetSettings) {
    const weight = Number(setting.targetWeight)
    if (Number.isFinite(weight) && weight > 0) {
      targets.set(setting.symbol.toUpperCase(), weight)
    }
  }

  const cashTarget = Math.max(Number(settings.cashTargetWeight) || 0, 0)
  const symbols = new Set<string>([
    ...exposure.items.map((item) => item.symbol.toUpperCase()),
    ...targets.keys(),
  ])

  const targetSum =
    cashTarget + [...symbols].reduce((sum, symbol) => sum + (targets.get(symbol) ?? 0), 0)
  const normalized = targetSum > 0 && Math.abs(targetSum - 100) > 0.01
  const factor = normalized ? 100 / targetSum : 1

  const rows: RebalanceRow[] = []
  let totalBuy = 0
  let totalSell = 0
  let totalCost = 0

  for (const symbol of symbols) {
    const item = exposure.items.find((i) => i.symbol.toUpperCase() === symbol)
    const holding = holdingMap.get(symbol)
    const setting = resolveAssetSetting(symbol, holding?.name ?? '', assetSettings)
    const leverage = item?.leverage ?? setting.leverage
    const price = holding?.currentPrice ?? 0
    const currentValue = basis === 'exposure' ? (item?.exposure ?? 0) : (item?.marketValue ?? 0)
    const targetWeight = (targets.get(symbol) ?? 0) * factor
    const targetValue = (targetWeight / 100) * base
    const diffValue = targetValue - currentValue
    const currentWeight = base > 0 ? (currentValue / base) * 100 : 0
    const diffWeight = targetWeight - currentWeight
    const overThreshold = Math.abs(diffWeight) >= settings.rebalanceThreshold

    const perShare = basis === 'exposure' ? price * leverage : price
    let shares = perShare !== 0 ? diffValue / perShare : 0
    if (shares < 0 && holding) {
      shares = Math.max(shares, -holding.shares)
    }
    shares = Math.round(shares)

    const action: RebalanceRow['action'] = !overThreshold
      ? 'hold'
      : diffValue > 0
        ? 'buy'
        : 'sell'

    const tradeValue = price > 0 ? Math.abs(shares) * price : Math.abs(diffValue)
    const estimatedFee =
      action === 'hold' || tradeValue <= 0 ? 0 : suggestFee(tradeValue, 1)
    const estimatedTax = action === 'sell' ? suggestTax(tradeValue, 1, 'sell') : 0

    if (action === 'buy') totalBuy += tradeValue
    if (action === 'sell') totalSell += tradeValue
    totalCost += estimatedFee + estimatedTax

    rows.push({
      key: symbol,
      symbol,
      name: holding?.name ?? symbol,
      isCash: false,
      price,
      leverage,
      currentValue,
      currentWeight,
      targetWeight,
      targetValue,
      diffValue,
      diffWeight,
      shares,
      lots: shares / lotSize,
      estimatedFee,
      estimatedTax,
      action,
      overThreshold,
    })
  }

  rows.sort((a, b) => b.currentValue - a.currentValue)

  const cashBefore = exposure.summary.netCash
  const cashTargetWeight = cashTarget * factor
  const cashTargetValue = (cashTargetWeight / 100) * base
  const cashCurrentWeight = base > 0 ? (cashBefore / base) * 100 : 0

  rows.push({
    key: CASH_KEY,
    symbol: CASH_KEY,
    name: '現金',
    isCash: true,
    price: 0,
    leverage: 0,
    currentValue: cashBefore,
    currentWeight: cashCurrentWeight,
    targetWeight: cashTargetWeight,
    targetValue: cashTargetValue,
    diffValue: cashTargetValue - cashBefore,
    diffWeight: cashTargetWeight - cashCurrentWeight,
    shares: 0,
    lots: 0,
    estimatedFee: 0,
    estimatedTax: 0,
    action: 'hold',
    overThreshold:
      Math.abs(cashTargetWeight - cashCurrentWeight) >= settings.rebalanceThreshold,
  })

  return {
    basis,
    base,
    rows,
    totalBuy,
    totalSell,
    totalCost,
    cashBefore,
    cashAfter: cashBefore + totalSell - totalBuy - totalCost,
    targetSum,
    normalized,
  }
}

/** 等權重目標：股票部位平均分配剩餘權重 */
export function equalWeightTargets(
  symbols: string[],
  cashTargetWeight: number,
): Record<string, number> {
  const result: Record<string, number> = {}
  if (symbols.length === 0) return result
  const stockWeight = Math.max(100 - cashTargetWeight, 0)
  const each = Math.round((stockWeight / symbols.length) * 10) / 10
  for (const symbol of symbols) result[symbol.toUpperCase()] = each
  return result
}

/** 以目前市值比例作為目標（維持現況） */
export function currentWeightTargets(
  items: ExposureItem[],
  cashTargetWeight: number,
): Record<string, number> {
  const result: Record<string, number> = {}
  const total = items.reduce((sum, item) => sum + item.marketValue, 0)
  if (total <= 0) return result
  const stockWeight = Math.max(100 - cashTargetWeight, 0)
  for (const item of items) {
    result[item.symbol.toUpperCase()] =
      Math.round((item.marketValue / total) * stockWeight * 10) / 10
  }
  return result
}

/**
 * 風險平價目標：權重與波動度成反比（w_i ∝ 1/σ_i），
 * 讓每檔標的貢獻相近的風險。
 */
export function riskParityTargets(
  volatilities: { symbol: string; annualVolatility: number }[],
  cashTargetWeight: number,
): Record<string, number> {
  const result: Record<string, number> = {}
  const usable = volatilities.filter((v) => v.annualVolatility > 0)
  if (usable.length === 0) return result
  const inverse = usable.map((v) => ({ symbol: v.symbol, value: 1 / v.annualVolatility }))
  const total = inverse.reduce((sum, item) => sum + item.value, 0)
  const stockWeight = Math.max(100 - cashTargetWeight, 0)
  for (const item of inverse) {
    result[item.symbol.toUpperCase()] =
      Math.round((item.value / total) * stockWeight * 10) / 10
  }
  return result
}
