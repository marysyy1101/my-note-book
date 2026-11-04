export type BillType = 'expense' | 'income'

/** 一条账目，金额单位：分（整数，避免浮点误差） */
export interface Bill {
  _id: string
  _openid?: string
  type: BillType
  categoryId: string
  amount: number
  note?: string
  /** YYYY-MM-DD */
  date: string
  /** 记账时刻 HH:mm:ss（本地时间，精确到秒） */
  time?: string
  /** 创建时间，用于同一天内的排序 */
  createdAt?: number | Date | string
}

export type BillInput = Pick<Bill, 'type' | 'categoryId' | 'amount' | 'date' | 'note'> & {
  /** 不传则由数据层取当前时刻 */
  time?: string
}

export interface Category {
  id: string
  name: string
  /** 图标 key，对应 assets/icons/cat/{icon}.png */
  icon: string
  /** 图标主色，同时用于色块的浅色背景 */
  color: string
}

export interface CategoryStat {
  id: string
  name: string
  icon: string
  color: string
  amount: number
  count: number
  percent: number
}

export interface TrendBucket {
  /** day: YYYY-MM-DD；month: YYYY-MM */
  bucket: string
  expense: number
  income: number
}

export interface StatsResult {
  expense: number
  income: number
  expenseCats: CategoryStat[]
  incomeCats: CategoryStat[]
  trend: TrendBucket[]
}
