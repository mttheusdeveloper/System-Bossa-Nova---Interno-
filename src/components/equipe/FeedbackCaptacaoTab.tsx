import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApexOptions } from 'apexcharts';
import { CheckCircle2, Clock3, MessageSquareText, Table2, X } from 'lucide-react';
import { ApexChartBox } from '../charts/ApexChartBox';
import { baseAxis, baseGrid } from '../../lib/chartTheme';
import { fetchRespostasPesquisa, type RespostaPesquisa } from '../../lib/respostasPesquisa';
import { fetchAtasCaptacao, type AtaCaptacao } from '../../lib/captacoes';
import { captacaoDateParts } from '../../lib/captacaoFormat';
import { buildFeedbackCoverage } from '../../lib/feedbackCoverage';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import { FilterSelect, type FilterOption } from '../shared/FilterSelect';
import { OriginButton } from '../ui/origin-button';
import { ModalShell } from '../modals/ModalShell';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_DATE = new Date();
const CURRENT_MONTH_VALUE = `${CURRENT_DATE.getFullYear()}-${String(CURRENT_DATE.getMonth() + 1).padStart(2, '0')}`;
const CATEGORIA_CORES = { captacao: '#5CABC4', videomaker: '#34D399', equipe: '#A78BFA' };

function monthValue(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions(rows: RespostaPesquisa[], captacoes: AtaCaptacao[]): FilterOption[] {
  const months = new Map<string, FilterOption & { sortValue: number }>();

  function addMonth(year: number, month: number) {
    const value = `${year}-${String(month).padStart(2, '0')}`;
    months.set(value, {
      value,
      label: `${MONTH_NAMES[month - 1]} de ${year}`,
      sortValue: year * 100 + month,
    });
  }

  addMonth(CURRENT_DATE.getFullYear(), CURRENT_DATE.getMonth() + 1);

  rows.forEach((row) => {
    const date = new Date(row.created_at);
    if (!Number.isNaN(date.getTime())) addMonth(date.getFullYear(), date.getMonth() + 1);
  });

  captacoes.forEach((row) => {
    const parts = captacaoDateParts(row.data_captacao);
    if (parts) addMonth(parts.year, parts.month);
  });

  return [...months.values()].sort((a, b) => b.sortValue - a.sortValue).map(({ value, label }) => ({ value, label }));
}

function captacaoMonthValue(value: string): string | null {
  const parts = captacaoDateParts(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : null;
}

function empresaOptions(rows: RespostaPesquisa[]): FilterOption[] {
  return [...new Set(rows.map((row) => (row.empresa || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((value) => ({ value, label: value }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildNotasOptions(medias: { captacao: number; videomaker: number; equipe: number }): ApexOptions {
  const items = [
    { name: 'Captação', value: medias.captacao, color: CATEGORIA_CORES.captacao },
    { name: 'Videomaker', value: medias.videomaker, color: CATEGORIA_CORES.videomaker },
    { name: 'Equipe', value: medias.equipe, color: CATEGORIA_CORES.equipe },
  ];
  return {
    chart: { type: 'bar', height: 280, background: 'transparent', toolbar: { show: false }, foreColor: '#9A9A9A', fontFamily: 'Roboto' },
    series: [{ name: 'Nota média', data: items.map((item) => Number(item.value.toFixed(2))) }],
    colors: items.map((item) => item.color),
    plotOptions: { bar: { distributed: true, borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '40%' } },
    fill: { opacity: 0.9 },
    dataLabels: { enabled: false },
    grid: baseGrid,
    xaxis: { ...baseAxis, categories: items.map((item) => item.name) },
    yaxis: {
      min: 0,
      max: 10,
      forceNiceScale: false,
      tickAmount: 5,
      labels: { style: { colors: '#9A9A9A', fontFamily: 'Roboto', fontSize: '11px' } },
    },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => value.toFixed(1) } },
    legend: { show: false },
  };
}

export function FeedbackCaptacaoTab() {
  const [rows, setRows] = useState<RespostaPesquisa[]>([]);
  const [captacoes, setCaptacoes] = useState<AtaCaptacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(CURRENT_MONTH_VALUE);
  const [empresa, setEmpresa] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [respostasResult, captacoesResult] = await Promise.all([fetchRespostasPesquisa(), fetchAtasCaptacao()]);
      setRows(respostasResult);
      setCaptacoes(captacoesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as respostas da pesquisa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => monthOptions(rows, captacoes), [captacoes, rows]);
  const empresas = useMemo(() => empresaOptions(rows), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (month !== 'all' && monthValue(row.created_at) !== month) return false;
      if (empresa !== 'all' && (row.empresa || '') !== empresa) return false;
      return true;
    });
  }, [empresa, month, rows]);

  const medias = useMemo(
    () => ({
      captacao: average(filteredRows.map((row) => row.nota_captacao)),
      videomaker: average(filteredRows.map((row) => row.nota_videomaker)),
      equipe: average(filteredRows.map((row) => row.nota_equipe)),
    }),
    [filteredRows],
  );

  const comentarios = useMemo(() => filteredRows.filter((row) => (row.melhorias || '').trim()), [filteredRows]);
  const coverageCaptacoes = useMemo(
    () => captacoes.filter((row) => month === 'all' || captacaoMonthValue(row.data_captacao) === month),
    [captacoes, month],
  );
  const coverageResponses = useMemo(
    () => rows.filter((row) => month === 'all' || monthValue(row.created_at) === month),
    [month, rows],
  );
  const coverage = useMemo(
    () => buildFeedbackCoverage(coverageCaptacoes, coverageResponses),
    [coverageCaptacoes, coverageResponses],
  );
  const coveragePeriod = month === 'all' ? 'Todo o histórico' : months.find((option) => option.value === month)?.label || month;
  const coverageDescription =
    month === 'all'
      ? `${coveragePeriod}: comparação entre todas as atas de captação e todas as respostas recebidas.`
      : `${coveragePeriod}: comparação entre as atas e as respostas recebidas no mesmo mês.`;

  const chartOptions = useMemo(() => buildNotasOptions(medias), [medias]);
  const filtersActive = month !== CURRENT_MONTH_VALUE || empresa !== 'all';

  function clearFilters() {
    setMonth(CURRENT_MONTH_VALUE);
    setEmpresa('all');
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold tracking-[-0.03em] text-lg">Feedback Captação</h2>
        <p className="text-xs text-[var(--muted-2)] mt-1">Acompanhe as notas e comentários da pesquisa de satisfação.</p>
      </div>

      {loading && rows.length === 0 && captacoes.length === 0 ? (
        <LoadingSkeleton label="Carregando respostas da pesquisa…" />
      ) : error ? (
        <div className="card p-8 text-center">
          <MessageSquareText className="w-8 h-8 mx-auto text-[#F87171] mb-3" />
          <p className="text-sm text-[#F87171]">{error}</p>
          <p className="text-xs text-[var(--muted)] mt-2">Confira se a tabela possui permissão SELECT para a chave usada pelo site.</p>
          <button className="chip-btn mt-4" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[190px_minmax(220px,1fr)_auto] gap-3 items-end">
              <FilterSelect label="Mês" value={month} onChange={setMonth} options={months} />
              <FilterSelect label="Empresa" value={empresa} onChange={setEmpresa} options={empresas} />
              {filtersActive && (
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={clearFilters}>
                  Limpar filtro
                </OriginButton>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              Mostrando <span className="text-[var(--accent)]">{filteredRows.length}</span> de {rows.length}{' '}
              {rows.length === 1 ? 'resposta' : 'respostas'}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard label="Total de respostas" value={String(filteredRows.length)} />
            <SummaryCard label="Nota média · Captação" value={medias.captacao.toFixed(1)} tone={CATEGORIA_CORES.captacao} />
            <SummaryCard label="Nota média · Videomaker" value={medias.videomaker.toFixed(1)} tone={CATEGORIA_CORES.videomaker} />
            <SummaryCard label="Nota média · Equipe" value={medias.equipe.toFixed(1)} tone={CATEGORIA_CORES.equipe} />
          </div>

          <FeedbackCoveragePanel coverage={coverage} description={coverageDescription} />

          <div className="card p-5">
            <h3 className="font-semibold tracking-[-0.025em] mb-3">Notas médias por categoria</h3>
            {filteredRows.length ? (
              <ApexChartBox id="chart-feedback-notas" options={chartOptions} className="h-[280px]" />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--muted)]">Sem dados para exibir</div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold tracking-[-0.025em] mb-3">
              Comentários e sugestões <span className="text-[var(--muted-2)] font-normal">· {comentarios.length}</span>
            </h3>
            {comentarios.length ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {comentarios.map((row) => (
                  <FeedbackCard key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)] text-center py-6">Nenhum comentário escrito nesse período.</div>
            )}
          </div>

          <button type="button" className="chip-btn" onClick={() => setDetailsOpen(true)}>
            <Table2 className="w-3.5 h-3.5" />
            Ver respostas detalhadas
            <span className="pill">{filteredRows.length}</span>
          </button>

          {detailsOpen &&
            createPortal(
              <ModalShell onBackdropClick={() => setDetailsOpen(false)}>
                <div
                  id="feedback-details-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="feedback-details-title"
                  className="card flex flex-col overflow-hidden shadow-2xl"
                  style={{ width: 'min(960px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 3rem)' }}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
                    <div>
                      <h3 id="feedback-details-title" className="font-semibold tracking-[-0.025em] text-lg">
                        Respostas detalhadas
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {filteredRows.length} {filteredRows.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                      </p>
                    </div>
                    <OriginButton
                      autoFocus
                      aria-label="Fechar respostas detalhadas"
                      className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:#fff]"
                      onClick={() => setDetailsOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </OriginButton>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
                    {filteredRows.length === 0 ? (
                      <div className="p-12 text-center text-sm text-[var(--muted-2)]">Nenhuma resposta encontrada com esses filtros.</div>
                    ) : (
                      filteredRows.map((row) => <FeedbackCard key={row.id} row={row} />)
                    )}
                  </div>
                </div>
              </ModalShell>,
              document.body,
            )}
        </>
      )}
    </section>
  );
}

function FeedbackCoveragePanel({
  coverage,
  description,
}: {
  coverage: ReturnType<typeof buildFeedbackCoverage>;
  description: string;
}) {
  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-semibold tracking-[-0.025em]">Cobertura do feedback</h3>
          <p className="text-xs text-[var(--muted-2)] mt-1">{description}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <CoverageMetric label="Clientes" value={coverage.totalClients} />
          <CoverageMetric label="Responderam" value={coverage.respondedClients.length} tone="#34D399" />
          <CoverageMetric label="Faltam" value={coverage.missingClients.length} tone="#FBBF24" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CoverageList
          title="Já responderam"
          clients={coverage.respondedClients}
          icon={<CheckCircle2 className="h-4 w-4 text-[#34D399]" />}
          countTone="#34D399"
          emptyText="Nenhum cliente respondeu ainda."
        />
        <CoverageList
          title="Não responderam"
          clients={coverage.missingClients}
          icon={<Clock3 className="h-4 w-4 text-[#FBBF24]" />}
          countTone="#FBBF24"
          emptyText="Todos os clientes já responderam."
        />
      </div>

      {coverage.unmatchedRespondents.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted-2)]">
          <span className="font-medium text-[var(--text)]">Respostas sem ata correspondente:</span>{' '}
          {coverage.unmatchedRespondents.join(', ')}
        </div>
      )}
    </div>
  );
}

function CoverageMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-center">
      <strong className="block text-xl leading-none tracking-[-0.04em]" style={{ color: tone || 'var(--text)' }}>
        {value}
      </strong>
      <span className="mt-1.5 block text-[.68rem] text-[var(--muted-2)]">{label}</span>
    </div>
  );
}

function CoverageList({
  title,
  clients,
  icon,
  countTone,
  emptyText,
}: {
  title: string;
  clients: string[];
  icon: React.ReactNode;
  countTone: string;
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="ml-auto text-sm font-semibold" style={{ color: countTone }}>
          {clients.length}
        </span>
      </div>

      {clients.length > 0 ? (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
          {clients.map((client) => (
            <li key={client} className="flex items-start gap-2 text-xs leading-5 text-[var(--muted-2)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: countTone }} />
              <span>{client}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--muted-2)]">{emptyText}</p>
      )}
    </div>
  );
}

function FeedbackCard({ row }: { row: RespostaPesquisa }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <strong className="text-sm text-[var(--text)]">{row.empresa || 'Sem empresa'}</strong>
        <span className="text-xs text-[var(--muted-2)]">
          {formatDate(row.created_at)} {row.nome ? `· ${row.nome}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-4 text-xs mb-2">
        <span style={{ color: CATEGORIA_CORES.captacao }}>Captação: {row.nota_captacao}</span>
        <span style={{ color: CATEGORIA_CORES.videomaker }}>Videomaker: {row.nota_videomaker}</span>
        <span style={{ color: CATEGORIA_CORES.equipe }}>Equipe: {row.nota_equipe}</span>
      </div>
      {row.melhorias && (
        <div className="text-sm text-[var(--muted-2)] whitespace-pre-wrap break-words pt-2 border-t border-[var(--border)]">{row.melhorias}</div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-5 min-h-[94px] flex flex-col justify-between">
      <span className="text-xs text-[var(--muted-2)]">{label}</span>
      <strong className="text-2xl leading-none tracking-[-0.04em]" style={{ color: tone || 'var(--text)' }}>
        {value}
      </strong>
    </div>
  );
}
