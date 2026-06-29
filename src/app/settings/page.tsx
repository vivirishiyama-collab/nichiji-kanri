import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UserManagementClient } from '@/components/settings/UserManagementClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // adminの会社一覧を取得
  const { data: adminCUs } = await supabase.from('company_users').select('company_id')
    .eq('user_id', user.id).eq('role', 'admin')
  const adminCompanyIds = adminCUs?.map(c => c.company_id) ?? []
  if (adminCompanyIds.length === 0) redirect('/')

  const { data: companies } = await supabase.from('companies').select('*')
    .in('id', adminCompanyIds).order('name')

  // 全ユーザーと全company_usersを取得
  const admin = createAdminClient()
  const { data: allUsersData } = await admin.auth.admin.listUsers()
  const { data: allCUs } = await admin.from('company_users').select('user_id, company_id, role')
    .in('company_id', adminCompanyIds)

  // ユーザーごとに所属会社をまとめる
  const cuMap: Record<string, { companyId: string; role: string }[]> = {}
  for (const cu of allCUs ?? []) {
    if (!cuMap[cu.user_id]) cuMap[cu.user_id] = []
    cuMap[cu.user_id].push({ companyId: cu.company_id, role: cu.role })
  }

  // 管理対象の会社に属するユーザーのみ
  const targetUserIds = new Set(Object.keys(cuMap))
  const users = (allUsersData?.users ?? [])
    .filter(u => targetUserIds.has(u.id))
    .map(u => ({
      id: u.id,
      email: u.email ?? '',
      companies: cuMap[u.id] ?? [],
    }))

  // ナビ用に自分が見える全会社
  const { data: myCompanies } = await supabase.from('companies').select('*')
    .in('id', adminCompanyIds).order('name')

  return (
    <UserManagementClient
      currentUserId={user.id}
      userEmail={user.email ?? ''}
      companies={companies ?? []}
      myCompanies={myCompanies ?? []}
      initialUsers={users}
    />
  )
}
