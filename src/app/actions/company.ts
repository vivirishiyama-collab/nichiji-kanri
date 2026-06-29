'use server'

import { createClient } from '@/lib/supabase/server'

export async function createCompany(name: string): Promise<{ error?: string; companyId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ログインが必要です' }

  const trimmed = name.trim()
  if (!trimmed) return { error: '会社名を入力してください' }

  const slug = `company-${Date.now()}`
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({ name: trimmed, slug, fiscal_year_start_month: 1, app_type: 'nichiji' })
    .select().single()

  if (companyErr || !company) return { error: `作成に失敗しました: ${companyErr?.message}` }

  await supabase.from('company_users').insert({ company_id: company.id, user_id: user.id, role: 'admin' })

  return { companyId: company.id }
}
