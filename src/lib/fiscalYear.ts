export function getFiscalYearMonths(fiscalYear: number, startMonth: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const total = startMonth - 1 + i
    const year = fiscalYear + Math.floor(total / 12)
    const month = (total % 12) + 1
    return `${year}-${String(month).padStart(2, '0')}`
  })
}

export function getCurrentFiscalYear(startMonth: number): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= startMonth ? year : year - 1
}

export function getDaysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return Array.from({ length: days }, (_, i) =>
    `${yearMonth}-${String(i + 1).padStart(2, '0')}`
  )
}
