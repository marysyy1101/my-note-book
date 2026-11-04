import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChartColumn, ChevronRight, Database, Info, PencilLine, Settings, UserRound } from 'lucide-react-taro'
import { Fragment, useMemo, useRef, useState } from 'react'

import { CLOUD_ENV } from '@/config/cloud'
import { IS_DEV } from '@/config/env'
import { ICON_COLOR, ICON_STROKE } from '@/constants/icons'
import { ensureLogin, getAccountTag } from '@/services/auth'
import { fetchStats } from '@/services/stats'
import { monthRange, normalizeMonth, today } from '@/utils/date'
import { formatMoney } from '@/utils/money'
import { getNavMetrics } from '@/utils/system'
import { goAdd, syncTabBar } from '@/utils/tabbar'
import type { StatsResult } from '@/types/bill'

import './index.scss'

const APP_VERSION = '1.0.0'

interface Overview {
  todayExpense: number
  monthExpense: number
  monthIncome: number
  totalCount: number
}

function countOf (stat: StatsResult): number {
  return [...(stat.expenseCats || []), ...(stat.incomeCats || [])]
    .reduce((s, c) => s + (c.count || 0), 0)
}

/** 结余：负数带负号，正数不加符号 */
function signedMoney (cents: number): string {
  return `${cents < 0 ? '-' : ''}¥${formatMoney(cents)}`
}

export default function Profile () {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  const [tag, setTag] = useState(() => getAccountTag())
  const [solidNav, setSolidNav] = useState(false)
  const solidRef = useRef(false)

  // 自定义导航栏：高度必须用「真实 px」计算，状态栏 + 导航条（与右上角胶囊居中对齐）
  const nav = useMemo(() => getNavMetrics(), [])

  const load = async () => {
    try {
      await ensureLogin()
      setTag(getAccountTag())
      const m = monthRange(normalizeMonth())
      const day = today()
      // 本月带 day 粒度，一次就能拿到当天数据，省一次云函数调用
      const [month, all] = await Promise.all([
        fetchStats({ start: m.start, end: m.end, granularity: 'day' }),
        fetchStats({ start: '2000-01-01', end: day })
      ])
      const todayBucket = (month.trend || []).find(b => b.bucket === day)
      setOverview({
        todayExpense: todayBucket ? todayBucket.expense : 0,
        monthExpense: month.expense,
        monthIncome: month.income,
        totalCount: countOf(all)
      })
      setFailed(false)
    } catch (err) {
      console.warn('[profile] 概览加载失败', err)
      setFailed(true)
    }
  }

  useDidShow(() => {
    syncTabBar()
    load()
  })

  const nickname = tag ? `记账用户 ${tag}` : '记账用户'
  const subtitle = failed ? '数据未同步，切换页面后再回来试试' : `微信用户 · ID ${tag || '----'}`

  const showEnv = () => {
    Taro.showModal({
      title: '云开发环境',
      content: `环境 ID：${CLOUD_ENV || '(默认环境)'}\n所有账目都保存在这个环境里，仅本小程序可访问。`,
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const showAbout = () => {
    Taro.showModal({
      title: '关于记账本',
      content: `版本 ${APP_VERSION}\n图标来自 Lucide（ISC License）\n金额以「分」为单位存储，不丢精度`,
      showCancel: false,
      confirmText: '好的'
    })
  }

  // 云开发环境 ID 属于开发调试信息，只在开发版出现；体验版/正式版只留「关于」
  const settingsItems = useMemo(() => {
    const items: Array<{ text: string, run: () => void }> = []
    if (IS_DEV) items.push({ text: '云开发环境', run: showEnv })
    items.push({ text: '关于记账本', run: showAbout })
    return items
  }, [])

  const openSettings = () => {
    Taro.showActionSheet({
      itemList: settingsItems.map(i => i.text)
    }).then((res) => {
      const item = settingsItems[res.tapIndex]
      if (item) item.run()
    }).catch(() => {})
  }

  const handleScroll = (e: any) => {
    const top = (e && e.detail && e.detail.scrollTop) || 0
    const next = top > 6
    if (next !== solidRef.current) {
      solidRef.current = next
      setSolidNav(next)
    }
  }

  const balance = overview ? overview.monthIncome - overview.monthExpense : 0

  return (
    <View className='profile-page'>
      <View className='hero-bg' />

      <View
        className={`nav${solidNav ? ' nav-solid' : ''}`}
        style={{
          paddingTop: `${nav.statusBarHeight}px`,
          height: `${nav.navTotalHeight}px`,
          // 行内样式不会被 rpx 转换，毛玻璃半径才是真实像素
          ...(solidNav
            ? { backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)' }
            : null)
        }}
      >
        <Text className='nav-title'>个人中心</Text>
      </View>

      <ScrollView
        className='scroll'
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={handleScroll}
      >
        <View className='user'>
          <View className='avatar-wrap'>
            <View className='avatar'>
              <UserRound size={56} color={ICON_COLOR.white} strokeWidth={ICON_STROKE.default} />
            </View>
          </View>
          <View className='ident'>
            <View className='name-row'>
              <Text className='nickname'>{nickname}</Text>
            </View>
            <Text className='sub'>{subtitle}</Text>
          </View>
          {/* <View className='gear' onClick={openSettings}>
            <Settings className='gear-img' size={32} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View> */}
        </View>

        <View className='figures'>
          <View className='fig'>
            <Text className='fig-v num'>{overview ? formatMoney(overview.todayExpense) : '--'}</Text>
            <Text className='fig-k'>今日支出</Text>
          </View>
          <View className='fig'>
            <Text className='fig-v num'>{overview ? formatMoney(overview.monthExpense) : '--'}</Text>
            <Text className='fig-k'>本月支出</Text>
          </View>
          <View className='fig'>
            <Text className='fig-v num'>{overview ? formatMoney(overview.monthIncome) : '--'}</Text>
            <Text className='fig-k'>本月收入</Text>
          </View>
          <View className='fig'>
            <Text className='fig-v num'>{overview ? overview.totalCount : '--'}</Text>
            <Text className='fig-k'>累计笔数</Text>
          </View>
        </View>

        <View className='balance'>
          <Text className='balance-k'>本月结余（元）</Text>
          <Text className='balance-v num'>{overview ? signedMoney(balance) : '¥--'}</Text>
        </View>

        <View className='card'>
          <Text className='card-title'>常用服务</Text>
          <View className='menu-row' onClick={goAdd}>
            <View className='menu-icon'>
              <PencilLine className='menu-img' size={28} color={ICON_COLOR.brand} strokeWidth={ICON_STROKE.default} />
            </View>
            <Text className='menu-text'>记一笔</Text>
            <ChevronRight className='menu-arrow' size={22} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View>
          <View className='menu-line' />
          <View className='menu-row' onClick={() => Taro.navigateTo({ url: '/pages/stats/index' })}>
            <View className='menu-icon'>
              <ChartColumn className='menu-img' size={28} color={ICON_COLOR.brand} strokeWidth={ICON_STROKE.default} />
            </View>
            <Text className='menu-text'>数据统计</Text>
            <ChevronRight className='menu-arrow' size={22} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View>
          {IS_DEV ? (
            <Fragment>
              <View className='menu-line' />
              <View className='menu-row' onClick={showEnv}>
                <View className='menu-icon'>
                  <Database className='menu-img' size={28} color={ICON_COLOR.brand} strokeWidth={ICON_STROKE.default} />
                </View>
                <Text className='menu-text'>云开发环境</Text>
                <Text className='menu-value'>{CLOUD_ENV ? '已连接' : '默认'}</Text>
                <ChevronRight className='menu-arrow' size={22} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
              </View>
            </Fragment>
          ) : null}
          <View className='menu-line' />
          <View className='menu-row' onClick={showAbout}>
            <View className='menu-icon'>
              <Info className='menu-img' size={28} color={ICON_COLOR.brand} strokeWidth={ICON_STROKE.default} />
            </View>
            <Text className='menu-text'>关于</Text>
            <Text className='menu-value'>v{APP_VERSION}</Text>
            <ChevronRight className='menu-arrow' size={22} color={ICON_COLOR.strong} strokeWidth={ICON_STROKE.default} />
          </View>
        </View>

        <View className='card tip-card'>
          <Text className='card-title'>小提示</Text>
          <Text className='tip-body'>记一笔会自动记录当前时刻（精确到秒，可手动修改）；明细左滑即可删除。</Text>
          <Text className='tip-foot'>账目只保存在你自己的微信云开发环境，仅本小程序可访问。</Text>
        </View>
      </ScrollView>
    </View>
  )
}
