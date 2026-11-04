import Taro from '@tarojs/taro'
import { CLOUD_ENV } from '@/config/cloud'
import { IS_DEV } from '@/config/env'

let initPromise: Promise<any> | null = null

/**
 * 取云开发实例。
 * 小程序端直接使用原生 wx.cloud 最稳妥，Taro.cloud 作为兜底（部分构建模式下才有）。
 */
export function getCloud (): any {
  try {
    if (typeof wx !== 'undefined' && (wx as any).cloud) return (wx as any).cloud
  } catch (e) {
    // ignore
  }
  return (Taro as any).cloud
}

/** 幂等的云开发初始化，所有数据操作前都会 await 它 */
export function initCloud (): Promise<any> {
  if (initPromise) return initPromise
  initPromise = new Promise((resolve, reject) => {
    const cloud = getCloud()
    if (!cloud) {
      reject(new Error('当前环境不支持微信云开发，请用微信开发者工具或真机运行'))
      return
    }
    try {
      const options: any = { traceUser: true }
      if (CLOUD_ENV) options.env = CLOUD_ENV
      cloud.init(options)
      // 排查用：控制台里能直接看到小程序连的是哪个环境 / 哪个 AppID，
      // 和云开发控制台左上角的环境 ID 对照即可判断是否「函数部署在 A 环境、小程序连 B 环境」
      // 只在开发版打印，体验版/正式版不向用户侧输出环境信息
      if (IS_DEV) {
        try {
          const account = Taro.getAccountInfoSync && Taro.getAccountInfoSync()
          console.log('[cloud] 已初始化', {
            env: CLOUD_ENV || '(默认环境)',
            appId: account && account.miniProgram ? account.miniProgram.appId : '(未知)'
          })
        } catch (e) {
          // 部分基础库不支持，忽略
        }
      }
      resolve(cloud)
    } catch (err) {
      reject(err)
    }
  })
  return initPromise
}

export async function getDB (): Promise<any> {
  await initCloud()
  return getCloud().database()
}

export async function callFunction<T = any> (name: string, data: Record<string, any> = {}): Promise<T> {
  await initCloud()
  try {
    const res = await getCloud().callFunction({ name, data })
    return (res && res.result) as T
  } catch (err: any) {
    console.error(`[cloud] 调用云函数 ${name} 失败`, err && (err.errCode || err.code), err && (err.errMsg || err.message))
    throw err
  }
}
