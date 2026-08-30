import { fmtBRL, fmtPct } from '../../lib/format';
import { LUCRO_META } from '../../lib/constants';
import { KpiCard } from '../shared/KpiCard';
import { useModals } from '../../state/ModalsContext';
import type { AnualChartsData } from '../../hooks/useAnualChartsData';

// Porta dos 6 KPIs da aba Anual (index.html:236-243). O card "Caixa" (2º)
// mostra `totFL` (faturamento líquido) — assim mesmo no original, mantido fiel.
export function KpiGridAnual({ kpis }: { kpis: AnualChartsData['kpis'] }) {
  const { openKpiChart } = useModals();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard icon="$" label="Fat. Bruto" value={fmtBRL(kpis.totFB)} tone="orange" />
      <KpiCard icon="$" label="Caixa" value={fmtBRL(kpis.totFL)} tone="info" onClick={() => openKpiChart('saldo')} />
      <KpiCard icon="▲" label="EBITDA" value={fmtBRL(kpis.totEB)} tone={kpis.totEB >= 0 ? 'positive' : 'negative'} />
      <KpiCard
        icon="%"
        label="Lucratividade Média"
        value={fmtPct(kpis.lucroAvg)}
        tone={kpis.lucroAvg >= LUCRO_META ? 'positive' : 'negative'}
        onClick={() => openKpiChart('anualLucratividade')}
      />
      <KpiCard icon="↗" label="Investimentos" value={fmtBRL(kpis.totInv)} tone="orange" />
      <KpiCard icon="◌" label="Rendimento" value={fmtBRL(kpis.totRoi)} tone={kpis.totRoi >= 0 ? 'positive' : 'negative'} />
    </div>
  );
}
