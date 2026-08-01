import { ExternalLink } from 'lucide-react'
import { getGoodinfoUrl, getWantgooUrl } from '../services/stockQuote'

interface StockExternalLinksProps {
  symbol: string
  compact?: boolean
}

export function StockExternalLinks({ symbol, compact = false }: StockExternalLinksProps) {
  if (!symbol.trim()) return null

  const links = [
    { label: 'Goodinfo', href: getGoodinfoUrl(symbol) },
    { label: '玩股網', href: getWantgooUrl(symbol) },
  ]

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-1'}`}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-teal-300 hover:border-teal-500/50 hover:bg-teal-500/10"
          title={`在 ${link.label} 開啟 ${symbol}`}
        >
          {link.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  )
}
