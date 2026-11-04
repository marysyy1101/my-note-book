// 云函数：账目统计（服务端聚合）
// 入参：{ startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', granularity: 'none' | 'day' | 'month' }
// 出参：{ categories: [{ _id: { type, categoryId }, amount, count }], trend: [{ _id: { bucket, type }, amount }] }
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

const COLLECTION = 'bills'

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { startDate, endDate, granularity = 'none' } = event

  const match = { _openid: OPENID }
  if (startDate && endDate) {
    match.date = _.gte(startDate).and(_.lte(endDate))
  }

  const categoriesRes = await db
    .collection(COLLECTION)
    .aggregate()
    .match(match)
    .group({
      _id: { type: '$type', categoryId: '$categoryId' },
      amount: $.sum('$amount'),
      count: $.sum(1)
    })
    .limit(200)
    .end()

  let trend = []
  if (granularity !== 'none') {
    const len = granularity === 'day' ? 10 : 7
    const bucketExpr = $.substrBytes(['$date', 0, len])
    const trendRes = await db
      .collection(COLLECTION)
      .aggregate()
      .match(match)
      .group({
        _id: { bucket: bucketExpr, type: '$type' },
        amount: $.sum('$amount')
      })
      .sort({ '_id.bucket': 1 })
      .limit(1000)
      .end()
    trend = trendRes.list || []
  }

  return {
    categories: categoriesRes.list || [],
    trend
  }
}
