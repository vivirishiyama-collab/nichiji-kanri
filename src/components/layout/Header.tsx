'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company } from '@/lib/types'
import { createCompany } from '@/app/actions/company'
import { Building2, ChevronDown, LogOut, Plus, Home, Settings } from 'lucide-react'

interface Props {
  companies: Company[]
  currentCompany: Company | null
  onCompanyChange: (c: Company) => void
  userEmail?: string
}

export function Header({ companies, currentCompany, onCompanyChange, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAddCompany() {
    if (!newName.trim()) return
    setAdding(true)
    setAddError('')
    const result = await createCompany(newName)
    setAdding(false)
    if (result.error) { setAddError(result.error); return }
    setShowAddDialog(false)
    setNewName('')
    router.refresh()
    if (result.companyId) router.push(`/?company=${result.companyId}`)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50">
            <Home className="w-4 h-4" />
            日次収支
          </button>

          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
              <Building2 className="w-4 h-4" />
              {currentCompany?.name ?? '会社を選択'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-40">
                {companies.map(c => (
                  <button key={c.id} onClick={() => { onCompanyChange(c); setMenuOpen(false) }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${currentCompany?.id === c.id ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}>
                    {c.name}
                  </button>
                ))}
                <button onClick={() => { setShowAddDialog(true); setMenuOpen(false); setAddError('') }}
                  className="block w-full text-left px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 flex items-center gap-1">
                  <Plus className="w-4 h-4 inline mr-1" />会社を追加
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && <span className="text-sm text-gray-500 hidden sm:inline">{userEmail}</span>}
          <button onClick={() => router.push('/settings')}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">
            <Settings className="w-4 h-4" />ユーザー管理
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">
            <LogOut className="w-4 h-4" />ログアウト
          </button>
        </div>
      </header>

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}

      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddDialog(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-800 mb-4">会社を追加</h2>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCompany()}
              placeholder="会社名を入力" autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-2" />
            {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setShowAddDialog(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleAddCompany} disabled={adding || !newName.trim()}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {adding ? '作成中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
