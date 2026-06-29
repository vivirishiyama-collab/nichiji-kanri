import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompanyMembers } from '@/app/actions/users'
import { MembersClient } from '@/components/settings/MembersClient'

interface Props {
  params: Promise<{ companyId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { companyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase.from('company_users').select('role')
    .eq('company_id', companyId).eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') redirect('/')

  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (!company) redirect('/')

  const { data: companyUsers } = await supabase.from('company_users').select('company_id').eq('user_id', user.id)
  const companyIds = companyUsers?.map(c => c.company_id) ?? []
  const { data: companies } = await supabase.from('companies').select('*')
    .in('id', companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')

  const members = await getCompanyMembers(companyId)

  return (
    <MembersClient
      company={company}
      companies={companies ?? []}
      currentUserId={user.id}
      userEmail={user.email ?? ''}
      members={members}
    />
  )
}
