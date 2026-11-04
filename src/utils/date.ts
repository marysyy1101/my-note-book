const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function pad2 (n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Date -> YYYY-MM-DD（使用本地时区，避免 new Date('2026-11-03') 被当成 UTC） */
export function formatDate (d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM-DD' -> Date（本地时区 0 点） */
export function parseDate (s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function today (): string {
  return formatDate(new Date())
}

/** Date -> 'HH:mm:ss'（记账时刻，精确到秒） */
export function formatClock (d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** 当前时刻 'HH:mm:ss' */
export function nowClock (): string {
  return formatClock(new Date())
}

/** 'HH:mm:ss' -> 'HH:mm'（列表展示用），非法输入返回空串 */
export function clockShort (time?: string): string {
  if (!time) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  return m ? `${pad2(Number(m[1]))}:${m[2]}` : ''
}

/** 'HH:mm:ss' -> [时, 分, 秒]，非法输入回落到 0 */
export function clockParts (time?: string): [number, number, number] {
  const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(time || '')
  if (!m) return [0, 0, 0]
  return [
    Math.min(23, Math.max(0, Number(m[1]) || 0)),
    Math.min(59, Math.max(0, Number(m[2]) || 0)),
    Math.min(59, Math.max(0, Number(m[3]) || 0))
  ]
}

/** [时, 分, 秒] -> 'HH:mm:ss' */
export function clockFromParts (h: number, m: number, s: number): string {
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

/** 'YYYY-MM' -> 'YYYY-MM'，输入非法则回退到今天所在月 */
export function normalizeMonth (ym?: string): string {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) return ym
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function shiftMonth (ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** 某月的起止日期（含） */
export function monthRange (ym: string): { start: string, end: string } {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  return { start: formatDate(first), end: formatDate(last) }
}

/** 某年的起止日期（含） */
export function yearRange (year: number): { start: string, end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

export function monthLabel (ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

export function isSameMonth (dateStr: string, ym: string): boolean {
  return dateStr.slice(0, 7) === ym
}

export function weekdayCN (dateStr: string): string {
  return WEEK_CN[parseDate(dateStr).getDay()]
}

/** 日期显示：11月3日 周二 / 今天 / 昨天 */
export function friendlyDay (dateStr: string): string {
  const t = today()
  const [, m, d] = dateStr.split('-')
  const base = `${Number(m)}月${Number(d)}日`
  if (dateStr === t) return `今天 · ${base}`
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (dateStr === formatDate(y)) return `昨天 · ${base}`
  return `${base}`
}

/** 该月天数 */
export function daysInMonth (ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
