'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { inviteUser, removeUser } from '@/app/actions/users'
import { Users, Trash2, UserPlus } from 'lucide-react'

interface Member {
  userId: string
  email: string
  role: string
}

interface Props {
  company: Company
  companies: Company[]
  currentUserId: string
  userEmail: string
  members: Member[]
}

export function MembersClient({ company, companies, currentUserId, userEmail, members: initialMembers }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleInvite() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    const result = await inviteUser(email.trim(), company.id)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setSuccess(`${email} を招待しました`)
    setEmail('')
    router.refresh()
  }

  async function handleRemove(userId: string, memberEmail: string) {
    if (!confirm(`${memberEmail} をこの店舗から削除しますか？`)) return
    const result = await removeUser(userId, company.id)
    if (result.error) { alert(result.error); return }
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={companies}
        currentCompany={company}
        onCompanyChange={c => router.push(`/settings/${c.id}`)}
        userEmail={userEmail}
      />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-800">{company.name}のメンバー管理</h1>
        </div>

        {/* 招待フォーム */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            メンバーを招待
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              placeholder="メールアドレスを入力"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={handleInvite}
              disabled={loading || !email.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? '送信中...' : '招待'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {success && <p className="text-xs text-green-600 mt-2">{success}</p>}
          <p className="text-xs text-gray-400 mt-2">
            ※ 未登録のメールアドレスには招待メールが送信されます
          </p>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-600">現在のメンバー（{members.length}人）</span>
          </div>
          {members.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">メンバーがいません</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map(m => (
                <li key={m.userId} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.email}</p>
                    <p className="text-xs text-gray-400">{m.role === 'admin' ? '管理者' : 'メンバー'}</p>
                  </div>
                  {m.userId !== currentUserId && (
                    <button
                      onClick={() => handleRemove(m.userId, m.email)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
