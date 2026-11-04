import { View, Text, Image, Input, Picker, PickerView, PickerViewColumn, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'

import { CAT_ICONS, UI_ICONS } from '@/assets/icons'
import { getCategories } from '@/constants/categories'
import { addBill } from '@/services/bill'
import { alpha } from '@/utils/color'
import { clockFromParts, clockParts, formatClock, pad2, parseDate, today } from '@/utils/date'
import { parseAmountToCents } from '@/utils/money'
import type { BillType } from '@/types/bill'

import './index.scss'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

/** 时间选择器的三列候选项，下标即数值 */
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i))
const SECONDS = MINUTES

export default function Add () {
  const [type, setType] = useState<BillType>('expense')
  const [amount, setAmount] = useState('0')
  const [categoryId, setCategoryId] = useState('food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [submitting, setSubmitting] = useState(false)
  /**
   * 记账时刻精确到秒，但页面上不再实时走秒（走秒既费电又容易被误认为"必须准点"）。
   * 默认取进入页面那一刻，用户可点开手动改；没改过的话保存时再取一次当前时刻。
   */
  const [time, setTime] = useState(() => formatClock())
  // 用户是否手动改过时间：改过就用他选的值，没改过则保存瞬间取当前时刻
  const [timeEdited, setTimeEdited] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  /**
   * 三列滚轮的当前取值（下标即数值，所以 0-23 / 0-59 的区间直接当索引用）。
   * PickerView 必须走受控的 value —— Taro 不会把 defaultValue 转成初始下标，
   * 一旦不传 value，每次打开滚轮都从 00:00:00 开始。
   */
  const [draft, setDraft] = useState<[number, number, number]>(() => clockParts(formatClock()))
  const submittingRef = useRef(false)

  const categories = useMemo(() => getCategories(type), [type])

  const displayAmount = amount === '0' ? '0.00' : amount
  const amountClass = displayAmount.length > 9 ? 'amount num amount-sm' : 'amount num'

  const switchType = (next: BillType) => {
    if (next === type) return
    setType(next)
    setCategoryId(getCategories(next)[0].id)
  }

  const tapKey = (key: string) => {
    try {
      const p: any = Taro.vibrateShort({ type: 'light' })
      if (p && p.catch) p.catch(() => {})
    } catch (e) {
      // 部分机型不支持，忽略
    }
    setAmount((prev) => {
      if (key === 'del') return prev.length <= 1 ? '0' : prev.slice(0, -1)
      if (key === '.') return prev.includes('.') ? prev : `${prev}.`
      const [intPart, decPart] = prev.split('.')
      if (decPart !== undefined && decPart.length >= 2) return prev
      if (decPart === undefined && intPart.length >= 7) return prev
      const next = prev === '0' ? key : `${prev}${key}`
      return next
    })
  }

  const dateLabel = useMemo(() => {
    const t = today()
    if (date === t) return '今天'
    const d = parseDate(date)
    const now = new Date()
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }, [date])

  const openTime = () => {
    // 没改过时间就从"此刻"开始选，免得页面停久了还从打开页面时的时刻起选
    setDraft(clockParts(timeEdited ? time : formatClock()))
    setTimeOpen(true)
  }

  const onTimeChange = (e: any) => {
    const v: number[] = (e.detail && e.detail.value) || []
    setDraft([
      Math.min(23, Math.max(0, Number(v[0]) || 0)),
      Math.min(59, Math.max(0, Number(v[1]) || 0)),
      Math.min(59, Math.max(0, Number(v[2]) || 0))
    ])
  }

  const confirmTime = () => {
    setTime(clockFromParts(draft[0], draft[1], draft[2]))
    setTimeEdited(true)
    setTimeOpen(false)
  }

  const save = async () => {
    if (submittingRef.current) return
    const cents = parseAmountToCents(amount)
    if (cents <= 0) {
      Taro.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      // 没手动改过时间：保存这一刻才取时分秒，等价于"记账动作发生的时间"
      const finalTime = timeEdited ? time : formatClock()
      await addBill({ type, categoryId, amount: cents, note, date, time: finalTime })
      Taro.showToast({ title: '已记下', icon: 'success', duration: 900 })
      setTimeout(() => {
        Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/index/index' }))
      }, 700)
    } catch (err: any) {
      console.error('[add] 保存失败', err)
      const msg = err?.errMsg || err?.message || ''
      Taro.showModal({
        title: '保存失败',
        content: msg.includes('collection') || msg.includes('not exist')
          ? '云数据库集合 bills 不存在，请先在云开发控制台创建并设置权限'
          : (msg || '请检查网络与云开发环境'),
        showCancel: false
      })
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <View className='add-page'>
      <View className='type-switch'>
        <View
          className={`type-item ${type === 'expense' ? 'on' : ''}`}
          onClick={() => switchType('expense')}
        >
          支出
        </View>
        <View
          className={`type-item ${type === 'income' ? 'on' : ''}`}
          onClick={() => switchType('income')}
        >
          收入
        </View>
      </View>

      <ScrollView className='form' scrollY enhanced showScrollbar={false}>
        <View className='amount-box'>
          <Text className={`currency ${type}`}>¥</Text>
          <Text className={`${amountClass} ${type}`}>{displayAmount}</Text>
        </View>

        <View className='cat-grid'>
          {categories.map((cat) => {
            const active = cat.id === categoryId
            return (
              <View
                className={`cat-item ${active ? 'on' : ''}`}
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
              >
                <View
                  className='cat-icon'
                  style={{
                    background: active ? cat.color : alpha(cat.color, 0.1),
                    boxShadow: active ? `0 8px 18px ${alpha(cat.color, 0.32)}` : 'none'
                  }}
                >
                  <Image
                    className='cat-img'
                    src={active ? CAT_ICONS[`${cat.icon}-on`] || CAT_ICONS[cat.icon] : CAT_ICONS[cat.icon]}
                    mode='aspectFit'
                  />
                </View>
                <Text className={`cat-name ${active ? 'on' : ''}`}>{cat.name}</Text>
              </View>
            )
          })}
        </View>

        <View className='meta'>
          <Picker mode='date' value={date} end={today()} onChange={(e) => setDate(e.detail.value)}>
            <View className='meta-row'>
              <Image className='meta-icon' src={UI_ICONS.calendar} mode='aspectFit' />
              <Text className='meta-text'>{dateLabel}</Text>
              <Image className='meta-arrow' src={UI_ICONS.chevronRight} mode='aspectFit' />
            </View>
          </Picker>
          <View className='meta-row' onClick={openTime}>
            <Image className='meta-icon' src={UI_ICONS.clock} mode='aspectFit' />
            <Text className='meta-text num'>{time}</Text>
            <Image className='meta-arrow' src={UI_ICONS.chevronRight} mode='aspectFit' />
          </View>
          <View className='meta-row'>
            <Image className='meta-icon' src={UI_ICONS.pencil} mode='aspectFit' />
            <Input
              className='note-input'
              value={note}
              placeholder='添加备注（可选）'
              placeholderClass='note-ph'
              maxlength={30}
              onInput={(e) => setNote(e.detail.value)}
            />
          </View>
        </View>
      </ScrollView>

      <View className='keyboard'>
        <View className='keys'>
          {KEYS.map((key) => (
            <View
              className={`key ${key === 'del' ? 'key-del' : ''}`}
              key={key}
              onClick={() => tapKey(key)}
            >
              {key === 'del'
                ? <Image className='key-icon' src={UI_ICONS.backspace} mode='aspectFit' />
                : <Text className='key-text num'>{key}</Text>}
            </View>
          ))}
        </View>
        <View className={`submit ${submitting ? 'disabled' : ''}`} onClick={save}>
          <Text className='submit-text'>{submitting ? '保存中' : '完成'}</Text>
        </View>
      </View>

      {/* 时间选择：微信原生 picker 只到分钟，这里自己搭三列，才能选到秒 */}
      {timeOpen ? (
        <View className='time-layer'>
          <View className='time-mask' onClick={() => setTimeOpen(false)} />
          <View className='time-panel'>
            <View className='time-head'>
              <Text className='time-act' onClick={() => setTimeOpen(false)}>取消</Text>
              <Text className='time-title num'>{clockFromParts(draft[0], draft[1], draft[2])}</Text>
              <Text className='time-act time-ok' onClick={confirmTime}>确定</Text>
            </View>
            <View className='time-unit'>
              <Text className='time-unit-t'>时</Text>
              <Text className='time-unit-t'>分</Text>
              <Text className='time-unit-t'>秒</Text>
            </View>
            <PickerView
              className='time-picker'
              value={draft}
              immediateChange
              indicatorStyle='height: 80rpx'
              onChange={onTimeChange}
            >
              <PickerViewColumn>
                {HOURS.map(h => <View className='time-item num' key={`h${h}`}>{h}</View>)}
              </PickerViewColumn>
              <PickerViewColumn>
                {MINUTES.map(m => <View className='time-item num' key={`m${m}`}>{m}</View>)}
              </PickerViewColumn>
              <PickerViewColumn>
                {SECONDS.map(s => <View className='time-item num' key={`s${s}`}>{s}</View>)}
              </PickerViewColumn>
            </PickerView>
          </View>
        </View>
      ) : null}
    </View>
  )
}
