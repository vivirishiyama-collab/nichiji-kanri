'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Company, ExpenseCategory, DailySales, DailyExpense } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Upload } from 'lucide-react'

interface Props {
  company: Company
  companies: Company[]
  userEmail: string
  yearMonth: string
  days: string[]
  categories: ExpenseCategory[]
  salesData: DailySales[]
  expensesData: DailyExpense[]
}

function toNum(s: string) { return parseInt(s.replace(/,/g, ''), 10) || 0 }
function fmt(n: number) { return n === 0 ? '' : n.toLocaleString() }

export function MonthClient({ company, companies, userEmail, yearMonth, days, categories: initCategories, salesData: initSales, expensesData: initExpenses }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [categories, setCategories] = useState<ExpenseCategory[]>(initCategories)
  const [sales, setSales] = useState<Record<string, DailySales>>(() => {
    const m: Record<string, DailySales> = {}
    initSales.forEach(r => { m[r.date] = r })
    return m
  })
  const [expenses, setExpenses] = useState<Record<string, Record<string, number>>>(() => {
    const m: Record<string, Record<string, number>> = {}
    initExpenses.forEach(r => {
      if (!m[r.date]) m[r.date] = {}
      m[r.date][r.category_id] = r.amount
    })
    return m
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const [y, m] = yearMonth.split('-')
  const monthLabel = `${y}年${parseInt(m)}月`

  // 月合計
  const totalPosSales = days.reduce((s, d) => s + (sales[d]?.pos_amount ?? 0), 0)
  const totalManualSales = days.reduce((s, d) => s + (sales[d]?.manual_amount ?? 0), 0)
  const totalSales = totalPosSales + totalManualSales
  const totalExpenses = days.reduce((s, d) => s + Object.values(expenses[d] ?? {}).reduce((a, b) => a + b, 0), 0)
  const totalProfit = totalSales - totalExpenses

  async function saveSales(date: string, field: 'pos_amount' | 'manual_amount', value: number) {
    const existing = sales[date]
    const newRow = {
      company_id: company.id,
      date,
      pos_amount: field === 'pos_amount' ? value : (existing?.pos_amount ?? 0),
      manual_amount: field === 'manual_amount' ? value : (existing?.manual_amount ?? 0),
    }
    const { data } = await supabase.from('daily_sales').upsert(newRow, { onConflict: 'company_id,date' }).select().single()
    if (data) setSales(prev => ({ ...prev, [date]: data as DailySales }))
  }

  async function saveExpense(date: string, categoryId: string, value: number) {
    if (value === 0) {
      await supabase.from('daily_expenses').delete()
        .eq('company_id', company.id).eq('date', date).eq('category_id', categoryId)
      setExpenses(prev => {
        const next = { ...prev, [date]: { ...prev[date] } }
        delete next[date][categoryId]
        return next
      })
    } else {
      await supabase.from('daily_expenses').upsert({
        company_id: company.id, date, category_id: categoryId, amount: value
      }, { onConflict: 'company_id,date,category_id' })
      setExpenses(prev => ({ ...prev, [date]: { ...prev[date], [categoryId]: value } }))
    }
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    setAddingCat(true)
    const maxSort = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0
    const { data } = await supabase.from('expense_categories')
      .insert({ company_id: company.id, name: newCatName.trim(), sort_order: maxSort + 1 })
      .select().single()
    if (data) { setCategories(prev => [...prev, data as ExpenseCategory]); setNewCatName('') }
    setAddingCat(false)
  }

  async function deleteCategory(id: string) {
    if (!confirm('このカテゴリを削除しますか？関連する経費データも削除されます。')) return
    await supabase.from('expense_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('解析中...')
    try {
      const { parseCSV } = await import('@/lib/csvParser')
      const rows = await parseCSV(file)
      const dayRows = rows.filter(r => r.date.startsWith(yearMonth))
      if (dayRows.length === 0) { setUploadMsg('この月のデータが見つかりませんでした'); setUploading(false); return }

      // 日ごとに集計
      const byDate: Record<string, number> = {}
      dayRows.forEach(r => { byDate[r.date] = (byDate[r.date] ?? 0) + r.amount })

      setUploadMsg(`${Object.keys(byDate).length}日分をアップロード中...`)
      for (const [date, amount] of Object.entries(byDate)) {
        const existing = sales[date]
        const newRow = {
          company_id: company.id, date,
          pos_amount: amount,
          manual_amount: existing?.manual_amount ?? 0,
        }
        const { data } = await supabase.from('daily_sales').upsert(newRow, { onConflict: 'company_id,date' }).select().single()
        if (data) setSales(prev => ({ ...prev, [date]: data as DailySales }))
      }
      setUploadMsg(`完了！ ${Object.keys(byDate).length}日分の売上を更新しました`)
    } catch (err) {
      setUploadMsg('エラーが発生しました')
      console.error(err)
    }
    setUploading(false)
    e.target.value = ''
  }

  const SalesInput = useCallback(({ date, field }: { date: string; field: 'pos_amount' | 'manual_amount' }) => {
    const [val, setVal] = useState(() => { const v = sales[date]?.[field] ?? 0; return v === 0 ? '' : String(v) })
    return (
      <input
        type="text" inputMode="numeric"
        value={val === '0' ? '' : val}
        onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={e => { const v = sales[date]?.[field] ?? 0; setVal(v === 0 ? '' : String(v)) }}
        onBlur={async () => {
          const num = toNum(val)
          setSaving(`${date}-${field}`)
          await saveSales(date, field, num)
          setSaving(null)
        }}
        className="w-full text-right text-sm px-2 py-1 border border-transparent rounded hover:border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
        placeholder="—"
      />
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={company}
        onCompanyChange={c => router.push(`/?company=${c.id}`)}
        userEmail={userEmail}
      />

      <main className="max-w-full mx-auto p-4 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">{monthLabel}</h1>
          <div className="flex items-center gap-3">
            {/* POSアップロード */}
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${uploading ? 'opacity-50' : 'border-gray-300 hover:bg-gray-50'}`}>
              <Upload className="w-4 h-4" />
              レジデータ取込
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {uploadMsg && <span className="text-xs text-gray-500">{uploadMsg}</span>}
          </div>
        </div>

        {/* 月合計サマリー */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'レジ売上', value: totalPosSales, color: 'text-gray-800' },
            { label: '手入力売上', value: totalManualSales, color: 'text-gray-800' },
            { label: '経費合計', value: totalExpenses, color: 'text-gray-800' },
            { label: '月間利益', value: totalProfit, color: totalProfit < 0 ? 'text-red-600' : 'text-green-600' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold ${item.color}`}>¥{item.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* 経費カテゴリ管理 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">経費カテゴリ</h2>
            <div className="flex gap-2 ml-auto">
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="カテゴリ名" className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400 w-36" />
              <button onClick={addCategory} disabled={addingCat || !newCatName.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Plus className="w-3 h-3" />追加
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700">
                {cat.name}
                <button onClick={() => deleteCategory(cat.id)} className="text-gray-400 hover:text-red-500 ml-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {categories.length === 0 && <span className="text-sm text-gray-400">カテゴリを追加してください</span>}
          </div>
        </div>

        {/* 日次テーブル */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10" style={{ width: 60, minWidth: 60 }}>日付</th>
                  <th className="text-right px-2 py-2 text-gray-600 font-medium" style={{ width: 100, minWidth: 100 }}>レジ売上</th>
                  <th className="text-right px-2 py-2 text-gray-600 font-medium" style={{ width: 100, minWidth: 100 }}>手入力</th>
                  <th className="text-right px-2 py-2 text-blue-700 font-semibold bg-blue-50" style={{ width: 100, minWidth: 100 }}>売上計</th>
                  {categories.map(cat => (
                    <th key={cat.id} className="text-right px-2 py-2 text-gray-600 font-medium" style={{ width: 100, minWidth: 100 }}>{cat.name}</th>
                  ))}
                  <th className="text-right px-2 py-2 text-gray-600 font-medium" style={{ width: 100, minWidth: 100 }}>経費計</th>
                  <th className="text-right px-2 py-2 text-gray-800 font-semibold bg-gray-100" style={{ width: 100, minWidth: 100 }}>日次利益</th>
                </tr>
              </thead>
              <tbody>
                {days.map(date => {
                  const dayNum = parseInt(date.split('-')[2])
                  const dow = new Date(date).getDay()
                  const isSun = dow === 0
                  const isSat = dow === 6
                  const s = sales[date]
                  const pos = s?.pos_amount ?? 0
                  const manual = s?.manual_amount ?? 0
                  const totalS = pos + manual
                  const exp = expenses[date] ?? {}
                  const totalE = Object.values(exp).reduce((a, b) => a + b, 0)
                  const profit = totalS - totalE

                  return (
                    <tr key={date} className="border-b hover:bg-gray-50">
                      <td className={`px-3 py-1.5 sticky left-0 bg-white z-10 font-medium ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                        {dayNum}日
                      </td>
                      {/* レジ売上（アップロードで入る・直接編集も可） */}
                      <td className="px-1 py-1">
                        <PosInput date={date} value={pos} onSave={v => saveSales(date, 'pos_amount', v)} />
                      </td>
                      {/* 手入力売上 */}
                      <td className="px-1 py-1">
                        <ManualInput date={date} value={manual} onSave={v => saveSales(date, 'manual_amount', v)} />
                      </td>
                      {/* 売上計 */}
                      <td className="text-right px-3 py-1.5 font-semibold text-blue-700 bg-blue-50">
                        {totalS === 0 ? <span className="text-gray-200">—</span> : fmt(totalS)}
                      </td>
                      {/* 経費カテゴリ */}
                      {categories.map(cat => (
                        <td key={cat.id} className="px-1 py-1">
                          <ExpInput date={date} categoryId={cat.id} value={exp[cat.id] ?? 0} onSave={v => saveExpense(date, cat.id, v)} />
                        </td>
                      ))}
                      {/* 経費計 */}
                      <td className="text-right px-3 py-1.5 text-gray-700">
                        {totalE === 0 ? <span className="text-gray-200">—</span> : fmt(totalE)}
                      </td>
                      {/* 日次利益 */}
                      <td className={`text-right px-3 py-1.5 font-semibold bg-gray-50 ${profit < 0 ? 'text-red-600' : profit > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                        {totalS === 0 && totalE === 0 ? '—' : fmt(profit)}
                      </td>
                    </tr>
                  )
                })}
                {/* 合計行 */}
                <tr className="bg-gray-100 border-t-2 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10 text-gray-700">合計</td>
                  <td className="text-right px-3 py-2 text-gray-800">{fmt(totalPosSales)}</td>
                  <td className="text-right px-3 py-2 text-gray-800">{fmt(totalManualSales)}</td>
                  <td className="text-right px-3 py-2 text-blue-700 bg-blue-50">{fmt(totalSales)}</td>
                  {categories.map(cat => {
                    const catTotal = days.reduce((s, d) => s + (expenses[d]?.[cat.id] ?? 0), 0)
                    return <td key={cat.id} className="text-right px-3 py-2 text-gray-800">{fmt(catTotal)}</td>
                  })}
                  <td className="text-right px-3 py-2 text-gray-800">{fmt(totalExpenses)}</td>
                  <td className={`text-right px-3 py-2 bg-gray-200 ${totalProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(totalProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

// 個別セルのinputコンポーネント（再レンダリング最小化）
function PosInput({ date, value, onSave }: { date: string; value: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(value === 0 ? '' : String(value))
  useState(() => { setVal(value === 0 ? '' : String(value)) })
  return (
    <input type="text" inputMode="numeric" value={val}
      onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={() => onSave(parseInt(val, 10) || 0)}
      className="w-full text-right text-sm px-2 py-1 border border-transparent rounded hover:border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
      placeholder="—" />
  )
}

function ManualInput({ date, value, onSave }: { date: string; value: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(value === 0 ? '' : String(value))
  useState(() => { setVal(value === 0 ? '' : String(value)) })
  return (
    <input type="text" inputMode="numeric" value={val}
      onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={() => onSave(parseInt(val, 10) || 0)}
      className="w-full text-right text-sm px-2 py-1 border border-transparent rounded hover:border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
      placeholder="—" />
  )
}

function ExpInput({ date, categoryId, value, onSave }: { date: string; categoryId: string; value: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(value === 0 ? '' : String(value))
  useState(() => { setVal(value === 0 ? '' : String(value)) })
  return (
    <input type="text" inputMode="numeric" value={val}
      onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={() => onSave(parseInt(val, 10) || 0)}
      className="w-full text-right text-sm px-2 py-1 border border-transparent rounded hover:border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
      placeholder="—" />
  )
}
