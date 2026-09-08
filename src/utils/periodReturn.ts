/** 個股的近期漲幅（%），資料不足時為 null */
export interface PeriodReturns {
  /** 最近一個交易日漲跌幅 */
  day: number | null
  day5: number | null
  day20: number | null
  /** 今年以來：相對去年最後一個交易日收盤 */
  ytd: number | null
  /** 資料對應的最後交易日 */
  date: string
}

const EMPTY: PeriodReturns = {
  day: null,
  day5: null,
  day20: null,
  ytd: null,
  date: '',
}

/**
 * 由收盤價序列算出各期間漲幅。
 *
 * closes 必須是已還原分割／減資的序列（`buildAdjustedCloses`），
 * 否則 00631L 這類分割標的會出現 −90% 的假跌幅。
 */
export function calcPeriodReturns(dates: string[], closes: number[]): PeriodReturns {
  const size = Math.min(dates.length, closes.length)
  if (size === 0) return EMPTY

  const lastIndex = size - 1
  const last = closes[lastIndex]
  if (!(last > 0)) return EMPTY

  const growthFrom = (index: number): number | null => {
    if (index < 0) return null
    const base = closes[index]
    if (!(base > 0)) return null
    return (last / base - 1) * 100
  }

  const yearPrefix = dates[lastIndex].slice(0, 4)
  let lastYearIndex = -1
  for (let i = lastIndex; i >= 0; i--) {
    if (dates[i].slice(0, 4) < yearPrefix) {
      lastYearIndex = i
      break
    }
  }

  return {
    day: growthFrom(lastIndex - 1),
    day5: growthFrom(lastIndex - 5),
    day20: growthFrom(lastIndex - 20),
    ytd: growthFrom(lastYearIndex),
    date: dates[lastIndex],
  }
}
