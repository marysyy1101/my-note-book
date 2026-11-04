// 云函数：微信静默登录
// 作用：通过 getWXContext 拿到 openid（无需 wx.login、无需用户授权、无弹窗），
//      并在 users 集合里维护一条账号记录。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 集合存在性只检查一次：热容器内后续调用直接跳过，冷启动最多多两次快调用
let collectionsReady = false

async function ensureCollections () {
  if (collectionsReady) return
  collectionsReady = true
  if (typeof db.createCollection !== 'function') return
  for (const name of ['users', 'bills']) {
    try {
      await db.createCollection(name)
      console.log(`[login] 已创建集合 ${name}`)
    } catch (e) {
      // 已存在 / 无权限创建时忽略，交给控制台手工处理
    }
  }
}

exports.main = async () => {
  await ensureCollections()

  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  const users = db.collection('users')

  try {
    const existed = await users.doc(OPENID).get()
    const data = existed && existed.data
    if (data) {
      await users.doc(OPENID).update({
        data: {
          lastLoginAt: db.serverDate(),
          loginCount: (data.loginCount || 0) + 1
        }
      })
    }
  } catch (err) {
    // 不存在则创建（doc(OPENID) 作为主键，天然幂等）
    try {
      await users.add({
        data: {
          _id: OPENID,
          openid: OPENID,
          appid: APPID,
          unionid: UNIONID || '',
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate(),
          loginCount: 1
        }
      })
    } catch (e) {
      // 并发下可能重复插入，忽略
    }
  }

  return {
    openid: OPENID,
    appid: APPID
  }
}
