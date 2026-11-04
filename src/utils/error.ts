/**
 * 把微信云开发的原始错误翻译成「用户能照着做」的提示。
 *
 * 云开发的错误信息形如：
 *   cloud.callFunction:fail Error: errCode: -501000 | errMsg: the resource is not found
 *   (callId: 1793872123129-0.28407...) (trace: 10:15:23 start->... abort)
 * 直接展示给用户没有意义，这里按错误码映射成结论 + 操作步骤。
 */

import { CLOUD_ENV } from '@/config/cloud'

export interface FriendlyError {
  /** 一句话结论，例如「云函数 stats 未部署」 */
  title: string
  /** 具体怎么修 */
  desc: string
}

interface ErrorContext {
  /** 云函数名，例如 'stats' */
  fn?: string
  /** 集合名，例如 'bills' */
  collection?: string
}

const CODE_FN_NOT_FOUND = -501000
const CODE_COLLECTION_NOT_EXIST = -502005
const CODE_PERMISSION_DENIED = -502003
const CODE_ENV_NOT_FOUND = -601001

function rawMessage (err: any): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  return String(err.errMsg || err.message || '')
}

function errorCode (err: any): number {
  if (!err || typeof err !== 'object') return 0
  const v = err.errCode !== undefined ? err.errCode : err.code
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 去掉 callId / trace 这类对用户无意义的尾巴 */
export function trimCloudMessage (msg: string): string {
  return String(msg || '')
    .replace(/^cloud\.[\w.]+:fail\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .replace(/\(callId:[\s\S]*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,，|]+$/g, '')
    .trim()
}

export function describeCloudError (err: any, ctx: ErrorContext = {}): FriendlyError {
  const msg = rawMessage(err)
  const code = errorCode(err)
  const fnName = ctx.fn
  const fnLabel = fnName ? `云函数 ${fnName}` : '云函数'
  const collLabel = ctx.collection ? `集合 ${ctx.collection}` : '数据集合'

  // 云函数不存在 / 未部署 / 部署到了别的环境
  if (code === CODE_FN_NOT_FOUND || /resource is not found/i.test(msg)) {
    return {
      title: `${fnLabel} 找不到`,
      desc: fnName
        ? `当前连接环境：${CLOUD_ENV || '(默认环境)'}。若云函数已部署，说明它不在这个环境里——改成部署环境的环境 ID 填进 src/config/cloud.ts 的 CLOUD_ENV，或去控制台把函数部署到该环境`
        : '请在开发者工具里上传并部署 cloudfunctions 目录下的云函数'
    }
  }

  // 集合不存在
  if (code === CODE_COLLECTION_NOT_EXIST || /collection.*not exist|DATABASE_COLLECTION_NOT_EXIST/i.test(msg)) {
    return {
      title: `${collLabel} 不存在`,
      desc: ctx.collection
        ? `云开发控制台 → 数据库 → 新建集合 ${ctx.collection}，权限选「仅创建者可读写」`
        : '请在云开发控制台创建所需的数据集合'
    }
  }

  // 权限不足
  if (code === CODE_PERMISSION_DENIED || /permission denied|无权限|not authorized/i.test(msg)) {
    return {
      title: '没有读写权限',
      desc: ctx.collection
        ? `把集合 ${ctx.collection} 的权限改为「仅创建者可读写」，再重试`
        : '把数据集合的权限改为「仅创建者可读写」，再重试'
    }
  }

  // 环境未开通 / 环境 ID 不对
  if (
    code === CODE_ENV_NOT_FOUND ||
    /cloud.*not.*init|请先初始化|invalid env|env.*not.*(found|exist)|environment not found/i.test(msg)
  ) {
    return {
      title: '云开发环境未就绪',
      desc: '确认已在小程序后台开通云开发；多环境时把环境 ID 填到 src/config/cloud.ts 的 CLOUD_ENV'
    }
  }

  // 兜底：给出清洗后的原始信息，至少不刷屏
  const clean = trimCloudMessage(msg)
  return {
    title: '数据暂不可用',
    desc: clean || '未知错误，请稍后重试'
  }
}
