import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Transaction, TransactionType } from '../types'
import { suggestFee, suggestTax } from '../utils/calculations'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void
  initial?: Transaction | null
  knownSymbols?: { symbol: string; name: string }[]
}

const emptyForm = {
  symbol: '',
  name: '',
  type: 'buy' as TransactionType,
  price: '',
  shares: '',
  fee: '',
  tax: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
  autoFee: true,
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  initial,
  knownSymbols = [],
}: TransactionFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        symbol: initial.symbol,
        name: initial.name,
        type: initial.type,
        price: String(initial.price),
        shares: String(initial.shares),
        fee: String(initial.fee),
        tax: String(initial.tax),
        date: initial.date.slice(0, 10),
        note: initial.note ?? '',
        autoFee: false,
      })
    } else {
      setForm(emptyForm)
    }
    setError('')
  }, [open, initial])

  const price = Number(form.price) || 0
  const shares = Number(form.shares) || 0

  const suggested = useMemo(() => {
    return {
      fee: suggestFee(price, shares),
      tax: suggestTax(price, shares, form.type),
    }
  }, [price, shares, form.type])

  useEffect(() => {
    if (!form.autoFee) return
    setForm((prev) => ({
      ...prev,
      fee: price > 0 && shares > 0 ? String(suggested.fee) : '',
      tax: price > 0 && shares > 0 ? String(suggested.tax) : '',
    }))
  }, [suggested.fee, suggested.tax, form.autoFee, price, shares])

  if (!open) return null

  const handleSymbolBlur = () => {
    const found = knownSymbols.find(
      (s) => s.symbol.toUpperCase() === form.symbol.trim().toUpperCase(),
    )
    if (found && !form.name) {
      setForm((prev) => ({ ...prev, name: found.name }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = form.symbol.trim().toUpperCase()
    const name = form.name.trim()
    const p = Number(form.price)
    const s = Number(form.shares)
    const fee = Number(form.fee) || 0
    const tax = Number(form.tax) || 0

    if (!symbol || !name) {
      setError('請填寫股票代號與名稱')
      return
    }
    if (!(p > 0) || !(s > 0)) {
      setError('價格與股數必須大於 0')
      return
    }
    if (!form.date) {
      setError('請選擇交易日期')
      return
    }

    onSubmit({
      symbol,
      name,
      type: form.type,
      price: p,
      shares: s,
      fee,
      tax: form.type === 'buy' ? 0 : tax,
      date: form.date,
      note: form.note.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">
            {initial ? '編輯進出紀錄' : '新增進出紀錄'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
            {(['buy', 'sell'] as TransactionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type, autoFee: true }))}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  form.type === type
                    ? type === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'buy' ? '買進' : '賣出'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">股票代號</span>
              <input
                list="symbol-list"
                value={form.symbol}
                onChange={(e) => setForm((prev) => ({ ...prev, symbol: e.target.value }))}
                onBlur={handleSymbolBlur}
                placeholder="例如 2330"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
              <datalist id="symbol-list">
                {knownSymbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">股票名稱</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="例如 台積電"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">成交價格</span>
              <input
                type="number"
                step="any"
                min="0"
                value={form.price}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, price: e.target.value, autoFee: true }))
                }
                placeholder="0"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">股數</span>
              <input
                type="number"
                step="any"
                min="0"
                value={form.shares}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, shares: e.target.value, autoFee: true }))
                }
                placeholder="1000"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">手續費</span>
              <input
                type="number"
                step="any"
                min="0"
                value={form.fee}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fee: e.target.value, autoFee: false }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">證交稅（賣出）</span>
              <input
                type="number"
                step="any"
                min="0"
                disabled={form.type === 'buy'}
                value={form.type === 'buy' ? '0' : form.tax}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tax: e.target.value, autoFee: false }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500 disabled:opacity-50"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">交易日期</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm text-slate-400">備註（選填）</span>
            <input
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="例如：定期定額、獲利了結"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-teal-500"
            />
          </label>

          {price > 0 && shares > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-300">
              成交金額{' '}
              <span className="font-semibold text-white">
                {(price * shares).toLocaleString('zh-TW')}
              </span>
              {form.type === 'buy' ? (
                <>
                  {' '}
                  · 含費成本{' '}
                  <span className="font-semibold text-emerald-300">
                    {(price * shares + (Number(form.fee) || 0)).toLocaleString('zh-TW')}
                  </span>
                </>
              ) : (
                <>
                  {' '}
                  · 實收{' '}
                  <span className="font-semibold text-amber-300">
                    {(
                      price * shares -
                      (Number(form.fee) || 0) -
                      (Number(form.tax) || 0)
                    ).toLocaleString('zh-TW')}
                  </span>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-slate-300 hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:from-teal-400 hover:to-cyan-400"
            >
              {initial ? '儲存變更' : '新增紀錄'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
