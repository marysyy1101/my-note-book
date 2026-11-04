import type { Category } from '@/types/bill'

/**
 * 支出分类
 * icon 为 lucide 图标名，渲染入口见 components/CatIcon.tsx
 */
export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', name: '餐饮', icon: 'utensils', color: '#F26B3A' },
  { id: 'traffic', name: '交通', icon: 'bus-front', color: '#3B82F6' },
  { id: 'shopping', name: '购物', icon: 'shopping-bag', color: '#EC4899' },
  { id: 'home', name: '居住', icon: 'house', color: '#8B5CF6' },
  { id: 'fun', name: '娱乐', icon: 'gamepad-2', color: '#F59E0B' },
  { id: 'medical', name: '医疗', icon: 'heart-pulse', color: '#EF4444' },
  { id: 'study', name: '学习', icon: 'graduation-cap', color: '#06B6D4' },
  { id: 'comm', name: '通讯', icon: 'smartphone', color: '#6366F1' },
  { id: 'social', name: '人情', icon: 'gift', color: '#F43F5E' },
  { id: 'other-expense', name: '其他', icon: 'shapes', color: '#94A3B8' }
]

/** 收入分类 */
export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: '工资', icon: 'wallet', color: '#12A160' },
  { id: 'bonus', name: '奖金', icon: 'award', color: '#F59E0B' },
  { id: 'invest', name: '理财', icon: 'trending-up', color: '#0EA5E9' },
  { id: 'parttime', name: '兼职', icon: 'briefcase', color: '#8B5CF6' },
  { id: 'redpack', name: '红包', icon: 'hand-coins', color: '#EF4444' },
  { id: 'other-income', name: '其他', icon: 'circle-dollar-sign', color: '#94A3B8' }
]

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
const MAP = ALL.reduce<Record<string, Category>>((acc, c) => {
  acc[c.id] = c
  return acc
}, {})

export function getCategories (type: 'expense' | 'income'): Category[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function getCategory (id: string): Category {
  return MAP[id] || { id, name: '未分类', icon: 'shapes', color: '#94A3B8' }
}
