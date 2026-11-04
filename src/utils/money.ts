/** 千分位 + 两位小数 */
export function formatMoney (cents: number, withSymbol = false): string {
  const v = Math.abs(Math.round(cents || 0))
  const yuan = Math.floor(v / 100)
  const fen = v % 100
  const s = `${yuan.toLocaleString('en-US')}.${fen < 10 ? '0' : ''}${fen}`
  return withSymbol ? `¥${s}` : s
}

/** 带符号格式化：负数补 '-'，用于结余等可能为负的值 */
export function formatSigned (cents: number): string {
  const neg = cents < 0
  return `${neg ? '-' : ''}${formatMoney(cents)}`
}

/** 不带小数的紧凑格式（用于图表轴标签） */
export function formatMoneyShort (cents: number): string {
  const v = Math.abs(cents || 0) / 100
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
  if (v >= 1000) return `${Math.round(v)}`
  if (v >= 100) return `${v.toFixed(0)}`
  return `${v.toFixed(0)}`
}

/** '12.5' -> 1250（分） */
export function parseAmountToCents (input: string): number {
  if (!input) return 0
  const [i, d = ''] = String(input).split('.')
  const yuan = Number(i || 0)
  const fen = Number((d + '00').slice(0, 2))
  if (Number.isNaN(yuan) || Number.isNaN(fen)) return 0
  return yuan * 100 + fen
}

/** cents -> '12.50'（编辑态回填用） */
export function centsToInput (cents: number): string {
  return (Math.round(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')
}
