export interface StockMeta {
  symbol: string
  name: string
  market: 'twse' | 'tpex' | 'other'
  industry: string
}

export interface StockQuote {
  symbol: string
  name: string
  price: number
  open: number
  high: number
  low: number
  previousClose: number
  change: number
  changePercent: number
  volume: number
  date: string
  source: string
  industry?: string
  market?: string
}

const INFO_CACHE_KEY = 'winwin_stock_info_v1'
const INFO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000

type InfoCache = {
  updatedAt: number
  items: Record<string, StockMeta>
}

const quoteCache = new Map<string, { updatedAt: number; quote: StockQuote }>()

function todayMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function fetchFinMind<T>(params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params)
  const res = await fetch(`https://api.finmindtrade.com/api/v4/data?${qs.toString()}`)
  if (!res.ok) {
    throw new Error(`FinMind 連線失敗（HTTP ${res.status}）`)
  }
  const json = (await res.json()) as {
    msg?: string
    status?: number
    data?: T[]
  }
  if (json.status !== 200 || !Array.isArray(json.data)) {
    throw new Error(json.msg || 'FinMind 回傳資料異常')
  }
  return json.data
}

function loadInfoCache(): InfoCache | null {
  try {
    const raw = localStorage.getItem(INFO_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as InfoCache
    if (!parsed?.items || !parsed.updatedAt) return null
    if (Date.now() - parsed.updatedAt > INFO_CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function saveInfoCache(items: Record<string, StockMeta>) {
  const payload: InfoCache = { updatedAt: Date.now(), items }
  localStorage.setItem(INFO_CACHE_KEY, JSON.stringify(payload))
}

/** 載入／快取台股代號與名稱清單（FinMind） */
export async function getStockDirectory(): Promise<Record<string, StockMeta>> {
  const cached = loadInfoCache()
  if (cached) return cached.items

  type Row = {
    stock_id: string
    stock_name: string
    type: string
    industry_category: string
    date: string
  }

  const rows = await fetchFinMind<Row>({ dataset: 'TaiwanStockInfo' })
  const items: Record<string, StockMeta> = {}
  const dates: Record<string, string> = {}

  for (const row of rows) {
    const symbol = row.stock_id.trim().toUpperCase()
    const market =
      row.type === 'twse' ? 'twse' : row.type === 'tpex' ? 'tpex' : 'other'

    if (!dates[symbol] || row.date >= dates[symbol]) {
      dates[symbol] = row.date
      items[symbol] = {
        symbol,
        name: row.stock_name,
        market,
        industry: row.industry_category || '',
      }
    }
  }

  saveInfoCache(items)
  return items
}

export async function lookupStockMeta(symbol: string): Promise<StockMeta | null> {
  const key = symbol.trim().toUpperCase()
  if (!key) return null
  const dir = await getStockDirectory()
  return dir[key] ?? null
}

export function getGoodinfoUrl(symbol: string): string {
  return `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${encodeURIComponent(symbol)}`
}

export function getWantgooUrl(symbol: string): string {
  return `https://www.wantgoo.com/stock/${encodeURIComponent(symbol)}`
}

export function getTwseMisUrl(symbol: string, market: 'twse' | 'tpex' | 'other' = 'twse'): string {
  const ex = market === 'tpex' ? 'otc' : 'tse'
  return `https://mis.twse.com.tw/stock/fibest.jsp?stock=${encodeURIComponent(symbol)}&ex=${ex}`
}

/** 取得單一股票最新收盤／行情 */
export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const key = symbol.trim().toUpperCase()
  if (!key) throw new Error('請輸入股票代號')

  const cached = quoteCache.get(key)
  if (cached && Date.now() - cached.updatedAt < QUOTE_CACHE_TTL_MS) {
    return cached.quote
  }

  const meta = await lookupStockMeta(key)

  type PriceRow = {
    date: string
    stock_id: string
    open: number
    max: number
    min: number
    close: number
    spread: number
    Trading_Volume: number
  }

  const rows = await fetchFinMind<PriceRow>({
    dataset: 'TaiwanStockPrice',
    data_id: key,
    start_date: todayMinusDays(14),
  })

  if (rows.length === 0) {
    throw new Error(`找不到 ${key} 的股價資料`)
  }

  const latest = rows[rows.length - 1]
  const prev = rows.length > 1 ? rows[rows.length - 2] : null
  const previousClose = prev?.close ?? latest.close - (latest.spread || 0)
  const change = latest.close - previousClose
  const changePercent = previousClose ? (change / previousClose) * 100 : 0

  const quote: StockQuote = {
    symbol: key,
    name: meta?.name || key,
    price: latest.close,
    open: latest.open,
    high: latest.max,
    low: latest.min,
    previousClose,
    change,
    changePercent,
    volume: latest.Trading_Volume,
    date: latest.date,
    source: 'FinMind / 證交所公開資料',
    industry: meta?.industry,
    market: meta?.market,
  }

  quoteCache.set(key, { updatedAt: Date.now(), quote })
  return quote
}

/** 批次查詢（限制並行，避免打爆免費額度） */
export async function fetchStockQuotes(
  symbols: string[],
  concurrency = 3,
): Promise<{ quotes: StockQuote[]; errors: { symbol: string; message: string }[] }> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const quotes: StockQuote[] = []
  const errors: { symbol: string; message: string }[] = []

  let index = 0
  async function worker() {
    while (index < unique.length) {
      const current = unique[index++]
      try {
        quotes.push(await fetchStockQuote(current))
      } catch (err) {
        errors.push({
          symbol: current,
          message: err instanceof Error ? err.message : '查詢失敗',
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()))
  return { quotes, errors }
}

export function searchStockDirectory(
  directory: Record<string, StockMeta>,
  query: string,
  limit = 8,
): StockMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const exact: StockMeta[] = []
  const starts: StockMeta[] = []
  const contains: StockMeta[] = []

  for (const meta of Object.values(directory)) {
    const symbol = meta.symbol.toLowerCase()
    const name = meta.name.toLowerCase()
    if (symbol === q || name === q) exact.push(meta)
    else if (symbol.startsWith(q) || name.startsWith(q)) starts.push(meta)
    else if (symbol.includes(q) || name.includes(q)) contains.push(meta)
  }

  return [...exact, ...starts, ...contains].slice(0, limit)
}
