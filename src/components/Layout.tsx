import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Briefcase,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import type { TabId } from '../types'

interface LayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '總覽', icon: LayoutDashboard },
  { id: 'transactions', label: '進出紀錄', icon: ArrowLeftRight },
  { id: 'holdings', label: '持股明細', icon: Briefcase },
  { id: 'allocation', label: '資產配置', icon: PieChart },
]

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0b1220]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -right-20 top-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <header className="relative border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                WinWin
              </h1>
              <p className="text-xs text-slate-400">個股進出・資產獲利・報酬率・配置</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1 md:flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium ${
                  active ? 'text-teal-300' : 'text-slate-500'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-teal-300' : ''}`} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="h-20 md:hidden" />
    </div>
  )
}
