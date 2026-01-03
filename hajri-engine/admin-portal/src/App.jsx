import { AppShell } from './components/layout'
import { useAppStore } from './lib/store'
import { 
  Dashboard, 
  SemesterTotals, 
  Batches, 
  Predictions, 
  Logs,
  Debug, 
  Settings 
} from './pages'

export default function App() {
  const { currentTab } = useAppStore()

  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />
      case 'semester-totals':
        return <SemesterTotals />
      case 'batches':
        return <Batches />
      case 'predictions':
        return <Predictions />
      case 'logs':
        return <Logs />
      case 'debug':
        return <Debug />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <AppShell>
      {renderPage()}
    </AppShell>
  )
}
