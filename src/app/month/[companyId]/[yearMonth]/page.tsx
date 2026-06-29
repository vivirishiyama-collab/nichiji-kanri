import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MonthClient } from '@/components/month/MonthClient'
import { getDaysInMonth } from '@/lib/fiscalYear'

interface Props {
  params: Promise<{ companyId: string; yearMonth: string }>
}

export default async function MonthPage({ params }: Props) {
  const { companyId, yearMonth } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const days = getDaysInMonth(yearMonth)

  const [
    { data: companyUser },
    { data: company },
    { data: companyUsers },
    { data: categories },
    { data: salesData },
    { data: expensesData },
  ] = await Promise.all([
    supabase.from('company_users').select('role').eq('company_id', companyId).eq('user_id', user.id).single(),
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('company_users').select('company_id').eq('user_id', user.id),
    supabase.from('expense_categories').select('*').eq('company_id', companyId).order('sort_order'),
    supabase.from('daily_sales').select('*').eq('company_id', companyId).in('date', days),
    supabase.from('daily_expenses').select('*').eq('company_id', companyId).in('date', days),
  ])

  if (!companyUser || !company) redirect('/')

  const companyIds = companyUsers?.map(cu => cu.company_id) ?? []
  const { data: companies } = await supabase
    .from('companies').select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')

  return (
    <MonthClient
      company={company}
      companies={companies ?? []}
      userEmail={user.email ?? ''}
      yearMonth={yearMonth}
      days={days}
      categories={categories ?? []}
      salesData={salesData ?? []}
      expensesData={expensesData ?? []}
    />
  )
}
