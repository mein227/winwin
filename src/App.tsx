import { useState } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Transactions } from './components/Transactions'
import { Holdings } from './components/Holdings'
import { Cash } from './components/Cash'
import { Allocation } from './components/Allocation'
import { usePortfolio } from './hooks/usePortfolio'
import { usePnlCalendar } from './hooks/usePnlCalendar'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const portfolio = usePortfolio()

  // 放在最外層，切換分頁時也能持續自動更新市價
  const pnl = usePnlCalendar({
    transactions: portfolio.transactions,
    holdings: portfolio.holdings,
    onLatestPrices: portfolio.updatePrices,
  })

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === 'dashboard' && (
        <Dashboard
          exposure={portfolio.exposure.summary}
          holdings={portfolio.holdings}
          transactions={portfolio.transactions}
          pnl={pnl}
          onExport={portfolio.exportPortfolio}
          onImport={portfolio.importPortfolio}
          onClear={portfolio.clearAll}
          onUpdatePrices={portfolio.updatePrices}
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
        <Holdings
          holdings={portfolio.holdings}
          onUpdatePrice={portfolio.updatePrice}
          onUpdatePrices={portfolio.updatePrices}
        />
      )}
      {tab === 'cash' && (
        <Cash
          cashAccounts={portfolio.cashAccounts}
          summary={portfolio.exposure.summary}
          cashRate={portfolio.cashRate}
          onAdd={portfolio.addCashAccount}
          onUpdate={portfolio.updateCashAccount}
          onDelete={portfolio.deleteCashAccount}
        />
      )}
      {tab === 'allocation' && (
        <Allocation
          holdings={portfolio.holdings}
          exposure={portfolio.exposure}
          rebalance={portfolio.rebalance}
          assetSettings={portfolio.assetSettings}
          settings={portfolio.settings}
          cashRate={portfolio.cashRate}
          onSetAssetOverride={portfolio.setAssetOverride}
          onResetAssetOverride={portfolio.resetAssetOverride}
          onSetTargetWeight={portfolio.setTargetWeight}
          onApplyTargetWeights={portfolio.applyTargetWeights}
          onClearTargetWeights={portfolio.clearTargetWeights}
          onUpdateSettings={portfolio.updateSettings}
        />
      )}
    </Layout>
  )
}
