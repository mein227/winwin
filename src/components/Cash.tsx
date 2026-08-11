import { useState } from 'react'
import {
  Banknote,
  Coins,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react'
import type { CashAccount, CashAccountType, ExposureSummary } from '../types'
import { formatCurrency, formatNumber, pnlClass } from '../utils/calculations'
import { cashTypeLabel, cashTypeOptions } from '../utils/exposure'
import { FormulaCard } from './FormulaCard'

interface CashProps {
  cashAccounts: CashAccount[]
  summary: ExposureSummary
  cashRate: number
  onAdd: (account: Omit<CashAccount, 'id' | 'updatedAt'>) => void
  onUpdate: (id: string, patch: Partial<CashAccount>) => void
  onDelete: (id: string) => void
}

const emptyForm = {
  name: '',
  type: 'bank' as CashAccountType,
  amount: '',
  interestRate: '',
  note: '',
}

export function Cash({
  cashAccounts,
  summary,
  cashRate,
  onAdd,
  onUpdate,
  onDelete,
}: CashProps) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
  }

  const startEdit = (account: CashAccount) => {
    setEditingId(account.id)
    setError('')
    setForm({
      name: account.name,
      type: account.type,
      amount: String(account.amount),
      interestRate: account.interestRate === undefined ? '' : String(account.interestRate),
      note: account.note ?? '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.name.trim()) {
      setError('請填寫帳戶名稱')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('金額必須為 0 或正數（負債請選擇「負債」類型）')
      return
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      amount,
      interestRate: form.interestRate === '' ? undefined : Number(form.interestRate),
      note: form.note.trim() || undefined,
    }

    if (editingId) onUpdate(editingId, payload)
    else onAdd(payload)
    resetForm()
  }

  const assets = cashAccounts.filter((account) => account.type !== 'debt')
  const debts = cashAccounts.filter((account) => account.type === 'debt')
  const stockRatio = summary.netWorth > 0 ? (summary.stockValue / summary.netWorth) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">現金資產</h2>
        <p className="mt-1 text-sm text-slate-400">
          記錄手上現金、交割戶餘額與負債，才能算出真正的總淨值、現金比重與曝險倍數
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/20 to-teal-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Banknote className="h-4 w-4" /> 現金資產
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(summary.cashAsset)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{assets.length} 個帳戶</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <TrendingDown className="h-4 w-4" /> 負債
          </p>
          <p className="mt-2 text-2xl font-bold text-rose-300">
            {formatCurrency(summary.debtValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{debts.length} 筆借款</p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/20 to-sky-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Coins className="h-4 w-4" /> 淨現金
          </p>
          <p className={`mt-2 text-2xl font-bold ${pnlClass(summary.netCash)}`}>
            {formatCurrency(summary.netCash)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            加權利率 {formatNumber(cashRate, 2)}%
          </p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Wallet className="h-4 w-4" /> 現金比重
          </p>
          <p className="mt-2 text-2xl font-bold text-violet-200">
            {formatNumber(summary.cashRatio, 1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            總淨值 {formatCurrency(summary.netWorth)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="mb-3 text-base font-semibold text-white">資產結構</h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
            style={{ width: `${Math.max(Math.min(stockRatio, 100), 0)}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-violet-500"
            style={{ width: `${Math.max(Math.min(summary.cashRatio, 100), 0)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-400" />
            股票市值 {formatCurrency(summary.stockValue)}（{formatNumber(stockRatio, 1)}%）
          </span>
          <span className="text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-400" />
            淨現金 {formatCurrency(summary.netCash)}（{formatNumber(summary.cashRatio, 1)}%）
          </span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">
            {editingId ? '編輯帳戶' : '新增現金／負債帳戶'}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
              取消編輯
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block space-y-1.5 lg:col-span-2">
            <span className="text-sm text-slate-400">帳戶名稱</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：台銀活存、元大交割戶"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">類型</span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value as CashAccountType }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            >
              {cashTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {cashTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">金額</span>
            <input
              type="number"
              step="any"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">年利率 %（選填）</span>
            <input
              type="number"
              step="any"
              value={form.interestRate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, interestRate: e.target.value }))
              }
              placeholder="1.6"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">備註（選填）</span>
            <input
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="例如：緊急預備金、待進場資金"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {editingId ? '儲存變更' : '新增帳戶'}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <p className="mt-3 text-xs text-slate-500">
          融資、股票質借、信貸請選擇「負債」類型並填正數金額，系統會自動以負值計入淨值與曝險
        </p>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="font-semibold text-white">帳戶明細</h3>
        </div>
        {cashAccounts.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-500">
            尚未新增現金帳戶，先記錄手上現金才能完整計算資產配置
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {cashAccounts.map((account) => {
              const isDebt = account.type === 'debt'
              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-xl p-2 ${
                        isDebt
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-teal-500/15 text-teal-300'
                      }`}
                    >
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{account.name}</p>
                      <p className="text-xs text-slate-500">
                        {cashTypeLabel(account.type)}
                        {account.interestRate !== undefined &&
                          ` · 年利率 ${formatNumber(account.interestRate, 2)}%`}
                        {account.note && ` · ${account.note}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p
                      className={`text-lg font-semibold ${
                        isDebt ? 'text-rose-300' : 'text-white'
                      }`}
                    >
                      {isDebt ? '-' : ''}
                      {formatCurrency(Math.abs(account.amount))}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(account)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-teal-300"
                        title="編輯"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(account.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                        title="刪除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <FormulaCard
        items={[
          {
            label: '淨現金',
            formula: '淨現金 = 現金資產合計 − 負債合計',
            note: '融資、質借、信貸都算負債，會放大實際曝險',
          },
          {
            label: '總淨值',
            formula: '總淨值 = 持股市值合計 + 淨現金',
            note: '所有配置比重、曝險比率、再平衡都以總淨值為分母',
          },
          {
            label: '現金比重',
            formula: '現金比重 = 淨現金 ÷ 總淨值 × 100%',
            note: '現金比重越高，短期波動越小，但長期報酬也會被稀釋（現金拖累）',
          },
          {
            label: '現金加權利率',
            formula: '加權利率 = Σ(金額 × 利率) ÷ Σ金額（負債利率以負值計）',
          },
        ]}
      />
    </div>
  )
}
