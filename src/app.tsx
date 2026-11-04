import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { silentLogin } from '@/services/auth'

import './app.scss'

function App ({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    // 微信静默登录：无弹窗、无授权，仅取 openid 建立账号
    silentLogin().catch(() => {})
  })

  return children
}

export default App
