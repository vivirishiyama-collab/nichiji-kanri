'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/lib/types'
import { Header } from '@/components/layout/Header'

interface Props {
  companies: Company[]
  userEmail: string
  fiscalYear: number
  fiscalYearMonths: string[]
  salesData: { date: string; pos_amount: number; manual_amount: number }[]
  expensesData: { date: string; amount: number }[]
}

function fmt(n: number) { return n.toLocaleString() }

export function DashboardClient({ companies, userEmail, fiscalYear, fiscalYearMonths, salesData, expensesData }: Props) {
  const router = useRouter()
  const [currentCompany, setCurrentCompany] = useState<Company | null>(companies[0] ?? null)

  // 月ごとに集計
  const monthlySales = fiscalYearMonths.map(ym => {
    const rows = salesData.filter(r => r.date.startsWith(ym))
    return rows.reduce((s, r) => s + r.pos_amount + r.manual_amount, 0)
  })
  const monthlyExpenses = fiscalYearMonths.map(ym => {
    const rows = expensesData.filter(r => r.date.startsWith(ym))
    return rows.reduce((s, r) => s + r.amount, 0)
  })
  const monthlyProfit = fiscalYearMonths.map((_, i) => monthlySales[i] - monthlyExpenses[i])

  const totalSales = monthlySales.reduce((a, b) => a + b, 0)
  const totalExpenses = monthlyExpenses.reduce((a, b) => a + b, 0)
  const totalProfit = totalSales - totalExpenses

  const currentYM = new Date().toISOString().slice(0, 7)
  const firstRow = fiscalYearMonths.slice(0, 6)
  const secondRow = fiscalYearMonths.slice(6, 12)

  function goMonth(ym: string) {
    if (!currentCompany) return
    router.push(`/month/${currentCompany.id}/${ym}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={currentCompany}
        onCompanyChange={c => { setCurrentCompany(c); router.push(`/?company=${c.id}`) }}
        userEmail={userEmail}
      />

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {!currentCompany ? (
          <div className="text-center text-gray-400 py-20">所属する会社がありません</div>
        ) : (
          <>
            {/* 月カード */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-4">月を選んで入力・確認</h2>
              {[firstRow, secondRow].map((row, ri) => (
                <div key={ri} className="grid grid-cols-6 gap-3 mb-3 last:mb-0">
                  {row.map(ym => {
                    const [y, m] = ym.split('-')
                    const isCurrentMonth = ym === currentYM
                    const i = fiscalYearMonths.indexOf(ym)
                    const sales = monthlySales[i]
                    const profit = monthlyProfit[i]
                    return (
                      <button key={ym} onClick={() => goMonth(ym)}
                        className={`rounded-lg border p-3 text-left transition-colors hover:bg-blue-50 hover:border-blue-300 ${isCurrentMonth ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="text-xs text-gray-400">{y}年</div>
                        <div className={`text-base font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}`}>
                          {parseInt(m)}月{isCurrentMonth && <span className="text-xs font-normal ml-1">今月</span>}
                        </div>
                        {sales > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            <div>売 {Math.round(sales/10000)}万</div>
                            <div className={profit < 0 ? 'text-red-500' : 'text-green-600'}>利 {Math.round(profit/10000)}万</div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 年間サマリー */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-base font-semibold text-gray-700">{fiscalYear}年度　年間サマリー</h2>
              </div>
              {totalSales === 0 && totalExpenses === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">まだデータがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-2 text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10" style={{ width: 80, minWidth: 80 }}>項目</th>
                        <th className="text-right px-4 py-2 text-gray-700 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200" style={{ width: 100, minWidth: 100, left: 80 }}>年間合計</th>
                        {fiscalYearMonths.map(m => (
                          <th key={m} className="text-right px-3 py-2 text-gray-500 font-medium" style={{ width: 80, minWidth: 80 }}>
                            <button onClick={() => goMonth(m)} className="hover:text-blue-600 hover:underline">
                              {parseInt(m.split('-')[1])}月
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: '売上', values: monthlySales, total: totalSales, bold: true, neg: false },
                        { label: '経費', values: monthlyExpenses, total: totalExpenses, bold: false, neg: false },
                        { label: '利益', values: monthlyProfit, total: totalProfit, bold: true, neg: totalProfit < 0 },
                      ].map((row, ri) => (
                        <tr key={ri} className={`border-b ${row.bold && ri > 0 ? 'border-t-2 border-t-blue-100' : ''} ${row.bold ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className={`px-4 py-2 sticky left-0 z-10 ${row.bold ? 'bg-blue-50 font-semibold text-gray-800' : 'bg-white text-gray-600'}`}>{row.label}</td>
                          <td className={`text-right px-4 py-2 font-semibold bg-gray-100 sticky z-10 border-r border-gray-200 ${row.neg ? 'text-red-600' : 'text-gray-800'}`} style={{ left: 80 }}>
                            {row.total === 0 ? <span className="text-gray-300 font-normal">—</span> : fmt(row.total)}
                          </td>
                          {row.values.map((v, i) => (
                            <td key={i} className={`text-right px-3 py-2 ${row.bold ? 'font-semibold' : ''} ${v < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {v === 0 ? <span className="text-gray-200">—</span> : fmt(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
