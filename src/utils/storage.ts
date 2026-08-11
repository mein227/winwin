import type {
  AllocationSettings,
  AssetSetting,
  CashAccount,
  StockPrice,
  Transaction,
} from '../types'
import { defaultAllocationSettings } from './exposure'

const TX_KEY = 'winwin_transactions'
const PRICE_KEY = 'winwin_prices'
const CASH_KEY = 'winwin_cash_accounts'
const ASSET_SETTING_KEY = 'winwin_asset_settings'
const ALLOCATION_SETTING_KEY = 'winwin_allocation_settings'

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

export function loadCashAccounts(): CashAccount[] {
  return safeParse<CashAccount[]>(localStorage.getItem(CASH_KEY), [])
}

export function saveCashAccounts(accounts: CashAccount[]): void {
  localStorage.setItem(CASH_KEY, JSON.stringify(accounts))
}

export function loadAssetSettings(): AssetSetting[] {
  return safeParse<AssetSetting[]>(localStorage.getItem(ASSET_SETTING_KEY), [])
}

export function saveAssetSettings(settings: AssetSetting[]): void {
  localStorage.setItem(ASSET_SETTING_KEY, JSON.stringify(settings))
}

export function loadAllocationSettings(): AllocationSettings {
  const stored = safeParse<Partial<AllocationSettings>>(
    localStorage.getItem(ALLOCATION_SETTING_KEY),
    {},
  )
  return { ...defaultAllocationSettings, ...stored }
}

export function saveAllocationSettings(settings: AllocationSettings): void {
  localStorage.setItem(ALLOCATION_SETTING_KEY, JSON.stringify(settings))
}

export interface PortfolioBackup {
  transactions: Transaction[]
  prices: StockPrice[]
  cashAccounts: CashAccount[]
  assetSettings: AssetSetting[]
  allocationSettings: AllocationSettings
}

export function exportData(): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions: loadTransactions(),
      prices: loadPrices(),
      cashAccounts: loadCashAccounts(),
      assetSettings: loadAssetSettings(),
      allocationSettings: loadAllocationSettings(),
    },
    null,
    2,
  )
}

/** 匯入備份；版本 1 的檔案沒有現金與配置設定，以預設值補齊 */
export function importData(json: string): PortfolioBackup {
  const data = JSON.parse(json) as Partial<PortfolioBackup>
  if (!Array.isArray(data.transactions)) {
    throw new Error('無效的匯入資料：缺少交易紀錄')
  }
  return {
    transactions: data.transactions,
    prices: Array.isArray(data.prices) ? data.prices : [],
    cashAccounts: Array.isArray(data.cashAccounts) ? data.cashAccounts : [],
    assetSettings: Array.isArray(data.assetSettings) ? data.assetSettings : [],
    allocationSettings: {
      ...defaultAllocationSettings,
      ...(data.allocationSettings ?? {}),
    },
  }
}
