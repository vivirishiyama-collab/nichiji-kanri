'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function inviteUser(email: string, companyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  // 招待者がadminかチェック
  const { data: cu } = await supabase
    .from('company_users').select('role')
    .eq('company_id', companyId).eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return { error: '権限がありません' }

  const admin = createAdminClient()

  // ユーザーが既に存在するか確認
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users.find(u => u.email === email)

  let targetUserId: string

  if (existing) {
    targetUserId = existing.id
  } else {
    // 招待メール送信
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
    if (error || !data.user) return { error: `招待に失敗しました: ${error?.message}` }
    targetUserId = data.user.id
  }

  // company_usersに追加（既存なら無視）
  const { error: cuErr } = await admin.from('company_users').upsert(
    { company_id: companyId, user_id: targetUserId, role: 'member' },
    { onConflict: 'company_id,user_id', ignoreDuplicates: true }
  )
  if (cuErr) return { error: `店舗への追加に失敗しました: ${cuErr.message}` }

  return {}
}

export async function removeUser(targetUserId: string, companyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  const { data: cu } = await supabase
    .from('company_users').select('role')
    .eq('company_id', companyId).eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return { error: '権限がありません' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_users')
    .delete().eq('company_id', companyId).eq('user_id', targetUserId)
  if (error) return { error: `削除に失敗しました: ${error.message}` }

  return {}
}

export async function getCompanyMembers(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data: cuList } = await admin.from('company_users')
    .select('user_id, role').eq('company_id', companyId)
  if (!cuList) return []

  const { data: allUsers } = await admin.auth.admin.listUsers()
  const userMap = new Map(allUsers?.users.map(u => [u.id, u.email ?? '']) ?? [])

  return cuList.map(cu => ({
    userId: cu.user_id,
    email: userMap.get(cu.user_id) ?? '(不明)',
    role: cu.role as string,
  }))
}
