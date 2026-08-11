/** 圖表配色（依序循環使用） */
export const CHART_COLORS = [
  '#14b8a6',
  '#38bdf8',
  '#a78bfa',
  '#fbbf24',
  '#f472b6',
  '#34d399',
  '#fb7185',
  '#60a5fa',
  '#c084fc',
  '#fcd34d',
]

export const CASH_COLOR = '#64748b'
export const GAIN_COLOR = '#34d399'
export const LOSS_COLOR = '#fb7185'

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Recharts 提示框樣式（深色主題） */
export const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
}
