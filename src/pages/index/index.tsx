import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { ChevronLeft, ChevronRight, CloudOff, ReceiptText, Trash2, ChartColumn } from 'lucide-react-taro'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import CatIcon from '@/components/CatIcon'
import { getCategory } from '@/constants/categories'
import { ICON_COLOR, ICON_STROKE } from '@/constants/icons'
import { fetchBills, removeBill, PAGE_SIZE } from '@/services/bill'
import { fetchStats } from '@/services/stats'
import { clockShort, friendlyDay, monthLabel, monthRange, normalizeMonth, shiftMonth, weekdayCN } from '@/utils/date'
import { describeCloudError, type FriendlyError } from '@/utils/error'
import { formatMoney } from '@/utils/money'
import { getNavMetrics } from '@/utils/system'
import { goAdd, syncTabBar } from '@/utils/tabbar'
import { alpha } from '@/utils/color'
import { CLOUD_FN, COLLECTION } from '@/config/cloud'
import type { Bill, Category } from '@/types/bill'

import './index.scss'

/** 侧滑删除按钮宽度（750 设计稿基准），必须与 index.scss 里 .row-action 的 width 一致 */
const ACTION_DP = 168
/**
 * 换算成真机 px。
 * scss 里的 px 会被 Taro 按 designWidth=750 转成 rpx，而 transform 只认真实像素，
 * 两者混用会让滑出距离在大屏上明显偏短，所以这里按窗口宽度换算一次。
 */
const ACTION_PX = Math.round(ACTION_DP * (getNavMetrics().windowWidth / 750))

interface RowItem extends Bill {
  cat: Category
}

interface DayGroup {
  date: string
  label: string
  weekday: string
  expense: number
  income: number
  items: RowItem[]
}

export default function Index () {
  const [ym, setYm] = useState(normalizeMonth())
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [summary, setSummary] = useState({ expense: 0, income: 0 })
  // 骨架屏只在「首屏」出现；之后再进页面（切 tab 回来、从记账页返回）走静默刷新
  const [skeleton, setSkeleton] = useState(true)
  // 静默刷新：顶部一条细进度条，不打断已渲染的列表
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<FriendlyError | null>(null)
  const [count, setCount] = useState(0)
  // 当前滑开的行（同时只允许一行打开）
  const [openId, setOpenId] = useState('')
  // 拖动中的行：dx 为实时位移，null 表示这一刻没有手指在拖
  const [drag, setDrag] = useState<{ id: string, dx: number } | null>(null)

  const ymRef = useRef(ym)
  ymRef.current = ym
  const skipRef = useRef(0)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  // 是否已经成功渲染过一次数据
  const loadedRef = useRef(false)
  // 上次加载完成时刻，用于避免快速切 tab 时重复请求
  const lastLoadRef = useRef(0)
  // 请求在飞时又触发了加载：排队，等当前请求结束补一次
  const pendingRef = useRef<null | { showSkeleton: boolean }>(null)
  // 静默刷新失败的提示节流
  const errorToastRef = useRef(0)

  /* ---------- 侧滑删除手势 ---------- */
  const openIdRef = useRef('')
  const gestureRef = useRef({
    id: '',
    startX: 0,
    startY: 0,
    /** 手指按下时该行的基准位移：0 或 -ACTION_PX */
    base: 0,
    axis: '' as '' | 'x' | 'y',
    dx: 0
  })
  // 侧滑结束后系统往往还会补发一次 tap，用它把这次点击吃掉，避免刚滑开就被关掉
  const tapBlockRef = useRef(0)

  const setOpen = useCallback((id: string) => {
    openIdRef.current = id
    setOpenId(id)
  }, [])

  const onRowTouchStart = useCallback((item: RowItem, e: any) => {
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const opened = openIdRef.current
    if (opened && opened !== item._id) setOpen('')
    const base = opened === item._id ? -ACTION_PX : 0
    gestureRef.current = {
      id: item._id,
      startX: touch.clientX,
      startY: touch.clientY,
      base,
      axis: '',
      dx: base
    }
  }, [setOpen])

  const onRowTouchMove = useCallback((e: any) => {
    const g = gestureRef.current
    const touch = e.touches && e.touches[0]
    if (!g.id || !touch) return
    const mx = touch.clientX - g.startX
    const my = touch.clientY - g.startY
    if (!g.axis) {
      // 6px 迟滞：手指抖动不算手势，也避免轻点时行内容闪动
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      // 纵向滑动一律交还给页面滚动，不做拦截
      if (g.axis === 'y') return
    }
    if (g.axis !== 'x') return

    let dx = g.base + mx
    // 越界阻尼：右滑过原位、或左滑超出按钮宽度时减速，做出"拉到头"的手感
    if (dx > 0) dx = dx * 0.22
    else if (dx < -ACTION_PX) dx = -ACTION_PX + (dx + ACTION_PX) * 0.3
    g.dx = dx
    setDrag({ id: g.id, dx })
  }, [])

  const onRowTouchEnd = useCallback(() => {
    const g = gestureRef.current
    if (!g.id) return
    if (g.axis === 'x') {
      // 过一半就吸附到完全打开，否则回弹
      setOpen(g.dx < -ACTION_PX * 0.5 ? g.id : '')
      tapBlockRef.current = Date.now()
    }
    gestureRef.current = { ...g, id: '', axis: '', dx: 0 }
    setDrag(null)
  }, [setOpen])

  const onRowTap = useCallback(() => {
    if (Date.now() - tapBlockRef.current < 300) return
    if (openIdRef.current) setOpen('')
  }, [setOpen])

  /**
   * @param reset          重新拉取（回到第一页）
   * @param showSkeleton   是否显示骨架屏；不传时只有首屏才显示
   */
  const load = async (reset: boolean, showSkeleton = false) => {
    if (loadingRef.current) {
      if (reset) {
        pendingRef.current = { showSkeleton: showSkeleton || !!pendingRef.current?.showSkeleton }
      }
      return
    }
    loadingRef.current = true
    const target = ymRef.current
    if (reset) {
      setError(null)
      if (showSkeleton || !loadedRef.current) setSkeleton(true)
      else setRefreshing(true)
    } else {
      setLoadingMore(true)
    }

    const { start, end } = monthRange(target)
    const skip = reset ? 0 : skipRef.current

    try {
      const tasks: any[] = [fetchBills({ start, end, skip, limit: PAGE_SIZE })]
      if (reset) tasks.push(fetchStats({ start, end, granularity: 'none' }))

      const [billRes, statRes] = await Promise.all(tasks)
      // 月份已被切换，丢弃过期响应
      if (ymRef.current !== target) return

      const incoming = (billRes.list || []) as Bill[]
      skipRef.current = skip + incoming.length
      hasMoreRef.current = !!billRes.hasMore

      if (reset) {
        setGroups(buildGroups(incoming))
        setCount(statRes ? countAll(statRes) : incoming.length)
        if (statRes) setSummary({ expense: statRes.expense, income: statRes.income })
        loadedRef.current = true
      } else if (incoming.length) {
        setGroups(prev => buildGroups(mergeBills(prev, incoming)))
      }
    } catch (err: any) {
      console.error('[index] 加载失败', err)
      const friendly = describeCloudError(err, { fn: CLOUD_FN.STATS, collection: COLLECTION.BILL })
      if (reset && loadedRef.current) {
        // 已有内容时静默刷新失败：保留旧数据，只做轻提示，避免整页被错误卡片顶掉
        if (Date.now() - errorToastRef.current > 60000) {
          errorToastRef.current = Date.now()
          Taro.showToast({ title: '刷新失败，显示的是上次数据', icon: 'none' })
        }
      } else {
        setError(friendly)
        if (reset) {
          setGroups([])
          setSummary({ expense: 0, income: 0 })
        }
      }
    } finally {
      loadingRef.current = false
      lastLoadRef.current = Date.now()
      setRefreshing(false)
      setLoadingMore(false)

      const pending = pendingRef.current
      if (pending) {
        // 还有一次补拉，骨架保持到那次结束，避免中间闪一下"空账本"
        pendingRef.current = null
        load(true, pending.showSkeleton)
      } else {
        setSkeleton(false)
      }
    }
  }

  useDidShow(() => {
    // tab 页会被缓存，切回来时自定义 tabBar 实例不重新挂载，这里补一次高亮同步
    syncTabBar()
    // 刚加载完就切回来（比如 tab 来回点），不重复请求，避免刷新条闪一下
    if (loadedRef.current && Date.now() - lastLoadRef.current < 2000) return
    load(true)
  })

  useReachBottom(() => {
    if (hasMoreRef.current && !loadingRef.current) load(false)
  })

  const changeMonth = (delta: number) => {
    const next = shiftMonth(ymRef.current, delta)
    ymRef.current = next
    setYm(next)
    skipRef.current = 0
    hasMoreRef.current = true
    setGroups([])
    setSkeleton(true)
    // 换月份属于整块内容替换，用骨架屏比空列表自然
    load(true, true)
  }

  const backToThisMonth = () => {
    const next = normalizeMonth()
    if (next === ymRef.current) return
    ymRef.current = next
    setYm(next)
    skipRef.current = 0
    hasMoreRef.current = true
    setGroups([])
    setSkeleton(true)
    load(true, true)
  }

  const goStats = () => {
    Taro.navigateTo({ url: '/pages/stats/index' })
  }

  /** 删除成功后先本地摘掉这条，再静默拉一次对齐服务端 */
  const removeLocal = (item: RowItem) => {
    setGroups(prev =>
      prev
        .map(g => {
          if (g.date !== item.date) return g
          const remain = g.items.filter(i => i._id !== item._id)
          return {
            ...g,
            items: remain,
            expense: remain.reduce((s, i) => (i.type === 'expense' ? s + i.amount : s), 0),
            income: remain.reduce((s, i) => (i.type === 'income' ? s + i.amount : s), 0)
          }
        })
        .filter(g => g.items.length > 0)
    )
    setSummary(prev => ({
      expense: prev.expense - (item.type === 'expense' ? item.amount : 0),
      income: prev.income - (item.type === 'income' ? item.amount : 0)
    }))
    setCount(prev => Math.max(0, prev - 1))
  }

  /** 侧滑行只接收稳定的回调引用，否则任一状态变化都会让整个列表跟着重渲染 */
  const deleteRef = useRef<(item: RowItem) => void>(() => {})
  const onDeletePress = useCallback((item: RowItem) => {
    deleteRef.current(item)
  }, [])

  /** 二次确认后才真正删除：滑开只是露出按钮，不点不做任何写操作 */
  const onDelete = (item: RowItem) => {
    Taro.showModal({
      title: '删除这笔账？',
      content: `${item.cat.name} ¥${formatMoney(item.amount)}，删除后不可恢复`,
      confirmText: '删除',
      confirmColor: '#F26B3A'
    }).then((res) => {
      // 取消也要把滑开的行收回去，否则会停在半开状态
      setOpen('')
      if (!res.confirm) return
      removeBill(item._id)
        .then(() => {
          Taro.showToast({ title: '已删除', icon: 'none' })
          removeLocal(item)
          skipRef.current = 0
          load(true)
        })
        .catch(() => Taro.showToast({ title: '删除失败', icon: 'none' }))
    })
  }

  useEffect(() => {
    deleteRef.current = onDelete
  })

  const isEmpty = !skeleton && !error && groups.length === 0
  const balance = summary.income - summary.expense
  const isCurrentMonth = ym === normalizeMonth()

  const monthTotal = useMemo(
    () => groups.reduce((acc, g) => acc + g.expense, 0),
    [groups]
  )

  return (
    <View className='index-page'>
      <View className='topbar'>
        <View className='month-switch'>
          <View className='nav-btn' onClick={() => changeMonth(-1)}>
            <ChevronLeft className='nav-icon' size={34} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View>
          <Text className='month-label'>{monthLabel(ym)}</Text>
          <View className='nav-btn' onClick={() => changeMonth(1)}>
            <ChevronRight className='nav-icon' size={34} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View>
        </View>
        <View className='today-btn' onClick={backToThisMonth}>本月</View>
        {refreshing ? <View className='refresh-bar' /> : null}
      </View>

      <View className='hero'>
        <View className='hero-head'>
          <Text className='hero-k'>{isCurrentMonth ? '本月支出' : `${Number(ym.split('-')[1])}月支出`}</Text>
          <View className='hero-stat' onClick={goStats}>
            <Text className='hero-stat-text'>统计</Text>
            <ChartColumn className='hero-stat-arrow' size={12} color={ICON_COLOR.white} strokeWidth={ICON_STROKE.strong} />
          </View>
        </View>
        <View className='hero-amount'>
          <Text className='hero-symbol'>¥</Text>
          <Text className='hero-value num'>{formatMoney(summary.expense)}</Text>
        </View>
        <View className='hero-foot'>
          <View className='hero-foot-item'>
            <Text className='hero-foot-k'>收入</Text>
            <Text className='hero-foot-v num'>¥{formatMoney(summary.income)}</Text>
          </View>
          <View className='hero-divider' />
          <View className='hero-foot-item'>
            <Text className='hero-foot-k'>结余</Text>
            <Text className='hero-foot-v num'>{balance < 0 ? '-' : ''}¥{formatMoney(balance)}</Text>
          </View>
          <View className='hero-divider' />
          <View className='hero-foot-item'>
            <Text className='hero-foot-k'>笔数</Text>
            <Text className='hero-foot-v num'>{count}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View className='state-box'>
          <CloudOff className='state-icon' size={96} color={ICON_COLOR.muted} strokeWidth={ICON_STROKE.default} />
          <Text className='state-title'>{error.title}</Text>
          <Text className='state-desc'>{error.desc}</Text>
          <View className='state-btn' onClick={() => load(true)}>重新加载</View>
        </View>
      ) : null}

      {skeleton ? (
        <View className='skeleton'>
          {[0, 1, 2].map(i => (
            <View className='skeleton-card' key={i}>
              <View className='sk-line sk-line-sm' />
              <View className='sk-line' />
              <View className='sk-line' />
            </View>
          ))}
        </View>
      ) : null}

      {isEmpty ? (
        <View className='state-box'>
          <ReceiptText className='state-icon' size={96} color={ICON_COLOR.muted} strokeWidth={ICON_STROKE.default} />
          <Text className='state-title'>这个月还没有记账</Text>
          <Text className='state-desc'>点底部的「＋」记下第一笔</Text>
          <View className='state-btn' onClick={goAdd}>记一笔</View>
        </View>
      ) : null}

      {groups.map(group => (
        <View className='day' key={group.date}>
          <View className='day-head'>
            <Text className='day-label'>{group.label}</Text>
            <Text className='day-weekday'>{group.weekday}</Text>
            <Text className='day-sum num'>
              {group.expense > 0 ? `支出 ${formatMoney(group.expense)}` : ''}
              {group.expense > 0 && group.income > 0 ? '  ·  ' : ''}
              {group.income > 0 ? `收入 ${formatMoney(group.income)}` : ''}
            </Text>
          </View>
          <View className='day-body'>
            {group.items.map(item => (
              <SwipeRow
                key={item._id}
                item={item}
                open={openId === item._id}
                dx={drag && drag.id === item._id ? drag.dx : null}
                onStart={onRowTouchStart}
                onMove={onRowTouchMove}
                onEnd={onRowTouchEnd}
                onTap={onRowTap}
                onDelete={onDeletePress}
              />
            ))}
          </View>
        </View>
      ))}

      {loadingMore ? <View className='load-more'>正在加载更多…</View> : null}
      {!loadingMore && !hasMoreRef.current && groups.length > 0
        ? <View className='load-more'>共 {formatMoney(monthTotal)} 元支出 · 已到底</View>
        : null}
    </View>
  )
}

function countAll (stat: { expenseCats: any[], incomeCats: any[] }): number {
  const all = [...(stat.expenseCats || []), ...(stat.incomeCats || [])]
  return all.reduce((s, c) => s + (c.count || 0), 0)
}

function buildGroups (list: Bill[]): DayGroup[] {
  const map = new Map<string, DayGroup>()
  list.forEach((b) => {
    let g = map.get(b.date)
    if (!g) {
      g = {
        date: b.date,
        label: friendlyDay(b.date),
        weekday: weekdayCN(b.date),
        expense: 0,
        income: 0,
        items: []
      }
      map.set(b.date, g)
    }
    g.items.push({ ...b, cat: getCategory(b.categoryId) })
    if (b.type === 'income') g.income += b.amount
    else g.expense += b.amount
  })
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1))
}

function mergeBills (groups: DayGroup[], incoming: Bill[]): Bill[] {
  const flat: Bill[] = []
  groups.forEach(g => g.items.forEach(({ cat, ...rest }) => { flat.push(rest as Bill) }))
  return [...flat, ...incoming]
}

interface SwipeRowProps {
  item: RowItem
  /** 是否处于滑开状态 */
  open: boolean
  /** 拖动中的实时位移；null 表示当前没有手指在拖这一行 */
  dx: number | null
  onStart: (item: RowItem, e: any) => void
  onMove: (e: any) => void
  onEnd: () => void
  onTap: () => void
  onDelete: (item: RowItem) => void
}

/**
 * 单条账目：内容层可左右拖动，右侧下方压着删除按钮。
 *
 * 用 memo 隔开很有必要 —— 拖动时父级每秒要更新几十次位移，
 * 但真正变化的只有当前这一行的 transform，其余行不该跟着重算。
 */
const SwipeRow = memo(function SwipeRow (props: SwipeRowProps) {
  const { item, open, dx, onStart, onMove, onEnd, onTap, onDelete } = props
  const dragging = dx != null
  const offset = dragging ? (dx as number) : (open ? -ACTION_PX : 0)

  return (
    <View className='row-wrap'>
      {/* 压在内容下面的删除按钮，内容左移后露出 */}
      <View className='row-action' onClick={() => onDelete(item)}>
        <Trash2 className='row-action-icon' size={22} color={ICON_COLOR.white} strokeWidth={ICON_STROKE.default} />
        <Text className='row-action-text'>删除</Text>
      </View>
      <View
        className={`row${dragging ? ' row-dragging' : ''}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onTouchStart={(e) => onStart(item, e)}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        onClick={onTap}
      >
        <View
          className='row-icon'
          style={{ background: alpha(item.cat.color, 0.1) }}
        >
          <CatIcon className='row-icon-img' name={item.cat.icon} size={40} color={item.cat.color} />
        </View>
        <View className='row-main'>
          <Text className='row-name'>{item.cat.name}</Text>
          {item.note || item.time ? (
            <View className='row-meta'>
              {item.time ? <Text className='row-time num'>{clockShort(item.time)}</Text> : null}
              {item.time && item.note ? <Text className='row-dot'>·</Text> : null}
              {item.note ? <Text className='row-note'>{item.note}</Text> : null}
            </View>
          ) : null}
        </View>
        <Text className={`row-amount num ${item.type}`}>
          {item.type === 'expense' ? '-' : '+'}{formatMoney(item.amount)}
        </Text>
      </View>
    </View>
  )
})

