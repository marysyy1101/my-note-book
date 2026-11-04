import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import billIcon from '@/assets/tabbar/bill.png'
import billActiveIcon from '@/assets/tabbar/bill-active.png'
import userIcon from '@/assets/tabbar/user.png'
import userActiveIcon from '@/assets/tabbar/user-active.png'
import { UI_ICONS } from '@/assets/icons'
import { TABBAR_EVENT, TAB_INDEX, TAB_PROFILE, currentRoute, goAdd } from '@/utils/tabbar'

import './index.scss'

/**
 * 自定义 tabBar：明细 / 记一笔（中间凸起）/ 我的
 * 记一笔是普通页面（navigateTo），不占 tab 位，所以 tabBar.list 只有两项。
 */
export default function CustomTabBar () {
  const [route, setRoute] = useState(() => currentRoute())

  useEffect(() => {
    const onChange = (next: string) => setRoute(next || currentRoute())
    Taro.eventCenter.on(TABBAR_EVENT, onChange)
    // 组件挂载时先按当前路由点亮，避免首帧闪一下默认态
    setRoute(currentRoute())
    return () => {
      Taro.eventCenter.off(TABBAR_EVENT, onChange)
    }
  }, [])

  const activeIndex = route === TAB_INDEX
  const activeProfile = route === TAB_PROFILE

  const switchTo = (path: string) => {
    if (path === route) return
    Taro.switchTab({ url: path })
  }

  return (
    <View className='tabbar'>
      <View className='bar'>
        <View className='tab' onClick={() => switchTo(TAB_INDEX)}>
          <Image className='tab-icon' src={activeIndex ? billActiveIcon : billIcon} mode='aspectFit' />
          <Text className={`tab-text${activeIndex ? ' on' : ''}`}>明细</Text>
        </View>

        <View className='tab tab-center' onClick={goAdd}>
          <View className='plus-wrap'>
            <View className='plus'>
              <Image className='plus-icon' src={UI_ICONS.plusWhite} mode='aspectFit' />
            </View>
          </View>
          <Text className='plus-text'>记一笔</Text>
        </View>

        <View className='tab' onClick={() => switchTo(TAB_PROFILE)}>
          <Image className='tab-icon' src={activeProfile ? userActiveIcon : userIcon} mode='aspectFit' />
          <Text className={`tab-text${activeProfile ? ' on' : ''}`}>我的</Text>
        </View>
      </View>
    </View>
  )
}
