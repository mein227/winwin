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

export interface PriceHistory {
  symbol: string
  name: string
  dates: string[]
  closes: number[]
}

export interface DailyBars {
  symbol: string
  name: string
  dates: string[]
  /** 未還原的收盤價，與交易紀錄的成交價同一基準 */
  closes: number[]
  /** 交易所公布的漲跌價差，用於還原分割當日的真實報酬 */
  spreads: number[]
}

const INFO_CACHE_KEY = 'winwin_stock_info_v1'
const HISTORY_CACHE_KEY = 'winwin_price_history_v3'
const BARS_CACHE_KEY = 'winwin_daily_bars_v1'
const INFO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000
const HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000
/** 日 K 線快取較短，讓使用者瀏覽時能拿到當日最新收盤 */
export const BARS_CACHE_TTL_MS = 10 * 60 * 1000

/** 風險分析預設的基準指數（元大台灣 50） */
export const BENCHMARK_SYMBOL = '0050'

/** 台股發行量加權股價指數，FinMind 以 TaiwanStockPrice 的 TAIEX 提供 */
export const MARKET_INDEX_SYMBOL = 'TAIEX'

/** 指數不在 TaiwanStockInfo 個股清單內，名稱另行對應 */
const INDEX_NAMES: Record<string, string> = {
  TAIEX: '加權指數',
  TPEX: '櫃買指數',
}

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

  const indexName = INDEX_NAMES[key]
  const meta = indexName ? null : await lookupStockMeta(key)

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
  // 交易所 spread 是相對當日參考價的正式漲跌，可正確處理除權息與分割。
  // 直接拿前一日未調整收盤相減，會在公司行動日製造巨額假損益。
  const hasSpread = Number.isFinite(latest.spread)
  const previousClose = hasSpread
    ? latest.close - latest.spread
    : (prev?.close ?? latest.close)
  const change = hasSpread ? latest.spread : latest.close - previousClose
  const changePercent = previousClose ? (change / previousClose) * 100 : 0

  const quote: StockQuote = {
    symbol: key,
    name: indexName || meta?.name || key,
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

type BarsCache = Record<
  string,
  {
    updatedAt: number
    days: number
    name: string
    dates: string[]
    closes: number[]
    spreads: number[]
  }
>

function loadBarsCache(): BarsCache {
  try {
    const raw = localStorage.getItem(BARS_CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as BarsCache
  } catch {
    return {}
  }
}

function saveBarsCache(cache: BarsCache) {
  try {
    localStorage.setItem(BARS_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* 容量不足時忽略快取 */
  }
}

/**
 * 取得未還原的日收盤價序列，用於計算每日損益。
 *
 * 風險分析用的 `fetchPriceHistory` 會把股利加回來還原總報酬，價格基準會偏離實際成交價；
 * 損益計算必須與交易紀錄同基準，因此這裡保留原始收盤價，另外帶回 spread 以還原分割。
 */
export async function fetchDailyBars(
  symbol: string,
  days = 365,
  force = false,
): Promise<DailyBars> {
  const key = symbol.trim().toUpperCase()
  if (!key) throw new Error('請輸入股票代號')

  const cache = loadBarsCache()
  const cached = cache[key]
  if (
    !force &&
    cached &&
    cached.days >= days &&
    cached.dates.length > 0 &&
    Date.now() - cached.updatedAt < BARS_CACHE_TTL_MS
  ) {
    return {
      symbol: key,
      name: cached.name || key,
      dates: cached.dates,
      closes: cached.closes,
      spreads: cached.spreads ?? cached.dates.map(() => 0),
    }
  }

  type PriceRow = { date: string; close: number; spread: number }

  const rows = await fetchFinMind<PriceRow>({
    dataset: 'TaiwanStockPrice',
    data_id: key,
    start_date: todayMinusDays(days),
  })

  const valid = rows
    .filter((row) => row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (valid.length === 0) {
    throw new Error(`找不到 ${key} 的股價資料`)
  }

  const meta = await lookupStockMeta(key).catch(() => null)
  const bars: DailyBars = {
    symbol: key,
    name: meta?.name || cached?.name || key,
    dates: valid.map((row) => row.date),
    closes: valid.map((row) => row.close),
    spreads: valid.map((row) => row.spread ?? 0),
  }

  cache[key] = {
    updatedAt: Date.now(),
    days,
    name: bars.name,
    dates: bars.dates,
    closes: bars.closes,
    spreads: bars.spreads,
  }
  saveBarsCache(cache)

  return bars
}

/** 批次取得日 K 線（限制並行避免超出免費額度） */
export async function fetchDailyBarsBatch(
  symbols: string[],
  days = 365,
  options: { force?: boolean; concurrency?: number } = {},
): Promise<{ bars: DailyBars[]; errors: { symbol: string; message: string }[] }> {
  const { force = false, concurrency = 2 } = options
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const bars: DailyBars[] = []
  const errors: { symbol: string; message: string }[] = []

  let index = 0
  async function worker() {
    while (index < unique.length) {
      const current = unique[index++]
      try {
        bars.push(await fetchDailyBars(current, days, force))
      } catch (err) {
        errors.push({
          symbol: current,
          message: err instanceof Error ? err.message : '查詢失敗',
        })
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()),
  )
  return { bars, errors }
}

type HistoryCache = Record<
  string,
  { updatedAt: number; days: number; dates: string[]; closes: number[]; name: string }
>

function loadHistoryCache(): HistoryCache {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as HistoryCache
  } catch {
    return {}
  }
}

function saveHistoryCache(cache: HistoryCache) {
  try {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* 容量不足時忽略快取 */
  }
}

export interface DividendEvent {
  /** 除權息交易日 */
  exDate: string
  /** 每股現金股利（元） */
  cash: number
  /** 每股股票股利（元，10 元面額；1 元 = 配股率 10%） */
  stock: number
}

/** 超過此單日跌幅視為分割、減資等股本變動，而非真實報酬 */
export const CORPORATE_ACTION_THRESHOLD = 0.35

/**
 * 還原連續的總報酬價格序列。
 *
 * FinMind 免費方案只提供未調整收盤價，會有兩種失真：
 * 1. 分割／減資：00631L 於 2026-03-31 由 443 元變成 19 元，直接相除會得到 -96% 假跌幅。
 *    此時改用交易所的漲跌價差 spread（相對前一日參考價）還原，r = spread ÷ (收盤 − spread)。
 * 2. 除權息：股價自然扣除股利，會低估報酬（0056 這類高股息 ETF 影響尤其大）。
 *    因此把當日現金股利加回、股票股利以配股率放大後再計算報酬。
 */
export function buildAdjustedCloses(
  rows: { date: string; close: number; spread?: number }[],
  dividends: DividendEvent[] = [],
): { dates: string[]; closes: number[] } {
  const dividendMap = new Map(dividends.map((event) => [event.exDate, event]))
  const dates: string[] = []
  const closes: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (i === 0) {
      dates.push(row.date)
      closes.push(row.close)
      continue
    }

    const previous = rows[i - 1].close
    const priceChange = previous > 0 ? row.close / previous - 1 : 0
    let growth = 1

    if (Math.abs(priceChange) > CORPORATE_ACTION_THRESHOLD) {
      const reference =
        typeof row.spread === 'number' ? row.close - row.spread : NaN
      growth = Number.isFinite(reference) && reference > 0 ? row.close / reference : 1
    } else if (previous > 0) {
      const event = dividendMap.get(row.date)
      const stockRatio = event ? event.stock / 10 : 0
      const cash = event ? event.cash : 0
      growth = (row.close * (1 + stockRatio) + cash) / previous
    }

    dates.push(row.date)
    closes.push(closes[i - 1] * growth)
  }

  return { dates, closes }
}

/** 取得現金與股票股利事件（用於還原總報酬） */
export async function fetchDividends(
  symbol: string,
  startDate: string,
): Promise<DividendEvent[]> {
  type DividendRow = {
    CashEarningsDistribution: number
    CashStatutorySurplus: number
    CashExDividendTradingDate: string
    StockEarningsDistribution: number
    StockStatutorySurplus: number
    StockExDividendTradingDate: string
  }

  const rows = await fetchFinMind<DividendRow>({
    dataset: 'TaiwanStockDividend',
    data_id: symbol,
    start_date: startDate,
  })

  const events = new Map<string, DividendEvent>()

  function add(exDate: string, cash: number, stock: number) {
    if (!exDate || (cash === 0 && stock === 0)) return
    const existing = events.get(exDate) ?? { exDate, cash: 0, stock: 0 }
    existing.cash += cash
    existing.stock += stock
    events.set(exDate, existing)
  }

  for (const row of rows) {
    const cash =
      (row.CashEarningsDistribution || 0) + (row.CashStatutorySurplus || 0)
    const stock =
      (row.StockEarningsDistribution || 0) + (row.StockStatutorySurplus || 0)
    add(row.CashExDividendTradingDate, cash, 0)
    add(row.StockExDividendTradingDate, 0, stock)
  }

  return [...events.values()]
}

/** 取得還原後的日收盤價序列，用於計算波動度、Beta 與相關性 */
export async function fetchPriceHistory(symbol: string, days = 365): Promise<PriceHistory> {
  const key = symbol.trim().toUpperCase()
  if (!key) throw new Error('請輸入股票代號')

  const cache = loadHistoryCache()
  const cached = cache[key]
  if (
    cached &&
    cached.days >= days &&
    Date.now() - cached.updatedAt < HISTORY_CACHE_TTL_MS &&
    cached.dates.length > 0
  ) {
    return {
      symbol: key,
      name: cached.name || key,
      dates: cached.dates,
      closes: cached.closes,
    }
  }

  type PriceRow = { date: string; close: number; spread: number }

  const startDate = todayMinusDays(days)
  const rows = await fetchFinMind<PriceRow>({
    dataset: 'TaiwanStockPrice',
    data_id: key,
    start_date: startDate,
  })

  const valid = rows
    .filter((row) => row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (valid.length < 3) {
    throw new Error(`${key} 的歷史股價不足，無法計算風險指標`)
  }

  const meta = await lookupStockMeta(key).catch(() => null)
  // 股利查詢失敗時仍可用價格報酬計算，只是會略微低估報酬
  const dividends = await fetchDividends(key, startDate).catch(() => [])
  const adjusted = buildAdjustedCloses(valid, dividends)
  const history: PriceHistory = {
    symbol: key,
    name: meta?.name || key,
    dates: adjusted.dates,
    closes: adjusted.closes,
  }

  cache[key] = {
    updatedAt: Date.now(),
    days,
    name: history.name,
    dates: history.dates,
    closes: history.closes,
  }
  saveHistoryCache(cache)

  return history
}

/** 批次取得歷史股價（限制並行避免超出免費額度） */
export async function fetchPriceHistories(
  symbols: string[],
  days = 365,
  concurrency = 2,
): Promise<{
  histories: PriceHistory[]
  errors: { symbol: string; message: string }[]
}> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const histories: PriceHistory[] = []
  const errors: { symbol: string; message: string }[] = []

  let index = 0
  async function worker() {
    while (index < unique.length) {
      const current = unique[index++]
      try {
        histories.push(await fetchPriceHistory(current, days))
      } catch (err) {
        errors.push({
          symbol: current,
          message: err instanceof Error ? err.message : '查詢失敗',
        })
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()),
  )
  return { histories, errors }
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
