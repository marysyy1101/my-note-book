import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { CloudOff, ReceiptText } from 'lucide-react-taro'
import { useMemo, useRef, useState } from 'react'

import CatIcon from '@/components/CatIcon'
import { ICON_COLOR, ICON_STROKE } from '@/constants/icons'
import { fetchStats } from '@/services/stats'
import { getAccountTag, silentLogin } from '@/services/auth'
import { alpha } from '@/utils/color'
import { daysInMonth, monthLabel, monthRange, normalizeMonth, pad2, today, yearRange } from '@/utils/date'
import { describeCloudError, type FriendlyError } from '@/utils/error'
import { formatMoney, formatMoneyShort, formatSigned } from '@/utils/money'
import { CLOUD_FN } from '@/config/cloud'
import type { StatsResult } from '@/types/bill'

import './index.scss'

type Period = 'month' | 'year' | 'all'
type Kind = 'expense' | 'income'

const PERIODS: { key: Period, label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'year', label: '本年' },
  { key: 'all', label: '全部' }
]

interface Bar {
  label: string
  value: number
  showLabel: boolean
}

export default function Stats () {
  const [period, setPeriod] = useState<Period>('month')
  const [kind, setKind] = useState<Kind>('expense')
  const [data, setData] = useState<StatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<FriendlyError | null>(null)
  const [rangeLabel, setRangeLabel] = useState('')
  const [account, setAccount] = useState(getAccountTag())

  const periodRef = useRef(period)
  periodRef.current = period
  const loadingRef = useRef(false)

  const load = async (p: Period) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    const now = new Date()
    const currentYm = normalizeMonth()
    let start = ''
    let end = ''
    let granularity: 'day' | 'month' = 'month'
    let label = ''

    if (p === 'month') {
      const r = monthRange(currentYm)
      start = r.start
      end = r.end
      granularity = 'day'
      label = monthLabel(currentYm)
    } else if (p === 'year') {
      const r = yearRange(now.getFullYear())
      start = r.start
      end = r.end
      granularity = 'month'
      label = `${now.getFullYear()}年`
    } else {
      start = '2000-01-01'
      end = today()
      granularity = 'month'
      label = '全部时间'
    }

    try {
      const res = await fetchStats({ start, end, granularity })
      if (periodRef.current !== p) return
      setData(res)
      setRangeLabel(label)
    } catch (err: any) {
      console.error('[stats] 加载失败', err)
      setError(describeCloudError(err, { fn: CLOUD_FN.STATS }))
      setData(null)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useDidShow(() => {
    load(periodRef.current)
    silentLogin().then(() => setAccount(getAccountTag())).catch(() => {})
  })

  const switchPeriod = (p: Period) => {
    if (p === period) return
    setPeriod(p)
    periodRef.current = p
    load(p)
  }

  const bars: Bar[] = useMemo(() => {
    if (!data) return []
    const currentYm = normalizeMonth()

    if (period === 'month') {
      const n = daysInMonth(currentYm)
      const map = new Map(data.trend.map(t => [t.bucket, t]))
      const list = Array.from({ length: n }, (_, i) => {
        const key = `${currentYm}-${pad2(i + 1)}`
        const hit = map.get(key)
        return { label: `${i + 1}`, value: hit ? hit.expense : 0 }
      })
      return withLabelStep(list, 5)
    }

    if (period === 'year') {
      const year = new Date().getFullYear()
      const map = new Map(data.trend.map(t => [t.bucket, t]))
      const list = Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${pad2(i + 1)}`
        const hit = map.get(key)
        return { label: `${i + 1}月`, value: hit ? hit.expense : 0 }
      })
      return withLabelStep(list, 2)
    }

    const tail = data.trend.slice(-12)
    return withLabelStep(
      tail.map(t => ({ label: `${t.bucket.slice(2, 4)}/${t.bucket.slice(5, 7)}`, value: t.expense })),
      2
    )
  }, [data, period])

  const maxBar = useMemo(() => Math.max(1, ...bars.map(b => b.value)), [bars])
  const avgLabel = period === 'year' ? '月均支出' : period === 'month' ? '日均支出' : '月均支出'
  const avgValue = useMemo(() => {
    if (!data) return 0
    if (period === 'month') return Math.round(data.expense / daysInMonth(normalizeMonth()))
    if (period === 'year') return Math.round(data.expense / 12)
    const n = Math.max(1, data.trend.length)
    return Math.round(data.expense / n)
  }, [data, period])

  const list = kind === 'expense' ? (data?.expenseCats || []) : (data?.incomeCats || [])
  const kindTotal = kind === 'expense' ? (data?.expense || 0) : (data?.income || 0)
  const hasData = !!data && (data.expense > 0 || data.income > 0)

  return (
    <View className='stats-page'>
      <View className='segmented'>
        {PERIODS.map(p => (
          <View
            className={`seg-item ${period === p.key ? 'on' : ''}`}
            key={p.key}
            onClick={() => switchPeriod(p.key)}
          >
            {p.label}
          </View>
        ))}
      </View>

      {error ? (
        <View className='state-box'>
          <CloudOff className='state-icon' size={86} color={ICON_COLOR.muted} strokeWidth={ICON_STROKE.default} />
          <Text className='state-title'>{error.title}</Text>
          <Text className='state-desc'>{error.desc}</Text>
          <View className='state-btn' onClick={() => load(period)}>重新加载</View>
        </View>
      ) : null}

      {!error && loading && !data ? (
        <View className='state-box'>
          <View className='spinner' />
          <Text className='state-desc'>正在统计…</Text>
        </View>
      ) : null}

      {!error && data ? (
        <ScrollView className='scroll' scrollY enhanced showScrollbar={false}>
          <View className='range-tip'>{rangeLabel}</View>

          <View className='balance-card'>
            <View className='bc-row'>
              <View className='bc-item'>
                <Text className='bc-k'>支出</Text>
                <Text className='bc-v num'>{formatMoney(data.expense)}</Text>
              </View>
              <View className='bc-item'>
                <Text className='bc-k'>收入</Text>
                <Text className='bc-v num income'>{formatMoney(data.income)}</Text>
              </View>
              <View className='bc-item'>
                <Text className='bc-k'>结余</Text>
                <Text className='bc-v num'>{formatSigned(data.income - data.expense)}</Text>
              </View>
            </View>
          </View>

          {hasData ? (
            <View className='card'>
              <View className='card-head'>
                <Text className='card-title'>支出趋势</Text>
                <Text className='card-sub num'>{avgLabel} ¥{formatMoney(avgValue)}</Text>
              </View>
              <View className='chart'>
                {bars.map((b, i) => {
                  const h = b.value > 0 ? Math.max(5, Math.round((b.value / maxBar) * 148)) : 3
                  return (
                    <View className='bar-col' key={`${b.label}-${i}`}>
                      <View
                        className={`bar ${b.value > 0 ? 'has' : ''}`}
                        style={{ height: `${h}px` }}
                      />
                      <Text className='bar-label'>{b.showLabel ? b.label : ''}</Text>
                    </View>
                  )
                })}
              </View>
              <View className='chart-foot'>
                <Text className='chart-foot-k'>单期最高支出</Text>
                <Text className='chart-foot-v num'>¥{formatMoneyShort(maxBar)}</Text>
              </View>
            </View>
          ) : null}

          {hasData ? (
            <View className='card'>
              <View className='card-head'>
                <Text className='card-title'>分类排行</Text>
                <View className='kind-switch'>
                  <Text
                    className={`kind-item ${kind === 'expense' ? 'on' : ''}`}
                    onClick={() => setKind('expense')}
                  >
                    支出
                  </Text>
                  <Text
                    className={`kind-item ${kind === 'income' ? 'on' : ''}`}
                    onClick={() => setKind('income')}
                  >
                    收入
                  </Text>
                </View>
              </View>

              {list.length === 0 ? (
                <View className='list-empty'>该区间暂无{kind === 'expense' ? '支出' : '收入'}记录</View>
              ) : null}

              {list.map((c) => (
                <View className='cat-row' key={c.id}>
                  <View className='cat-ic' style={{ background: alpha(c.color, 0.1) }}>
                    <CatIcon className='cat-ic-img' name={c.icon} size={30} color={c.color} />
                  </View>
                  <View className='cat-main'>
                    <View className='cat-line'>
                      <Text className='cat-name'>{c.name}</Text>
                      <Text className='cat-count'>{c.count}笔 · {Math.round(c.percent * 100)}%</Text>
                      <Text className='cat-amount num'>¥{formatMoney(c.amount)}</Text>
                    </View>
                    <View className='cat-track'>
                      <View
                        className='cat-fill'
                        style={{
                          width: `${Math.max(3, Math.round(c.percent * 100))}%`,
                          background: c.color
                        }}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <View className='cat-total'>
                <Text className='cat-total-k'>合计</Text>
                <Text className='cat-total-v num'>¥{formatMoney(kindTotal)}</Text>
              </View>
            </View>
          ) : null}

          {!hasData && !loading ? (
            <View className='state-box'>
              <ReceiptText className='state-icon' size={86} color={ICON_COLOR.muted} strokeWidth={ICON_STROKE.default} />
              <Text className='state-title'>{rangeLabel}还没有记录</Text>
              <Text className='state-desc'>记下几笔账，这里会自动汇总</Text>
            </View>
          ) : null}

          <View className='footer'>
            <Text className='footer-text'>账号 {account} · 数据存储于微信云开发</Text>
          </View>
        </ScrollView>
      ) : null}
    </View>
  )
}

function withLabelStep (list: { label: string, value: number }[], step: number): Bar[] {
  return list.map((item, i) => ({
    ...item,
    showLabel: i % step === 0 || i === list.length - 1
  }))
}
