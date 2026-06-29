'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function inviteUser(email: string): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  const admin = createAdminClient()
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users.find(u => u.email === email)

  if (existing) return { userId: existing.id }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error || !data.user) return { error: `招待に失敗しました: ${error?.message}` }

  return { userId: data.user.id }
}

export async function setUserCompanyAccess(
  targetUserId: string,
  companyId: string,
  grant: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  // 操作者がadminか確認
  const { data: cu } = await supabase.from('company_users').select('role')
    .eq('company_id', companyId).eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return { error: '権限がありません' }

  const admin = createAdminClient()

  if (grant) {
    const { error } = await admin.from('company_users').upsert(
      { company_id: companyId, user_id: targetUserId, role: 'member' },
      { onConflict: 'company_id,user_id', ignoreDuplicates: true }
    )
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('company_users')
      .delete().eq('company_id', companyId).eq('user_id', targetUserId)
    if (error) return { error: error.message }
  }

  return {}
}
