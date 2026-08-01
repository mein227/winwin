import type { StockPrice, Transaction } from '../types'

const TX_KEY = 'winwin_transactions'
const PRICE_KEY = 'winwin_prices'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadTransactions(): Transaction[] {
  return safeParse<Transaction[]>(localStorage.getItem(TX_KEY), [])
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(TX_KEY, JSON.stringify(transactions))
}

export function loadPrices(): StockPrice[] {
  return safeParse<StockPrice[]>(localStorage.getItem(PRICE_KEY), [])
}

export function savePrices(prices: StockPrice[]): void {
  localStorage.setItem(PRICE_KEY, JSON.stringify(prices))
}

export function exportData(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: loadTransactions(),
      prices: loadPrices(),
    },
    null,
    2,
  )
}

export function importData(json: string): { transactions: Transaction[]; prices: StockPrice[] } {
  const data = JSON.parse(json) as {
    transactions?: Transaction[]
    prices?: StockPrice[]
  }
  if (!Array.isArray(data.transactions)) {
    throw new Error('無效的匯入資料：缺少交易紀錄')
  }
  return {
    transactions: data.transactions,
    prices: Array.isArray(data.prices) ? data.prices : [],
  }
}
