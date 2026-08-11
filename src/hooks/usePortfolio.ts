import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AllocationSettings,
  AssetClass,
  AssetSetting,
  CashAccount,
  StockPrice,
  Transaction,
} from '../types'
import { calculateHoldings, calculateSummary } from '../utils/calculations'
import {
  buildRebalancePlan,
  calculateExposure,
  cashWeightedRate,
  defaultAllocationSettings,
} from '../utils/exposure'
import {
  exportData,
  importData,
  loadAllocationSettings,
  loadAssetSettings,
  loadCashAccounts,
  loadPrices,
  loadTransactions,
  saveAllocationSettings,
  saveAssetSettings,
  saveCashAccounts,
  savePrices,
  saveTransactions,
} from '../utils/storage'

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function usePortfolio() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions())
  const [prices, setPrices] = useState<StockPrice[]>(() => loadPrices())
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(() => loadCashAccounts())
  const [assetSettings, setAssetSettings] = useState<AssetSetting[]>(() => loadAssetSettings())
  const [settings, setSettings] = useState<AllocationSettings>(() => loadAllocationSettings())

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  useEffect(() => {
    savePrices(prices)
  }, [prices])

  useEffect(() => {
    saveCashAccounts(cashAccounts)
  }, [cashAccounts])

  useEffect(() => {
    saveAssetSettings(assetSettings)
  }, [assetSettings])

  useEffect(() => {
    saveAllocationSettings(settings)
  }, [settings])

  const holdings = useMemo(
    () => calculateHoldings(transactions, prices),
    [transactions, prices],
  )

  const summary = useMemo(
    () => calculateSummary(transactions, holdings),
    [transactions, holdings],
  )

  const exposure = useMemo(
    () => calculateExposure(holdings, cashAccounts, assetSettings),
    [holdings, cashAccounts, assetSettings],
  )

  const rebalance = useMemo(
    () => buildRebalancePlan(holdings, exposure, assetSettings, settings),
    [holdings, exposure, assetSettings, settings],
  )

  const cashRate = useMemo(() => cashWeightedRate(cashAccounts), [cashAccounts])

  const addTransaction = useCallback((tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const next: Transaction = {
      ...tx,
      id: createId(),
      symbol: tx.symbol.trim().toUpperCase(),
      name: tx.name.trim(),
      createdAt: new Date().toISOString(),
    }
    setTransactions((prev) => [next, ...prev])

    // 買進時若尚無市價，預設為成交價
    setPrices((prev) => {
      const symbol = next.symbol
      if (prev.some((p) => p.symbol === symbol)) return prev
      return [
        ...prev,
        {
          symbol,
          currentPrice: next.price,
          updatedAt: new Date().toISOString(),
        },
      ]
    })
  }, [])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              ...patch,
              symbol: (patch.symbol ?? tx.symbol).trim().toUpperCase(),
              name: (patch.name ?? tx.name).trim(),
            }
          : tx,
      ),
    )
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id))
  }, [])

  const updatePrice = useCallback((symbol: string, currentPrice: number) => {
    const key = symbol.toUpperCase()
    setPrices((prev) => {
      const existing = prev.find((p) => p.symbol === key)
      if (existing) {
        return prev.map((p) =>
          p.symbol === key
            ? { ...p, currentPrice, updatedAt: new Date().toISOString() }
            : p,
        )
      }
      return [
        ...prev,
        { symbol: key, currentPrice, updatedAt: new Date().toISOString() },
      ]
    })
  }, [])

  const updatePrices = useCallback(
    (updates: { symbol: string; currentPrice: number }[]) => {
      if (updates.length === 0) return
      const map = new Map(
        updates.map((u) => [u.symbol.toUpperCase(), u.currentPrice] as const),
      )
      setPrices((prev) => {
        const next = [...prev]
        const seen = new Set<string>()
        for (let i = 0; i < next.length; i++) {
          const key = next[i].symbol.toUpperCase()
          if (map.has(key)) {
            next[i] = {
              ...next[i],
              currentPrice: map.get(key)!,
              updatedAt: new Date().toISOString(),
            }
            seen.add(key)
          }
        }
        for (const [symbol, currentPrice] of map) {
          if (!seen.has(symbol)) {
            next.push({
              symbol,
              currentPrice,
              updatedAt: new Date().toISOString(),
            })
          }
        }
        return next
      })
    },
    [],
  )

  const addCashAccount = useCallback((account: Omit<CashAccount, 'id' | 'updatedAt'>) => {
    setCashAccounts((prev) => [
      ...prev,
      {
        ...account,
        name: account.name.trim() || '現金',
        id: createId(),
        updatedAt: new Date().toISOString(),
      },
    ])
  }, [])

  const updateCashAccount = useCallback((id: string, patch: Partial<CashAccount>) => {
    setCashAccounts((prev) =>
      prev.map((account) =>
        account.id === id
          ? { ...account, ...patch, updatedAt: new Date().toISOString() }
          : account,
      ),
    )
  }, [])

  const deleteCashAccount = useCallback((id: string) => {
    setCashAccounts((prev) => prev.filter((account) => account.id !== id))
  }, [])

  const upsertAssetSetting = useCallback(
    (symbol: string, patch: Partial<AssetSetting>) => {
      const key = symbol.trim().toUpperCase()
      if (!key) return
      setAssetSettings((prev) => {
        const index = prev.findIndex((s) => s.symbol.toUpperCase() === key)
        if (index >= 0) {
          const next = [...prev]
          next[index] = { ...next[index], ...patch, symbol: key }
          return next
        }
        return [
          ...prev,
          {
            symbol: key,
            leverage: 1,
            assetClass: 'equity',
            auto: true,
            ...patch,
          },
        ]
      })
    },
    [],
  )

  /** 手動覆寫槓桿倍數與資產類別（覆寫後不再自動判定） */
  const setAssetOverride = useCallback(
    (symbol: string, override: { leverage: number; assetClass: AssetClass }) => {
      upsertAssetSetting(symbol, { ...override, auto: false })
    },
    [upsertAssetSetting],
  )

  const resetAssetOverride = useCallback(
    (symbol: string) => {
      upsertAssetSetting(symbol, { auto: true })
    },
    [upsertAssetSetting],
  )

  const setTargetWeight = useCallback(
    (symbol: string, targetWeight?: number) => {
      upsertAssetSetting(symbol, { targetWeight })
    },
    [upsertAssetSetting],
  )

  /** 一次套用整組目標權重（等權重、市值權重、風險平價） */
  const applyTargetWeights = useCallback((weights: Record<string, number>) => {
    setAssetSettings((prev) => {
      const next = prev.map((setting) => {
        const key = setting.symbol.toUpperCase()
        return key in weights ? { ...setting, targetWeight: weights[key] } : setting
      })
      for (const [symbol, weight] of Object.entries(weights)) {
        if (!next.some((setting) => setting.symbol.toUpperCase() === symbol.toUpperCase())) {
          next.push({
            symbol: symbol.toUpperCase(),
            leverage: 1,
            assetClass: 'equity',
            auto: true,
            targetWeight: weight,
          })
        }
      }
      return next
    })
  }, [])

  const clearTargetWeights = useCallback(() => {
    setAssetSettings((prev) =>
      prev.map((setting) => ({ ...setting, targetWeight: undefined })),
    )
  }, [])

  const updateSettings = useCallback((patch: Partial<AllocationSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearAll = useCallback(() => {
    setTransactions([])
    setPrices([])
    setCashAccounts([])
    setAssetSettings([])
    setSettings(defaultAllocationSettings)
  }, [])

  const exportPortfolio = useCallback(() => exportData(), [])

  const importPortfolio = useCallback((json: string) => {
    const data = importData(json)
    setTransactions(data.transactions)
    setPrices(data.prices)
    setCashAccounts(data.cashAccounts)
    setAssetSettings(data.assetSettings)
    setSettings(data.allocationSettings)
  }, [])

  return {
    transactions,
    prices,
    holdings,
    summary,
    cashAccounts,
    assetSettings,
    settings,
    exposure,
    rebalance,
    cashRate,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updatePrice,
    updatePrices,
    addCashAccount,
    updateCashAccount,
    deleteCashAccount,
    setAssetOverride,
    resetAssetOverride,
    setTargetWeight,
    applyTargetWeights,
    clearTargetWeights,
    updateSettings,
    clearAll,
    exportPortfolio,
    importPortfolio,
  }
}
