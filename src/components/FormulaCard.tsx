import { useState } from 'react'
import { ChevronDown, FunctionSquare } from 'lucide-react'

interface FormulaCardProps {
  title?: string
  items: { label: string; formula: string; note?: string }[]
  defaultOpen?: boolean
}

export function FormulaCard({
  title = '計算方式',
  items,
  defaultOpen = false,
}: FormulaCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FunctionSquare className="h-4 w-4 text-teal-300" />
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-4">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-sm font-medium text-teal-200">{item.label}</p>
              <p className="mt-1 overflow-x-auto rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300">
                {item.formula}
              </p>
              {item.note && <p className="mt-1 text-xs text-slate-500">{item.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
