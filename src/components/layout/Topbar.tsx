import { useDashboard } from '../../state/DashboardContext';

const TITLES: Record<string, string> = {
  mensal: 'Comparativo Mensal',
  anual: 'Visão Anual 2026',
};

export function Topbar() {
  const { state, reload } = useDashboard();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <div className="section-eyebrow mb-1">Painel ativo</div>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">{TITLES[state.tab]}</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button className="chip-btn" onClick={() => reload()}>
          ↻ Atualizar
        </button>
      </div>
    </div>
  );
}
