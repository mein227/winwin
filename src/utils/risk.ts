import type { AssetRisk, PortfolioRisk } from '../types'

/** 台股一年約 252 個交易日 */
export const TRADING_DAYS = 252

/** 常態分布 95% 單尾分位數，用於 VaR */
export const Z95 = 1.645

export interface PriceSeries {
  symbol: string
  name: string
  dates: string[]
  closes: number[]
}

export interface RiskPosition {
  symbol: string
  name: string
  marketValue: number
}

export interface RiskInput {
  positions: RiskPosition[]
  series: PriceSeries[]
  benchmark: PriceSeries | null
  netWorth: number
  /** 無風險利率 %，用於 Sharpe */
  riskFreeRate: number
  /** 現金加權年利率 %，用於估算含現金後的總報酬 */
  cashRate?: number
}

/** 日報酬率序列：r_t = P_t / P_{t-1} − 1 */
export function dailyReturns(closes: number[]): number[] {
  const result: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    if (!(prev > 0)) continue
    result.push(closes[i] / prev - 1)
  }
  return result
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** 樣本標準差 */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance =
    values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** 年化波動度 %：日報酬標準差 × √252 */
export function annualizedVolatility(returns: number[]): number {
  return stdev(returns) * Math.sqrt(TRADING_DAYS) * 100
}

/** 年化報酬率 %：以幾何平均年化，(Π(1+r))^(252/n) − 1 */
export function annualizedReturn(returns: number[]): number {
  if (returns.length === 0) return 0
  let growth = 1
  for (const r of returns) growth *= 1 + r
  if (growth <= 0) return -100
  return (Math.pow(growth, TRADING_DAYS / returns.length) - 1) * 100
}

/** 最大回撤 %（正數表示跌幅） */
export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity
  let worst = 0
  for (const value of closes) {
    if (value > peak) peak = value
    if (peak > 0) {
      const drawdown = (value / peak - 1) * 100
      if (drawdown < worst) worst = drawdown
    }
  }
  return Math.abs(worst)
}

/** 由報酬序列還原淨值走勢後計算最大回撤 % */
export function maxDrawdownFromReturns(returns: number[]): number {
  let value = 1
  const curve = [value]
  for (const r of returns) {
    value *= 1 + r
    curve.push(value)
  }
  return maxDrawdown(curve)
}

/** 樣本共變異數（日資料） */
export function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const avgA = mean(a.slice(0, n))
  const avgB = mean(b.slice(0, n))
  let sum = 0
  for (let i = 0; i < n; i++) sum += (a[i] - avgA) * (b[i] - avgB)
  return sum / (n - 1)
}

/** Beta = Cov(個股, 市場) ÷ Var(市場) */
export function betaOf(asset: number[], market: number[]): number {
  const marketVariance = covariance(market, market)
  if (marketVariance === 0) return 0
  return covariance(asset, market) / marketVariance
}

/** 取所有序列的日期交集，確保報酬對齊 */
export function alignSeries(series: PriceSeries[]): {
  dates: string[]
  closes: Map<string, number[]>
} {
  const closes = new Map<string, number[]>()
  if (series.length === 0) return { dates: [], closes }

  const maps = series.map(
    (s) => new Map(s.dates.map((date, index) => [date, s.closes[index]])),
  )

  const dates = series[0].dates.filter((date) =>
    maps.every((map) => {
      const value = map.get(date)
      return typeof value === 'number' && value > 0
    }),
  )

  series.forEach((s, index) => {
    const map = maps[index]
    closes.set(
      s.symbol.toUpperCase(),
      dates.map((date) => map.get(date) as number),
    )
  })

  return { dates, closes }
}

/** 年化共變異數矩陣 */
export function covarianceMatrix(returns: number[][]): number[][] {
  const size = returns.length
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0))
  for (let i = 0; i < size; i++) {
    for (let j = i; j < size; j++) {
      const value = covariance(returns[i], returns[j]) * TRADING_DAYS
      matrix[i][j] = value
      matrix[j][i] = value
    }
  }
  return matrix
}

function multiply(matrix: number[][], weights: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * weights[index], 0))
}

/** 組合年化波動度 %：σ_p = √(wᵀ Σ w) */
export function portfolioVolatility(weights: number[], covMatrix: number[][]): number {
  if (weights.length === 0) return 0
  const product = multiply(covMatrix, weights)
  const variance = weights.reduce((sum, w, index) => sum + w * product[index], 0)
  return variance > 0 ? Math.sqrt(variance) * 100 : 0
}

/**
 * 風險貢獻拆解。
 * 邊際風險 MCTR_i = (Σw)_i ÷ σ_p，風險貢獻 RC_i = w_i × MCTR_i，且 Σ RC_i = σ_p
 */
export function riskDecomposition(
  weights: number[],
  covMatrix: number[][],
): { contribution: number[]; marginal: number[]; volatility: number } {
  const product = multiply(covMatrix, weights)
  const variance = weights.reduce((sum, w, index) => sum + w * product[index], 0)
  const sigma = variance > 0 ? Math.sqrt(variance) : 0
  if (sigma === 0) {
    return {
      contribution: weights.map(() => 0),
      marginal: weights.map(() => 0),
      volatility: 0,
    }
  }
  const marginal = product.map((value) => value / sigma)
  const contribution = weights.map((w, index) => w * marginal[index])
  return { contribution, marginal, volatility: sigma }
}

/**
 * 計算投資組合的報酬與風險指標。
 *
 * 權重採用市值權重：槓桿 ETF 的歷史報酬本身已包含槓桿效果，
 * 若再乘上倍數會重複計算風險。
 */
export function calculatePortfolioRisk(input: RiskInput): PortfolioRisk {
  const { positions, benchmark, netWorth, riskFreeRate } = input
  const cashRate = input.cashRate ?? 0

  const available = positions.filter((position) =>
    input.series.some((s) => s.symbol.toUpperCase() === position.symbol.toUpperCase()),
  )
  const missing = positions
    .filter((position) => !available.includes(position))
    .map((position) => position.symbol)

  const usedSeries = available.map(
    (position) =>
      input.series.find(
        (s) => s.symbol.toUpperCase() === position.symbol.toUpperCase(),
      ) as PriceSeries,
  )

  const empty: PortfolioRisk = {
    annualReturn: 0,
    annualVolatility: 0,
    sharpe: 0,
    beta: 0,
    maxDrawdown: 0,
    totalVolatility: 0,
    totalReturn: 0,
    var95: 0,
    var95Percent: 0,
    weightedVolatility: 0,
    diversification: 0,
    returnRiskRatio: 0,
    assets: [],
    riskParityWeights: [],
    benchmark: null,
    tradingDays: 0,
    startDate: '',
    endDate: '',
    missing,
    updatedAt: new Date().toISOString(),
  }

  if (usedSeries.length === 0) return empty

  const aligned = alignSeries(benchmark ? [...usedSeries, benchmark] : usedSeries)
  if (aligned.dates.length < 3) return empty

  const benchmarkCloses = benchmark
    ? (aligned.closes.get(benchmark.symbol.toUpperCase()) ?? [])
    : []
  const benchmarkReturns = benchmarkCloses.length > 1 ? dailyReturns(benchmarkCloses) : []

  const stockValue = available.reduce((sum, position) => sum + position.marketValue, 0)
  const weights = available.map((position) =>
    stockValue > 0 ? position.marketValue / stockValue : 0,
  )

  const returnsList = usedSeries.map((s) =>
    dailyReturns(aligned.closes.get(s.symbol.toUpperCase()) ?? []),
  )
  const covMatrix = covarianceMatrix(returnsList)
  const decomposition = riskDecomposition(weights, covMatrix)
  const annualVolatility = decomposition.volatility * 100

  const assets: AssetRisk[] = available.map((position, index) => {
    const returns = returnsList[index]
    const closes = aligned.closes.get(position.symbol.toUpperCase()) ?? []
    const volatility = annualizedVolatility(returns)
    const assetReturn = annualizedReturn(returns)
    return {
      symbol: position.symbol,
      name: position.name,
      weight: weights[index] * 100,
      annualReturn: assetReturn,
      annualVolatility: volatility,
      sharpe: volatility > 0 ? (assetReturn - riskFreeRate) / volatility : 0,
      beta: benchmarkReturns.length > 1 ? betaOf(returns, benchmarkReturns) : 0,
      maxDrawdown: maxDrawdown(closes),
      riskContribution:
        decomposition.volatility > 0
          ? (decomposition.contribution[index] / decomposition.volatility) * 100
          : 0,
      marginalRisk: decomposition.marginal[index] * 100,
      dataPoints: returns.length,
    }
  })

  const periods = Math.min(...returnsList.map((r) => r.length))
  const portfolioReturns: number[] = []
  for (let t = 0; t < periods; t++) {
    let value = 0
    for (let i = 0; i < returnsList.length; i++) value += weights[i] * returnsList[i][t]
    portfolioReturns.push(value)
  }

  const annualReturn = annualizedReturn(portfolioReturns)
  const weightedVolatility = assets.reduce(
    (sum, asset) => sum + (asset.weight / 100) * asset.annualVolatility,
    0,
  )
  const beta = assets.reduce((sum, asset) => sum + (asset.weight / 100) * asset.beta, 0)

  const stockShare = netWorth > 0 ? stockValue / netWorth : 1
  const cashShare = Math.max(1 - stockShare, 0)
  const totalVolatility = annualVolatility * stockShare
  const totalReturn = annualReturn * stockShare + cashRate * cashShare

  const inverseVol = assets.map((asset) => ({
    symbol: asset.symbol,
    value: asset.annualVolatility > 0 ? 1 / asset.annualVolatility : 0,
  }))
  const inverseTotal = inverseVol.reduce((sum, item) => sum + item.value, 0)

  return {
    annualReturn,
    annualVolatility,
    sharpe: annualVolatility > 0 ? (annualReturn - riskFreeRate) / annualVolatility : 0,
    beta,
    maxDrawdown: maxDrawdownFromReturns(portfolioReturns),
    totalVolatility,
    totalReturn,
    var95: (Z95 * totalVolatility * netWorth) / 100,
    var95Percent: Z95 * totalVolatility,
    weightedVolatility,
    diversification: weightedVolatility - annualVolatility,
    returnRiskRatio: annualVolatility > 0 ? annualReturn / annualVolatility : 0,
    assets: assets.sort((a, b) => b.weight - a.weight),
    riskParityWeights:
      inverseTotal > 0
        ? inverseVol.map((item) => ({
            symbol: item.symbol,
            weight: (item.value / inverseTotal) * 100,
          }))
        : [],
    benchmark:
      benchmark && benchmarkReturns.length > 1
        ? {
            symbol: benchmark.symbol,
            name: benchmark.name,
            annualReturn: annualizedReturn(benchmarkReturns),
            annualVolatility: annualizedVolatility(benchmarkReturns),
            maxDrawdown: maxDrawdown(benchmarkCloses),
          }
        : null,
    tradingDays: aligned.dates.length,
    startDate: aligned.dates[0] ?? '',
    endDate: aligned.dates[aligned.dates.length - 1] ?? '',
    missing,
    updatedAt: new Date().toISOString(),
  }
}
