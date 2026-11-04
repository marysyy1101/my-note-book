import { CLOUD_FN } from '@/config/cloud'
import { getCategory } from '@/constants/categories'
import type { CategoryStat, StatsResult, TrendBucket } from '@/types/bill'
import { ensureLogin } from './auth'
import { callFunction } from './cloud'

type Granularity = 'none' | 'day' | 'month'

interface RawCategoryItem {
  _id: { type: 'expense' | 'income', categoryId: string }
  amount: number
  count: number
}

interface RawTrendItem {
  _id: { bucket: string, type: 'expense' | 'income' }
  amount: number
}

interface RawStats {
  categories: RawCategoryItem[]
  trend: RawTrendItem[]
}

/**
 * 统计由云函数完成（服务端聚合），避免把全量账目拉到端上。
 */
export async function fetchStats (params: {
  start: string
  end: string
  granularity?: Granularity
}): Promise<StatsResult> {
  const { start, end, granularity = 'none' } = params
  // 集合由 login 云函数首次创建，聚合前先确保它跑过一次
  await ensureLogin()
  const raw = await callFunction<RawStats>(CLOUD_FN.STATS, { startDate: start, endDate: end, granularity })

  const categories = raw?.categories || []
  const expense = categories.filter(i => i._id.type === 'expense').reduce((s, i) => s + i.amount, 0)
  const income = categories.filter(i => i._id.type === 'income').reduce((s, i) => s + i.amount, 0)

  const buildCats = (type: 'expense' | 'income', total: number): CategoryStat[] =>
    categories
      .filter(i => i._id.type === type)
      .map(i => {
        const c = getCategory(i._id.categoryId)
        return {
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          amount: i.amount || 0,
          count: i.count || 0,
          percent: total > 0 ? (i.amount || 0) / total : 0
        }
      })
      .sort((a, b) => b.amount - a.amount)

  const trendMap = new Map<string, TrendBucket>()
  ;(raw?.trend || []).forEach((i) => {
    const key = i._id.bucket
    const item = trendMap.get(key) || { bucket: key, expense: 0, income: 0 }
    if (i._id.type === 'income') item.income += i.amount || 0
    else item.expense += i.amount || 0
    trendMap.set(key, item)
  })

  return {
    expense,
    income,
    expenseCats: buildCats('expense', expense),
    incomeCats: buildCats('income', income),
    trend: Array.from(trendMap.values()).sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
  }
}
