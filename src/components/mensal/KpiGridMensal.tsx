import { fmtBRL, fmtPct } from '../../lib/format';
import { moneyClass, lucratividadeClass } from '../../lib/money';
import { buildSparkOptions } from '../../lib/chartBuilders';
import { CHART_THEME } from '../../lib/constants';
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
        iconClassName="bg-emerald-500/15 text-emerald-300"
        pill={<span className="pill pill-up">{kpis.entPill}</span>}
        label="Entradas"
        value={fmtBRL(kpis.eTot)}
        valueClassName="money-pos"
        sub={<ApexChartBox id="spark-ent" options={buildSparkOptions(kpis.sparkEnt, CHART_THEME.positive)} className="-mb-2 -mx-1" />}
        onClick={() => openTxModal('entrada')}
      />
      <KpiCard
        icon="↓"
        iconClassName="bg-rose-500/15 text-rose-300"
        pill={<span className="pill pill-down">{kpis.saiPill}</span>}
        label="Saídas"
        value={fmtBRL(kpis.sTot)}
        valueClassName="money-neg"
        sub={<ApexChartBox id="spark-sai" options={buildSparkOptions(kpis.sparkSai, CHART_THEME.negative)} className="-mb-2 -mx-1" />}
        onClick={() => openTxModal('saida')}
      />
      <KpiCard
        icon="◆"
        iconClassName="bg-fuchsia-500/15 text-fuchsia-300"
        pill={<span className="pill pill-amber">MÊS ATUAL</span>}
        label="Saldo Líquido"
        value={fmtBRL(kpis.caixaMes)}
        valueClassName={moneyClass(kpis.caixaMes)}
        sub={<p className="text-[.7rem] text-[var(--muted)] mt-1">{kpis.caixaMesSub}</p>}
        onClick={() => openKpiChart('saldo')}
      />
      <KpiCard
        icon="%"
        iconClassName="bg-sky-500/15 text-sky-300"
        pill={<span className="pill pill-amber">CONSOLIDADO</span>}
        label="Lucratividade"
        value={fmtPct(kpis.lucrAvg)}
        valueClassName={lucratividadeClass(kpis.lucrAvg)}
        sub={<p className="text-[.7rem] text-[var(--muted)] mt-1">Média anual</p>}
        onClick={() => openKpiChart('lucratividade')}
      />
      <KpiCard
        icon="↗"
        iconClassName="bg-lime-500/15 text-lime-300"
        pill={<span className="pill pill-amber">FINANCEIRO 2026</span>}
        label="Crescimento"
        value={fmtPct(kpis.crescimentoMes)}
        valueClassName={moneyClass(kpis.crescimentoMes)}
        sub={<p className="text-[.7rem] text-[var(--muted)] mt-1">{kpis.crescimentoMesSub}</p>}
        onClick={() => openKpiChart('crescimento')}
      />
      <KpiCard
        icon="Σ"
        iconClassName="bg-amber-500/15 text-amber-300"
        pill={<span className="pill pill-amber">2026</span>}
        label="Caixa Total do Ano"
        value={fmtBRL(kpis.caixaAno)}
        valueClassName={moneyClass(kpis.caixaAno)}
        sub={<p className="text-[.7rem] text-[var(--muted)] mt-1">Acumulado anual</p>}
      />
    </div>
  );
}
