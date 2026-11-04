import {
  Award,
  Briefcase,
  BusFront,
  CircleDollarSign,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Shapes,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Utensils,
  Wallet
} from 'lucide-react-taro'
import type { IconProps } from 'lucide-react-taro'
import type { FC } from 'react'

import { ICON_STROKE } from '@/constants/icons'

/**
 * 分类图标注册表
 *
 * key 必须与 constants/categories.ts 中 Category.icon 的取值一致
 * （含历史数据里已经落库的 key），所以这里保留 kebab-case，不做驼峰转换。
 */
const REGISTRY: Record<string, FC<IconProps>> = {
  'utensils': Utensils,
  'bus-front': BusFront,
  'shopping-bag': ShoppingBag,
  'house': House,
  'gamepad-2': Gamepad2,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'smartphone': Smartphone,
  'gift': Gift,
  'shapes': Shapes,
  'wallet': Wallet,
  'award': Award,
  'trending-up': TrendingUp,
  'briefcase': Briefcase,
  'hand-coins': HandCoins,
  'circle-dollar-sign': CircleDollarSign
}

export interface CatIconProps {
  /** 图标 key，未知 key 回退到 shapes，保证不出现空白占位 */
  name: string
  /** 描边颜色，必填：data-uri 渲染无法继承 CSS 颜色 */
  color: string
  /** 尺寸（px） */
  size?: number
  className?: string
  strokeWidth?: number
}

/** 分类图标：按字符串 key 动态取图标，颜色由 props 决定，无需再为选中态单独出图 */
export default function CatIcon (props: CatIconProps) {
  const { name, color, size = 46, className, strokeWidth = ICON_STROKE.default } = props
  const Icon = REGISTRY[name] || Shapes
  return <Icon size={size} color={color} className={className} strokeWidth={strokeWidth} />
}
