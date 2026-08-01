import type {
  Holding,
  PortfolioSummary,
  StockPrice,
  Transaction,
} from '../types'

/** 計算單筆交易成本（買：本金+手續費；賣：收入-手續費-稅） */
export function getTransactionCashFlow(tx: Transaction): number {
  const amount = tx.price * tx.shares
  if (tx.type === 'buy') {
    return -(amount + tx.fee)
  }
  return amount - tx.fee - tx.tax
}

/** 建議手續費（台股常見 0.1425%，可設折扣） */
export function suggestFee(price: number, shares: number, discount = 0.6): number {
  const fee = price * shares * 0.001425 * discount
  return Math.max(Math.round(fee * 100) / 100, 1)
}

/** 建議證交稅（賣出 0.3%） */
export function suggestTax(price: number, shares: number, type: 'buy' | 'sell'): number {
  if (type === 'buy') return 0
  return Math.round(price * shares * 0.003 * 100) / 100
}

/**
 * 以移動平均成本法計算持股與已實現損益
 */
export function calculateHoldings(
  transactions: Transaction[],
  prices: StockPrice[],
): Holding[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.createdAt.localeCompare(b.createdAt),
  )

  type Acc = {
    name: string
    shares: number
    totalCost: number
    realizedPnL: number
  }

  const map = new Map<string, Acc>()

  for (const tx of sorted) {
    const symbol = tx.symbol.toUpperCase()
    const current = map.get(symbol) ?? {
      name: tx.name,
      shares: 0,
      totalCost: 0,
      realizedPnL: 0,
    }

    current.name = tx.name || current.name

    if (tx.type === 'buy') {
      const cost = tx.price * tx.shares + tx.fee
      current.totalCost += cost
      current.shares += tx.shares
    } else {
      if (current.shares <= 0) {
        // 無持股卻賣出：視為做空/錯誤資料，仍記錄已實現損益
        const proceeds = tx.price * tx.shares - tx.fee - tx.tax
        current.realizedPnL += proceeds
        current.shares -= tx.shares
      } else {
        const sellShares = Math.min(tx.shares, current.shares)
        const avgCost = current.shares > 0 ? current.totalCost / current.shares : 0
        const costBasis = avgCost * sellShares
        const proceeds = tx.price * sellShares - (tx.fee + tx.tax) * (sellShares / tx.shares)
        current.realizedPnL += proceeds - costBasis
        current.totalCost -= costBasis
        current.shares -= sellShares

        // 超賣部分
        if (tx.shares > sellShares) {
          const extra = tx.shares - sellShares
          const extraProceeds =
            tx.price * extra - (tx.fee + tx.tax) * (extra / tx.shares)
          current.realizedPnL += extraProceeds
          current.shares -= extra
        }
      }
    }

    map.set(symbol, current)
  }

  const priceMap = new Map(prices.map((p) => [p.symbol.toUpperCase(), p.currentPrice]))
  const holdings: Holding[] = []

  for (const [symbol, acc] of map.entries()) {
    if (Math.abs(acc.shares) < 1e-9 && Math.abs(acc.realizedPnL) < 1e-6) continue

    const avgCost = acc.shares > 0 ? acc.totalCost / acc.shares : 0
    const currentPrice = priceMap.get(symbol) ?? avgCost
    const marketValue = acc.shares * currentPrice
    const unrealizedPnL = acc.shares > 0 ? marketValue - acc.totalCost : 0
    const unrealizedPnLPercent =
      acc.totalCost > 0 ? (unrealizedPnL / acc.totalCost) * 100 : 0

    holdings.push({
      symbol,
      name: acc.name,
      shares: acc.shares,
      avgCost,
      totalCost: Math.max(acc.totalCost, 0),
      currentPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      realizedPnL: acc.realizedPnL,
      weight: 0,
    })
  }

  const totalMarketValue = holdings
    .filter((h) => h.shares > 0)
    .reduce((sum, h) => sum + h.marketValue, 0)

  return holdings
    .map((h) => ({
      ...h,
      weight: totalMarketValue > 0 && h.shares > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue)
}

export function calculateSummary(
  transactions: Transaction[],
  holdings: Holding[],
): PortfolioSummary {
  let totalInvested = 0
  let cashFromSales = 0

  for (const tx of transactions) {
    if (tx.type === 'buy') {
      totalInvested += tx.price * tx.shares + tx.fee
    } else {
      cashFromSales += tx.price * tx.shares - tx.fee - tx.tax
    }
  }

  const activeHoldings = holdings.filter((h) => h.shares > 0)
  const totalMarketValue = activeHoldings.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = activeHoldings.reduce((s, h) => s + h.totalCost, 0)
  const unrealizedPnL = activeHoldings.reduce((s, h) => s + h.unrealizedPnL, 0)
  const realizedPnL = holdings.reduce((s, h) => s + h.realizedPnL, 0)
  const totalPnL = unrealizedPnL + realizedPnL

  // 報酬率：總損益 / 累計投入本金
  const totalROI = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  return {
    totalMarketValue,
    totalCost,
    totalInvested,
    cashFromSales,
    unrealizedPnL,
    realizedPnL,
    totalPnL,
    totalROI,
    holdingsCount: activeHoldings.length,
    transactionCount: transactions.length,
  }
}

export function formatCurrency(value: number, digits = 0): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, digits)}%`
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-rose-400'
  return 'text-slate-300'
}
