import { DashboardProvider, useDashboard } from './state/DashboardContext';
import { ModalsProvider } from './state/ModalsContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { DemoModeBanner } from './components/layout/DemoModeBanner';
import { MensalTab } from './components/mensal/MensalTab';
import { AnualTab } from './components/anual/AnualTab';
import { TxModal } from './components/modals/TxModal';
import { KpiChartModal } from './components/modals/KpiChartModal';
import { DreModal } from './components/modals/DreModal';
import { AnnualSummaryModal } from './components/modals/AnnualSummaryModal';
import { AiChatWidget } from './components/ai/AiChatWidget';

function DashboardShell() {
  const { state } = useDashboard();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 lg:px-10 py-6">
        <Topbar />
        <DemoModeBanner />
        {state.tab === 'mensal' ? <MensalTab /> : <AnualTab />}
      </main>
      <TxModal />
      <KpiChartModal />
      <DreModal />
      <AnnualSummaryModal />
      <AiChatWidget />
    </div>
  );
}

function App() {
  return (
    <DashboardProvider>
      <ModalsProvider>
        <DashboardShell />
      </ModalsProvider>
    </DashboardProvider>
  );
}

export default App;
