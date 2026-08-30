import { fmtBRL, fmtPct } from '../../lib/format';
import { LUCRO_META } from '../../lib/constants';
import { buildSparkOptions } from '../../lib/chartBuilders';
import { KpiCard } from '../shared/KpiCard';
import { ApexChartBox } from '../charts/ApexChartBox';
import { useModals } from '../../state/ModalsContext';
import { useTxModalActions } from '../../hooks/useTxModalActions';
import type { MensalKpis } from '../../hooks/useMensalKpis';

export function KpiGridMensal({ kpis }: { kpis: MensalKpis }) {
  const { openKpiChart } = useModals();
  const { openTxModal } = useTxModalActions();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        icon="↑"
        label="Entradas"
        value={fmtBRL(kpis.eTot)}
        tone="positive"
        pillText={kpis.entPill}
        sub={<ApexChartBox id="spark-ent" options={buildSparkOptions(kpis.sparkEnt, '#ffffff')} className="-mb-2 -mx-1 opacity-70" />}
        onClick={() => openTxModal('entrada')}
      />
      <KpiCard
        icon="↓"
        label="Saídas"
        value={fmtBRL(kpis.sTot)}
        tone="negative"
        pillText={kpis.saiPill}
        sub={<ApexChartBox id="spark-sai" options={buildSparkOptions(kpis.sparkSai, '#ffffff')} className="-mb-2 -mx-1 opacity-70" />}
        onClick={() => openTxModal('saida')}
      />
      <KpiCard
        icon="◆"
        label="Saldo Líquido"
        value={fmtBRL(kpis.caixaMes)}
        tone="orange"
        pillText="MÊS ATUAL"
        sub={<p className="text-[.7rem] text-white/70 mt-1">{kpis.caixaMesSub}</p>}
        onClick={() => openKpiChart('saldo')}
      />
      <KpiCard
        icon="%"
        label="Lucratividade"
        value={fmtPct(kpis.lucrAvg)}
        tone={kpis.lucrAvg >= LUCRO_META ? 'positive' : 'negative'}
        pillText="CONSOLIDADO"
        sub={<p className="text-[.7rem] text-white/70 mt-1">Média anual</p>}
        onClick={() => openKpiChart('lucratividade')}
      />
      <KpiCard
        icon="↗"
        label="Crescimento"
        value={fmtPct(kpis.crescimentoMes)}
        tone={kpis.crescimentoMes >= 0 ? 'positive' : 'negative'}
        pillText="FINANCEIRO 2026"
        sub={<p className="text-[.7rem] text-white/70 mt-1">{kpis.crescimentoMesSub}</p>}
        onClick={() => openKpiChart('crescimento')}
      />
      <KpiCard
        icon="Σ"
        label="Caixa Total do Ano"
        value={fmtBRL(kpis.caixaAno)}
        tone="info"
        pillText="2026"
        sub={<p className="text-[.7rem] text-white/70 mt-1">Acumulado anual</p>}
      />
    </div>
  );
}
