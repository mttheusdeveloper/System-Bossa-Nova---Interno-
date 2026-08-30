import { DashboardProvider, useDashboard } from './state/DashboardContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { MensalTab } from './components/mensal/MensalTab';
import { AnualTab } from './components/anual/AnualTab';

function DashboardShell() {
  const { state } = useDashboard();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 lg:px-10 py-6">
        <Topbar />
        {state.tab === 'mensal' ? <MensalTab /> : <AnualTab />}
      </main>
    </div>
  );
}

function App() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}

export default App;
