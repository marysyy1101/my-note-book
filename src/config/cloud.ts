/**
 * 云开发环境配置
 *
 * 必须显式指定：账号下有多个环境时，小程序端不传 env 会连到「默认环境」，
 * 与云函数实际部署的环境不一致就会报 -501000（the resource is not found）。
 *
 * 当前 AppID wxf3dabfe233a259b7 的环境：
 *   cloud1-d0g8ykn52bc4b36f2  体验版 —— 云函数部署在此
 *   prod-d6g6j3p677ff26615   正式环境
 */
export const CLOUD_ENV = 'cloud1-d0g8ykn52bc4b36f2'

/** 云数据库集合名 */
export const COLLECTION = {
  BILL: 'bills',
  USER: 'users'
}

/** 云函数名 */
export const CLOUD_FN = {
  LOGIN: 'login',
  STATS: 'stats'
}
