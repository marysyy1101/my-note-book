import Taro from '@tarojs/taro'

/** tabBar 两个真实页面（记一笔是中间凸起按钮，不属于 tab 页） */
export const TAB_INDEX = '/pages/index/index'
export const TAB_PROFILE = '/pages/profile/index'

/** 自定义 tabBar 的高亮状态靠事件广播同步：
 *  tab 页被缓存后切回来，tabBar 组件实例不会重新挂载，
 *  所以每个 tab 页在 useDidShow 里调一次 syncTabBar()。 */
export const TABBAR_EVENT = 'tabbar:change'

/** 取当前页面路由，形如 /pages/index/index */
export function currentRoute (): string {
  try {
    const pages = Taro.getCurrentPages()
    const cur: any = pages[pages.length - 1]
    const route = cur && (cur.route || cur.__route__)
    if (!route) return ''
    return '/' + String(route).replace(/^\/+/, '')
  } catch (e) {
    return ''
  }
}

export function syncTabBar (): void {
  Taro.eventCenter.trigger(TABBAR_EVENT, currentRoute())
}

/** 打开「记一笔」（普通页面，不是 tab 页，所以用 navigateTo） */
export function goAdd (): void {
  Taro.navigateTo({ url: '/pages/add/index' })
}
