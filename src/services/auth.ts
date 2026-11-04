import Taro from '@tarojs/taro'
import { CLOUD_FN } from '@/config/cloud'
import { callFunction } from './cloud'

const STORAGE_KEY = 'jz_openid'

let cachedOpenid = ''
let pending: Promise<string> | null = null

interface LoginResult {
  openid: string
  appid?: string
}

/**
 * 微信静默登录：
 * 1. 先读本地缓存，避免每次冷启动都发请求；
 * 2. 缓存缺失时调用 login 云函数，由 getWXContext 拿到 openid（无需用户授权、无弹窗）。
 */
export function silentLogin (force = false): Promise<string> {
  if (!force) {
    if (cachedOpenid) return Promise.resolve(cachedOpenid)
    try {
      const local = Taro.getStorageSync(STORAGE_KEY)
      if (local) {
        cachedOpenid = local
        return Promise.resolve(local)
      }
    } catch (e) {
      // ignore
    }
  }
  if (pending) return pending
  pending = callFunction<LoginResult>(CLOUD_FN.LOGIN)
    .then((res) => {
      const openid = (res && res.openid) || ''
      if (openid) {
        cachedOpenid = openid
        try {
          Taro.setStorageSync(STORAGE_KEY, openid)
        } catch (e) {
          // ignore
        }
      }
      return openid
    })
    .catch((err) => {
      console.warn('[auth] 静默登录失败', err)
      return ''
    })
    .finally(() => {
      pending = null
    })
  return pending
}

let sessionLogin: Promise<string> | null = null

/**
 * 每个小程序会话至少真正执行一次 login 云函数。
 *
 * silentLogin() 命中本地缓存时会直接返回，不会打到云端；但 login 云函数同时负责
 * 首次创建 users / bills 集合，缓存命中就跳过的后果是新环境里集合永远建不出来，
 * 页面会一直报「集合不存在」。所以数据层操作前统一走这个入口。
 */
export function ensureLogin (): Promise<string> {
  if (!sessionLogin) {
    sessionLogin = silentLogin(true).then((openid) => {
      // 失败（云函数未部署 / 环境不对）时清空，允许下次重试
      if (!openid) sessionLogin = null
      return openid
    })
  }
  return sessionLogin
}

export function getOpenid (): string {
  return cachedOpenid
}

/** 账号短标识，用于界面展示 */
export function getAccountTag (): string {
  if (!cachedOpenid) return '----'
  return cachedOpenid.slice(-4).toUpperCase()
}
