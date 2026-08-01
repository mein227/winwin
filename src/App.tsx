import { useState } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Transactions } from './components/Transactions'
import { Holdings } from './components/Holdings'
import { Allocation } from './components/Allocation'
import { usePortfolio } from './hooks/usePortfolio'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const portfolio = usePortfolio()

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === 'dashboard' && (
        <Dashboard
          summary={portfolio.summary}
          holdings={portfolio.holdings}
          transactions={portfolio.transactions}
          onExport={portfolio.exportPortfolio}
          onImport={portfolio.importPortfolio}
          onClear={portfolio.clearAll}
        />
      )}
      {tab === 'transactions' && (
        <Transactions
          transactions={portfolio.transactions}
          onAdd={portfolio.addTransaction}
          onUpdate={portfolio.updateTransaction}
          onDelete={portfolio.deleteTransaction}
        />
      )}
      {tab === 'holdings' && (
        <Holdings holdings={portfolio.holdings} onUpdatePrice={portfolio.updatePrice} />
      )}
      {tab === 'allocation' && (
        <Allocation holdings={portfolio.holdings} summary={portfolio.summary} />
      )}
    </Layout>
  )
}
