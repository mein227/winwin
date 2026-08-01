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

export type TabId = 'dashboard' | 'transactions' | 'holdings' | 'allocation'
