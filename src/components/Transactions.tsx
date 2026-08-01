import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Transaction } from '../types'
import { formatCurrency, formatNumber } from '../utils/calculations'
import { TransactionForm } from './TransactionForm'

interface TransactionsProps {
  transactions: Transaction[]
  onAdd: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void
  onUpdate: (id: string, patch: Partial<Transaction>) => void
  onDelete: (id: string) => void
}

export function Transactions({
  transactions,
  onAdd,
  onUpdate,
  onDelete,
}: TransactionsProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all')

  const knownSymbols = useMemo(() => {
    const map = new Map<string, string>()
    for (const tx of transactions) {
      map.set(tx.symbol, tx.name)
    }
    return [...map.entries()].map(([symbol, name]) => ({ symbol, name }))
  }, [transactions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...transactions]
      .filter((tx) => (filter === 'all' ? true : tx.type === filter))
      .filter((tx) =>
        !q
          ? true
          : tx.symbol.toLowerCase().includes(q) ||
            tx.name.toLowerCase().includes(q) ||
            (tx.note ?? '').toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.createdAt.localeCompare(a.createdAt),
      )
  }, [transactions, query, filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">進出紀錄</h2>
          <p className="mt-1 text-sm text-slate-400">記錄每筆買進／賣出，自動計算成本與獲利</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400"
        >
          <Plus className="h-4 w-4" />
          新增進出
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋代號、名稱或備註"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-white outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {(
            [
              ['all', '全部'],
              ['buy', '買進'],
              ['sell', '賣出'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-2 text-sm ${
                filter === key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-500">
            {transactions.length === 0 ? '尚無進出紀錄，點右上角新增第一筆' : '找不到符合的紀錄'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">類型</th>
                  <th className="px-4 py-3 font-medium">股票</th>
                  <th className="px-4 py-3 font-medium text-right">價格</th>
                  <th className="px-4 py-3 font-medium text-right">股數</th>
                  <th className="px-4 py-3 font-medium text-right">金額</th>
                  <th className="px-4 py-3 font-medium text-right">費用</th>
                  <th className="px-4 py-3 font-medium">備註</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const amount = tx.price * tx.shares
                  const fees = tx.fee + tx.tax
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                        {format(parseISO(tx.date), 'yyyy/MM/dd')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            tx.type === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {tx.type === 'buy' ? '買進' : '賣出'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{tx.symbol}</div>
                        <div className="text-xs text-slate-500">{tx.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatNumber(tx.price)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatNumber(tx.shares, 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {formatCurrency(amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {formatCurrency(fees)}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-slate-500">
                        {tx.note || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(tx)
                              setOpen(true)
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-teal-300"
                            title="編輯"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('確定刪除此筆紀錄？')) onDelete(tx.id)
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionForm
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        knownSymbols={knownSymbols}
        initial={editing}
        onSubmit={(tx) => {
          if (editing) {
            onUpdate(editing.id, tx)
          } else {
            onAdd(tx)
          }
        }}
      />
    </div>
  )
}
