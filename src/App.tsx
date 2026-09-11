import { DashboardProvider, useDashboard } from './state/DashboardContext';
import { ModalsProvider } from './state/ModalsContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { LoadingSkeleton } from './components/shared/LoadingSkeleton';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { DemoModeBanner } from './components/layout/DemoModeBanner';
import { MensalTab } from './components/mensal/MensalTab';
import { AnualTab } from './components/anual/AnualTab';
import { ContratosTab } from './components/contratos/ContratosTab';
import { CaptacaoTab } from './components/captacao/CaptacaoTab';
import { DriveTab } from './components/drive/DriveTab';
import { SheetsTab } from './components/drive/SheetsTab';
import { DesignersTab } from './components/equipe/DesignersTab';
import { EdicoesTab } from './components/equipe/EdicoesTab';
import { FeedbackCaptacaoTab } from './components/equipe/FeedbackCaptacaoTab';
import { VecPlanilhaTab } from './components/vec/VecPlanilhaTab';
import { VecCustosTab } from './components/vec/VecCustosTab';
import { TxModal } from './components/modals/TxModal';
import { KpiChartModal } from './components/modals/KpiChartModal';
import { DreModal } from './components/modals/DreModal';
import { AnnualSummaryModal } from './components/modals/AnnualSummaryModal';
import { ContractDetailModal } from './components/modals/ContractDetailModal';
import { AiChatWidget } from './components/ai/AiChatWidget';

function DashboardShell() {
  const { state } = useDashboard();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 lg:px-10 py-6">
        {state.tab !== 'vec-planilha' && state.tab !== 'vec-custos' && <Topbar />}
        {state.tab === 'mensal' || state.tab === 'anual' ? <DemoModeBanner /> : null}
        {state.tab === 'mensal' && <MensalTab />}
        {state.tab === 'anual' && <AnualTab />}
        {state.tab === 'contratos' && <ContratosTab />}
        {state.tab === 'captacao' && <CaptacaoTab />}
        {state.tab === 'drive' && <DriveTab />}
        {state.tab === 'sheets' && <SheetsTab />}
        {state.tab === 'designers' && <DesignersTab />}
        {state.tab === 'edicoes' && <EdicoesTab />}
        {state.tab === 'feedback-captacao' && <FeedbackCaptacaoTab />}
        {state.tab === 'vec-planilha' && <VecPlanilhaTab />}
        {state.tab === 'vec-custos' && <VecCustosTab />}
      </main>
      <TxModal />
      <KpiChartModal />
      <DreModal />
      <AnnualSummaryModal />
      <ContractDetailModal />
      <AiChatWidget />
    </div>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <LoadingSkeleton label="Carregando…" />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <DashboardProvider>
      <ModalsProvider>
        <DashboardShell />
      </ModalsProvider>
    </DashboardProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
