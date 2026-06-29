import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { getFiscalYearMonths, getCurrentFiscalYear, getDaysInMonth } from '@/lib/fiscalYear'

interface Props {
  searchParams: Promise<{ company?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { company: companyParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyUsers } = await supabase
    .from('company_users').select('company_id').eq('user_id', user.id)
  const companyIds = companyUsers?.map(cu => cu.company_id) ?? []

  const { data: companies } = await supabase
    .from('companies').select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('app_type', 'nichiji')
    .order('name')

  const currentCompany = companyParam
    ? companies?.find(c => c.id === companyParam) ?? companies?.[0]
    : companies?.[0]

  const startMonth = currentCompany?.fiscal_year_start_month ?? 1
  const fiscalYear = getCurrentFiscalYear(startMonth)
  const months = getFiscalYearMonths(fiscalYear, startMonth)
  const allDates = months.flatMap(ym => getDaysInMonth(ym))

  const [{ data: salesData }, { data: expensesData }] = currentCompany
    ? await Promise.all([
        supabase.from('daily_sales').select('date,pos_amount,manual_amount')
          .eq('company_id', currentCompany.id).in('date', allDates),
        supabase.from('daily_expenses').select('date,amount')
          .eq('company_id', currentCompany.id).in('date', allDates),
      ])
    : [{ data: null }, { data: null }]

  return (
    <DashboardClient
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      fiscalYear={fiscalYear}
      fiscalYearMonths={months}
      salesData={salesData ?? []}
      expensesData={expensesData ?? []}
    />
  )
}
