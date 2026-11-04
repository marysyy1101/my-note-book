import Taro from '@tarojs/taro'

/**
 * 运行环境（由微信客户端注入，不需要自己判断 NODE_ENV）
 *
 *   develop —— 开发者工具 / 开发版
 *   trial   —— 体验版（上传后在后台「选为体验版」的版本）
 *   release —— 正式版
 *
 * 用途：把只在开发阶段有用的信息（云环境 ID、初始化日志）从体验版/正式版里收掉。
 */
export type EnvVersion = 'develop' | 'trial' | 'release'

function readEnvVersion (): EnvVersion {
  try {
    const api: any = Taro as any
    if (typeof api.getAccountInfoSync !== 'function') return 'develop'
    const info: any = api.getAccountInfoSync()
    const version = info && info.miniProgram && info.miniProgram.envVersion
    if (version === 'release' || version === 'trial' || version === 'develop') {
      return version
    }
    return 'develop'
  } catch (e) {
    // 老基础库、Node 桩环境等拿不到账号信息时，按开发环境处理（信息最全）
    return 'develop'
  }
}

export const ENV_VERSION: EnvVersion = readEnvVersion()

/** 只有开发者工具 / 开发版才为 true */
export const IS_DEV = ENV_VERSION === 'develop'

/** 体验版 */
export const IS_TRIAL = ENV_VERSION === 'trial'

/** 正式版 */
export const IS_RELEASE = ENV_VERSION === 'release'
