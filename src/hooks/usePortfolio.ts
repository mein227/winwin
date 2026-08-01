import { useCallback, useEffect, useMemo, useState } from 'react'
import type { StockPrice, Transaction } from '../types'
import { calculateHoldings, calculateSummary } from '../utils/calculations'
import {
  exportData,
  importData,
  loadPrices,
  loadTransactions,
  savePrices,
  saveTransactions,
} from '../utils/storage'

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function usePortfolio() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions())
  const [prices, setPrices] = useState<StockPrice[]>(() => loadPrices())

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  useEffect(() => {
    savePrices(prices)
  }, [prices])

  const holdings = useMemo(
    () => calculateHoldings(transactions, prices),
    [transactions, prices],
  )

  const summary = useMemo(
    () => calculateSummary(transactions, holdings),
    [transactions, holdings],
  )

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

  const clearAll = useCallback(() => {
    setTransactions([])
    setPrices([])
  }, [])

  const exportPortfolio = useCallback(() => exportData(), [])

  const importPortfolio = useCallback((json: string) => {
    const data = importData(json)
    setTransactions(data.transactions)
    setPrices(data.prices)
  }, [])

  return {
    transactions,
    prices,
    holdings,
    summary,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updatePrice,
    updatePrices,
    clearAll,
    exportPortfolio,
    importPortfolio,
  }
}
