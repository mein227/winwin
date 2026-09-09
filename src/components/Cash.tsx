import { useState } from 'react'
import {
  Banknote,
  ChevronDown,
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
import { FormulaHint } from './FormulaHint'

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
  // 新增表單平常不必一直佔畫面，手機先收起來，桌機維持展開
  const [formOpen, setFormOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640,
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
  }

  const startEdit = (account: CashAccount) => {
    setEditingId(account.id)
    setFormOpen(true)
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
    if (!Number.isFinite(amount)) {
      setError('請填寫有效金額')
      return
    }
    if (form.type === 'debt' && amount < 0) {
      setError('負債金額請填正數（系統會以負值計入淨值）')
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:block">
        <h2 className="text-lg font-bold text-white sm:text-2xl">現金資產</h2>
        <p className="text-xs text-slate-400 sm:mt-1 sm:text-sm">
          記錄手上現金、交割戶餘額與負債；進出紀錄的買賣會連動帳戶餘額，負數以紅色標示
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/20 to-teal-500/5 p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
            <Banknote className="h-4 w-4" /> 現金資產
          </p>
          <p
            className={`mt-1 text-lg font-bold sm:mt-2 sm:text-2xl ${
              summary.cashAsset < 0 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {formatCurrency(summary.cashAsset)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            {assets.length} 個帳戶
          </p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
            <TrendingDown className="h-4 w-4" /> 負債
          </p>
          <p className="mt-1 text-lg font-bold text-rose-300 sm:mt-2 sm:text-2xl">
            {formatCurrency(summary.debtValue)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            {debts.length} 筆借款
          </p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/20 to-sky-500/5 p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
            <Coins className="h-4 w-4" /> 淨現金
            <FormulaHint
              title="淨現金"
              formula="淨現金 = 現金資產合計 − 負債合計"
              note="融資、質借、信貸都算負債，會放大實際曝險"
            />
          </p>
          <p
            className={`mt-1 text-lg font-bold sm:mt-2 sm:text-2xl ${pnlClass(summary.netCash)}`}
          >
            {formatCurrency(summary.netCash)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            加權利率 {formatNumber(cashRate, 2)}%
            <FormulaHint
              title="現金加權利率"
              formula="加權利率 = Σ(金額 × 利率) ÷ Σ金額（負債利率以負值計）"
            />
          </p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
            <Wallet className="h-4 w-4" /> 現金比重
            <FormulaHint
              title="現金比重"
              formula="現金比重 = 淨現金 ÷ 總淨值 × 100%"
              note="現金比重越高，短期波動越小，但長期報酬也會被稀釋（現金拖累）"
            />
          </p>
          <p className="mt-1 text-lg font-bold text-violet-200 sm:mt-2 sm:text-2xl">
            {formatNumber(summary.cashRatio, 1)}%
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-slate-500 sm:mt-1 sm:text-xs">
            總淨值 {formatCurrency(summary.netWorth)}
            <FormulaHint
              title="總淨值"
              formula="總淨值 = 持股市值合計 + 淨現金"
              note="所有配置比重、曝險比率、配置藍圖都以總淨值為分母"
            />
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5">
        <h3 className="mb-2 text-sm font-semibold text-white sm:mb-3 sm:text-base">資產結構</h3>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800 sm:h-4">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
            style={{ width: `${Math.max(Math.min(stockRatio, 100), 0)}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-violet-500"
            style={{ width: `${Math.max(Math.min(summary.cashRatio, 100), 0)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:mt-3 sm:gap-4 sm:text-sm">
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
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFormOpen((prev) => !prev)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          >
            <h3 className="text-sm font-semibold text-white sm:text-base">
              {editingId ? '編輯帳戶' : '新增現金／負債帳戶'}
            </h3>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition ${formOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white sm:text-sm"
            >
              <X className="h-4 w-4" />
              取消編輯
            </button>
          )}
        </div>

        {formOpen && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-4 lg:grid-cols-5">
              <label className="col-span-2 block space-y-1 sm:space-y-1.5 lg:col-span-2">
                <span className="text-xs text-slate-400 sm:text-sm">帳戶名稱</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：台銀活存、元大交割戶"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-white outline-none focus:border-teal-500 sm:py-2.5"
                />
              </label>
              <label className="block space-y-1 sm:space-y-1.5">
                <span className="text-xs text-slate-400 sm:text-sm">類型</span>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value as CashAccountType }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-white outline-none focus:border-teal-500 sm:py-2.5"
                >
                  {cashTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {cashTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 sm:space-y-1.5">
                <span className="text-xs text-slate-400 sm:text-sm">金額</span>
                <input
                  type="number"
                  step="any"
                  min={form.type === 'debt' ? '0' : undefined}
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-white outline-none focus:border-teal-500 sm:py-2.5"
                />
              </label>
              <label className="col-span-2 block space-y-1 sm:col-span-1 sm:space-y-1.5">
                <span className="text-xs text-slate-400 sm:text-sm">年利率 %（選填）</span>
                <input
                  type="number"
                  step="any"
                  value={form.interestRate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, interestRate: e.target.value }))
                  }
                  placeholder="1.6"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-white outline-none focus:border-teal-500 sm:py-2.5"
                />
              </label>
            </div>

            <div className="mt-2.5 grid gap-2.5 sm:mt-4 sm:grid-cols-[1fr_auto] sm:gap-4">
              <label className="block space-y-1 sm:space-y-1.5">
                <span className="text-xs text-slate-400 sm:text-sm">備註（選填）</span>
                <input
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="例如：緊急預備金、待進場資金"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-white outline-none focus:border-teal-500 sm:py-2.5"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400 sm:w-auto sm:py-2.5 sm:text-base"
                >
                  <Plus className="h-4 w-4" />
                  {editingId ? '儲存變更' : '新增帳戶'}
                </button>
              </div>
            </div>

            {error && <p className="mt-2 text-xs text-rose-400 sm:mt-3 sm:text-sm">{error}</p>}
            <p className="mt-2 text-[0.6875rem] text-slate-500 sm:mt-3 sm:text-xs">
              融資、股票質借、信貸請選擇「負債」類型並填正數金額，系統會自動以負值計入淨值與曝險。進出紀錄的買進／賣出會連動此處帳戶餘額，餘額為負時會以紅色標示。
            </p>
          </>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-3 py-2 sm:px-4 sm:py-3">
          <h3 className="text-sm font-semibold text-white sm:text-base">帳戶明細</h3>
        </div>
        {cashAccounts.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-500">
            尚未新增現金帳戶，先記錄手上現金才能完整計算資產配置
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {cashAccounts.map((account) => {
              const isDebt = account.type === 'debt'
              const isNegativeAsset = !isDebt && account.amount < 0
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5"
                >
                  <div
                    className={`shrink-0 rounded-lg p-1.5 sm:rounded-xl sm:p-2 ${
                      isDebt || isNegativeAsset
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-teal-500/15 text-teal-300'
                    }`}
                  >
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white sm:text-base">
                      {account.name}
                    </p>
                    <p className="truncate text-[0.6875rem] text-slate-500 sm:text-xs">
                      {cashTypeLabel(account.type)}
                      {account.interestRate !== undefined &&
                        ` · 年利率 ${formatNumber(account.interestRate, 2)}%`}
                      {account.note && ` · ${account.note}`}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold sm:text-lg ${
                      isDebt || isNegativeAsset ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {isDebt
                      ? `-${formatCurrency(Math.abs(account.amount))}`
                      : formatCurrency(account.amount)}
                  </p>
                  <div className="flex shrink-0 gap-0.5 sm:gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(account)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-teal-300 sm:p-2"
                      title="編輯"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            '確定刪除此帳戶？已連動的進出紀錄會改為未指定帳戶。',
                          )
                        ) {
                          onDelete(account.id)
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 sm:p-2"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
