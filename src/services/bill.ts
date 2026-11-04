import { COLLECTION } from '@/config/cloud'
import type { Bill, BillInput } from '@/types/bill'
import { nowClock } from '@/utils/date'
import { ensureLogin } from './auth'
import { getDB } from './cloud'

const PAGE_SIZE = 20

export interface FetchBillsParams {
  start: string
  end: string
  skip?: number
  limit?: number
}

/** 按月区间分页拉取账目（客户端直连数据库，仅能读到自己的数据） */
export async function fetchBills (params: FetchBillsParams): Promise<{ list: Bill[], hasMore: boolean }> {
  const { start, end, skip = 0, limit = PAGE_SIZE } = params
  await ensureLogin()
  const db = await getDB()
  const _ = db.command
  const res = await db
    .collection(COLLECTION.BILL)
    .where({ date: _.gte(start).and(_.lte(end)) })
    .orderBy('date', 'desc')
    .orderBy('time', 'desc')
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get()
  const list = (res.data || []) as Bill[]
  return { list, hasMore: list.length === limit }
}

export async function addBill (input: BillInput): Promise<string> {
  await ensureLogin()
  const db = await getDB()
  const res = await db.collection(COLLECTION.BILL).add({
    data: {
      type: input.type,
      categoryId: input.categoryId,
      amount: input.amount,
      note: (input.note || '').trim(),
      date: input.date,
      // 精确到秒的记账时刻：同一天内按它排序，也便于回看"几点记的"
      time: input.time || nowClock(),
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  return res._id
}

export async function removeBill (id: string): Promise<void> {
  await ensureLogin()
  const db = await getDB()
  await db.collection(COLLECTION.BILL).doc(id).remove()
}

export { PAGE_SIZE }
