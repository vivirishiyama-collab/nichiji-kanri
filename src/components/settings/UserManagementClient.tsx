'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/lib/types'
import { Header } from '@/components/layout/Header'
import { inviteUser, setUserCompanyAccess } from '@/app/actions/users'
import { Users, UserPlus } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  companies: { companyId: string; role: string }[]
}

interface Props {
  currentUserId: string
  userEmail: string
  companies: Company[]
  myCompanies: Company[]
  initialUsers: UserRow[]
}

export function UserManagementClient({ currentUserId, userEmail, companies, myCompanies, initialUsers }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [toggling, setToggling] = useState<string>('')

  async function handleInvite() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    const result = await inviteUser(email.trim())
    setLoading(false)
    if (result.error) { setError(result.error); return }

    setSuccess(`${email} を招待しました。下の一覧から店舗を割り当ててください。`)
    setEmail('')
    router.refresh()
  }

  async function handleToggle(userId: string, companyId: string, currentlyGranted: boolean) {
    const key = `${userId}-${companyId}`
    setToggling(key)
    const result = await setUserCompanyAccess(userId, companyId, !currentlyGranted)
    setToggling('')
    if (result.error) { alert(result.error); return }

    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const newCompanies = currentlyGranted
        ? u.companies.filter(c => c.companyId !== companyId)
        : [...u.companies, { companyId, role: 'member' }]
      return { ...u, companies: newCompanies }
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        companies={myCompanies}
        currentCompany={null}
        onCompanyChange={c => router.push(`/month/${c.id}/${new Date().toISOString().substring(0, 7)}`)}
        userEmail={userEmail}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-800">ユーザー管理</h1>
        </div>

        {/* 招待フォーム */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />
            ユーザーを招待
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
        </div>

        {/* ユーザー×店舗 一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-600">ユーザー一覧（{users.length}人）</span>
          </div>

          {users.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">ユーザーがいません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 font-medium text-gray-500 w-1/2">メールアドレス</th>
                  {companies.map(c => (
                    <th key={c.id} className="text-center px-3 py-2.5 font-medium text-gray-500 whitespace-nowrap">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className={u.id === currentUserId ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-5 py-3 text-gray-800">
                      {u.email}
                      {u.id === currentUserId && <span className="ml-2 text-xs text-blue-500">(あなた)</span>}
                    </td>
                    {companies.map(c => {
                      const granted = u.companies.some(uc => uc.companyId === c.id)
                      const key = `${u.id}-${c.id}`
                      const isAdmin = u.companies.find(uc => uc.companyId === c.id)?.role === 'admin'
                      return (
                        <td key={c.id} className="text-center px-3 py-3">
                          {isAdmin ? (
                            <span className="text-xs text-blue-600 font-medium">管理者</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={toggling === key}
                              onChange={() => handleToggle(u.id, c.id, granted)}
                              className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-50"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
