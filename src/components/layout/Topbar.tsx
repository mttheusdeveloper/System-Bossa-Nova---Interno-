import { useDashboard } from '../../state/DashboardContext';
import { OriginButton } from '../ui/origin-button';

const TITLES: Record<string, string> = {
  mensal: 'Comparativo Mensal',
  anual: 'Visão Anual 2026',
  contratos: 'Contratos',
  captacao: 'Relatório de Captações',
  drive: 'Google Drive',
  sheets: 'Planilhas',
};

// Abas que não usam o "Atualizar" (recarrega Supabase) — têm o próprio botão
// de conectar/recarregar do Google.
const SELF_MANAGED_TABS = new Set(['contratos', 'captacao', 'drive', 'sheets']);

export function Topbar() {
  const { state, reload } = useDashboard();
  const isMensal = state.tab === 'mensal';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-6 ${isMensal ? 'mensal-topbar' : ''}`}>
      <div>
        <div className={isMensal ? 'mensal-topbar-eyebrow' : 'section-eyebrow mb-1'}>{isMensal ? 'Gestão financeira' : 'Painel ativo'}</div>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">{TITLES[state.tab]}</h1>
        {isMensal && <p>Acompanhe entradas, saídas, resultados e tendências da Bossa Nova.</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {!isMensal && !SELF_MANAGED_TABS.has(state.tab) ? (
          <>
            <button className="chip-btn" onClick={() => reload()}>
              ↻ Atualizar
            </button>
            <OriginButton className="h-8.5 px-4 text-[.8125rem]" onClick={() => reload()}>
              ↻ Atualizar
            </OriginButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
