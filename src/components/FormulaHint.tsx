import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, X } from 'lucide-react'

export interface FormulaHintProps {
  title: string
  formula: string
  note?: string
}

export function FormulaHint({ title, formula, note }: FormulaHintProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        className="-m-0.5 inline-flex shrink-0 rounded-full p-0.5 text-slate-500 transition hover:bg-slate-800 hover:text-teal-300"
        aria-label={`${title}的計算方式`}
        title="計算方式"
      >
        <CircleAlert className="h-3.5 w-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/50 sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <p id={titleId} className="text-sm font-semibold text-teal-200">
                  {title}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="-mr-1 -mt-1 rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                  aria-label="關閉"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 overflow-x-auto rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300">
                {formula}
              </p>
              {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
