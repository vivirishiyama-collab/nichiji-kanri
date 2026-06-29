import * as XLSX from 'xlsx'

export interface SalesRow {
  date: string   // YYYY-MM-DD (business date)
  amount: number // item_total 合計（サービス料除く）
}

function getBusinessDate(txDate: string, txTime: string): string {
  if (!txTime) return txDate
  const hour = parseInt(txTime.substring(0, 2), 10)
  if (hour < 7) {
    const d = new Date(txDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().substring(0, 10)
  }
  return txDate
}

export async function parseCSV(file: File): Promise<SalesRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, dateNF: 'yyyy-mm-dd' })

  if (rawRows.length === 0) return []

  // ヘッダーを正規化
  const first = rawRows[0]
  const keys = Object.keys(first)

  // AirRegi形式の列名を検索
  const dateKey = keys.find(k => k.includes('取引日') || k.includes('日付'))
  const timeKey = keys.find(k => k.includes('取引時間') || k.includes('時間'))
  const itemKey = keys.find(k => k.includes('商品名'))
  const amountKey = keys.find(k => k.includes('商品合計金額') || k.includes('合計金額') || k.includes('金額'))

  if (!dateKey || !amountKey) throw new Error('対応していないファイル形式です')

  // 日付ごとに集計（サービス料除外）
  const byDate: Record<string, number> = {}
  rawRows.forEach(row => {
    const itemName = itemKey ? String(row[itemKey] ?? '') : ''
    if (itemName.includes('サービス料')) return

    const rawDate = String(row[dateKey] ?? '').substring(0, 10)
    if (!rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) return

    const rawTime = timeKey ? String(row[timeKey] ?? '') : ''
    const date = getBusinessDate(rawDate, rawTime)

    const amount = parseFloat(String(row[amountKey] ?? '0').replace(/,/g, '')) || 0
    byDate[date] = (byDate[date] ?? 0) + amount
  })

  return Object.entries(byDate).map(([date, amount]) => ({ date, amount: Math.round(amount) }))
}
