import Taro from '@tarojs/taro'

/**
 * 自定义导航栏尺寸（全部是「真实 px」，不是 rpx）
 *
 * 小程序里 scss 的 px 会被 Taro 按 750 设计稿转成 rpx，
 * 而状态栏高度只有真实 px 才有意义，两者混用必然错位：
 * 例如 iPhone 14 Pro 状态栏 54px，若导航条再用固定的 88rpx（44px）并
 * 叠加 padding-top，盒模型（border-box）下内容区会被压成负数，
 * 标题就会溢出到下面的个人信息上。
 */
export interface NavMetrics {
  /** 状态栏高度 */
  statusBarHeight: number
  /** 导航条（不含状态栏）的高度，与右上角胶囊居中对齐 */
  navContentHeight: number
  /** 状态栏 + 导航条总高度 */
  navTotalHeight: number
  /** 胶囊按钮（右上角 更多/关闭）的位置，用于右边距对齐 */
  capsule: { left: number; right: number; top: number; width: number; height: number } | null
  /** 底部安全区（全面屏 Home 条）带来的额外高度 */
  safeBottom: number
  windowWidth: number
  windowHeight: number
}

/** 兜底值：绝大多数机型导航条都是 44px */
const NAV_FALLBACK = 44
const STATUS_FALLBACK = 20

let cached: NavMetrics | null = null

function readWindowInfo (): any {
  try {
    if (typeof (Taro as any).getWindowInfo === 'function') {
      const info = (Taro as any).getWindowInfo()
      if (info && info.windowWidth) return info
    }
  } catch (e) {
    // 低版本基础库没有 getWindowInfo，回落
  }
  try {
    return Taro.getSystemInfoSync()
  } catch (e) {
    return {}
  }
}

function readCapsule (): NavMetrics['capsule'] {
  try {
    const rect: any = (Taro as any).getMenuButtonBoundingClientRect
      ? (Taro as any).getMenuButtonBoundingClientRect()
      : null
    if (rect && rect.width > 0 && rect.height > 0 && typeof rect.top === 'number') {
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height }
    }
  } catch (e) {
    // 部分环境（H5 / 旧基础库）拿不到胶囊
  }
  return null
}

export function getNavMetrics (): NavMetrics {
  if (cached) return cached

  const info = readWindowInfo()
  const statusBarHeight = typeof info.statusBarHeight === 'number' && info.statusBarHeight > 0
    ? info.statusBarHeight
    : STATUS_FALLBACK

  const capsule = readCapsule()

  // 胶囊上下留白对称，所以导航条高度 = 上留白 * 2 + 胶囊高度
  let navContentHeight = NAV_FALLBACK
  if (capsule) {
    const gap = capsule.top != null ? capsule.top - statusBarHeight : -1
    if (gap >= 0) {
      navContentHeight = gap * 2 + capsule.height
    } else {
      navContentHeight = capsule.height + 12
    }
  }
  // 极端值保护（分屏、折叠屏等）
  navContentHeight = Math.min(64, Math.max(40, Math.round(navContentHeight)))

  const screenHeight = info.screenHeight || info.windowHeight || 0
  const safeAreaBottom = info.safeArea && typeof info.safeArea.bottom === 'number'
    ? info.safeArea.bottom
    : screenHeight
  const safeBottom = screenHeight && safeAreaBottom
    ? Math.max(0, Math.round(screenHeight - safeAreaBottom))
    : 0

  cached = {
    statusBarHeight,
    navContentHeight,
    navTotalHeight: statusBarHeight + navContentHeight,
    capsule,
    safeBottom,
    windowWidth: info.windowWidth || 375,
    windowHeight: info.windowHeight || 667
  }
  return cached
}

/** 把胶囊右边界对齐到 24rpx 页边距时，右侧需要留出的真实 px 宽度 */
export function capsuleRightInset (): number {
  const m = getNavMetrics()
  if (!m.capsule) return 0
  return Math.max(0, Math.round(m.windowWidth - m.capsule.right))
}
