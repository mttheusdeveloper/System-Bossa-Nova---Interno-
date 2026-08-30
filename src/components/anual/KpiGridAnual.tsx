import { fmtBRL, fmtPct } from '../../lib/format';
import { moneyClass, lucratividadeClass } from '../../lib/money';
import { KpiCard } from '../shared/KpiCard';
import { useModals } from '../../state/ModalsContext';
import type { AnualChartsData } from '../../hooks/useAnualChartsData';

// Porta dos 6 KPIs da aba Anual (index.html:236-243). O card "Caixa" (2º)
// mostra `totFL` (faturamento líquido) — assim mesmo no original, mantido fiel.
export function KpiGridAnual({ kpis }: { kpis: AnualChartsData['kpis'] }) {
  const { openKpiChart } = useModals();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard icon="$" iconClassName="bg-fuchsia-500/15 text-fuchsia-300" label="Fat. Bruto" value={fmtBRL(kpis.totFB)} valueClassName={moneyClass(kpis.totFB)} accent />
      <KpiCard
        icon="$"
        iconClassName="bg-violet-500/15 text-violet-300"
        label="Caixa"
        value={fmtBRL(kpis.totFL)}
        valueClassName={moneyClass(kpis.totFL)}
        onClick={() => openKpiChart('saldo')}
      />
      <KpiCard icon="▲" iconClassName="bg-emerald-500/15 text-emerald-300" label="EBITDA" value={fmtBRL(kpis.totEB)} valueClassName={moneyClass(kpis.totEB)} />
      <KpiCard
        icon="%"
        iconClassName="bg-lime-500/15 text-lime-300"
        label="Lucratividade Média"
        value={fmtPct(kpis.lucroAvg)}
        valueClassName={lucratividadeClass(kpis.lucroAvg)}
        onClick={() => openKpiChart('anualLucratividade')}
      />
      <KpiCard icon="↗" iconClassName="bg-sky-500/15 text-sky-300" label="Investimentos" value={fmtBRL(kpis.totInv)} valueClassName={moneyClass(kpis.totInv)} />
      <KpiCard icon="◌" iconClassName="bg-emerald-500/15 text-emerald-300" label="Rendimento" value={fmtBRL(kpis.totRoi)} valueClassName={moneyClass(kpis.totRoi)} />
    </div>
  );
}
