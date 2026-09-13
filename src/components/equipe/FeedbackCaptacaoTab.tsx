import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApexOptions } from 'apexcharts';
import { MessageSquareText, Table2, X } from 'lucide-react';
import { ApexChartBox } from '../charts/ApexChartBox';
import { baseAxis, baseGrid } from '../../lib/chartTheme';
import { captacaoDateParts, dateTimestamp, formatDate, normalized } from '../../lib/captacaoFormat';
import { fetchAtasCaptacao, type AtaCaptacao } from '../../lib/captacoes';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import { FilterSelect, type FilterOption } from '../shared/FilterSelect';
import { OriginButton } from '../ui/origin-button';
import { ModalShell } from '../modals/ModalShell';

const ACCENT = '#5CABC4';
const WARN = '#FBBF24';
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_DATE = new Date();
const CURRENT_MONTH_VALUE = `${CURRENT_DATE.getFullYear()}-${String(CURRENT_DATE.getMonth() + 1).padStart(2, '0')}`;
const NO_PROBLEM_VALUES = ['nenhum.', 'nenhum', '-', ''];

// Não existe pesquisa de satisfação/nota numérica nessa tabela — o
// "feedback" real disponível é o texto livre em feedback_cliente (observação
// da equipe sobre a captação) e problemas_solucoes (se algo deu errado).
function hasProblema(row: AtaCaptacao): boolean {
  return !NO_PROBLEM_VALUES.includes(normalized(row.problemas_solucoes));
}

function filterOptions(rows: AtaCaptacao[], field: 'videomaker' | 'empresa'): FilterOption[] {
  return [...new Set(rows.map((row) => (row[field] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((value) => ({ value, label: value }));
}

function monthValue(value: string): string {
  const parts = captacaoDateParts(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : '';
}

function monthOptions(rows: AtaCaptacao[]): FilterOption[] {
  const months = new Map<string, FilterOption & { sortValue: number }>();
  months.set(CURRENT_MONTH_VALUE, {
    value: CURRENT_MONTH_VALUE,
    label: `${MONTH_NAMES[CURRENT_DATE.getMonth()]} de ${CURRENT_DATE.getFullYear()}`,
    sortValue: CURRENT_DATE.getFullYear() * 100 + CURRENT_DATE.getMonth() + 1,
  });

  rows.forEach((row) => {
    const parts = captacaoDateParts(row.data_captacao);
    if (!parts) return;
    const value = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    months.set(value, {
      value,
      label: `${MONTH_NAMES[parts.month - 1]} de ${parts.year}`,
      sortValue: parts.year * 100 + parts.month,
    });
  });

  return [...months.values()].sort((a, b) => b.sortValue - a.sortValue).map(({ value, label }) => ({ value, label }));
}

function buildVideomakerOptions(
  items: { name: string; total: number; comProblema: number }[],
  onSelect: (name: string) => void,
): ApexOptions {
  return {
    chart: {
      type: 'bar',
      height: 280,
      background: 'transparent',
      toolbar: { show: false },
      foreColor: '#9A9A9A',
      fontFamily: 'Roboto',
      stacked: true,
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          const item = config ? items[config.dataPointIndex] : undefined;
          if (item) onSelect(item.name);
        },
      },
    },
    series: [
      { name: 'Sem problemas', data: items.map((item) => item.total - item.comProblema) },
      { name: 'Com problemas', data: items.map((item) => item.comProblema) },
    ],
    colors: [ACCENT, WARN],
    plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '40%' } },
    fill: { opacity: 0.9 },
    dataLabels: { enabled: false },
    grid: baseGrid,
    xaxis: { ...baseAxis, categories: items.map((item) => item.name) },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      decimalsInFloat: 0,
      labels: { style: { colors: '#9A9A9A', fontFamily: 'Roboto', fontSize: '11px' }, formatter: (value: number) => String(Math.round(value)) },
    },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `${value} ${value === 1 ? 'captação' : 'captações'}` } },
    legend: { show: true, position: 'bottom', fontFamily: 'Roboto', labels: { colors: '#C7C7C7' } },
  };
}

export function FeedbackCaptacaoTab() {
  const [rows, setRows] = useState<AtaCaptacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(CURRENT_MONTH_VALUE);
  const [videomaker, setVideomaker] = useState('all');
  const [empresa, setEmpresa] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAtasCaptacao());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o feedback das captações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const videomakers = useMemo(() => filterOptions(rows, 'videomaker'), [rows]);
  const empresas = useMemo(() => filterOptions(rows, 'empresa'), [rows]);
  const months = useMemo(() => monthOptions(rows), [rows]);

  const filteredRows = useMemo(() => {
    return [...rows]
      .filter((row) => {
        if (videomaker !== 'all' && row.videomaker !== videomaker) return false;
        if (empresa !== 'all' && row.empresa !== empresa) return false;
        if (month !== 'all' && monthValue(row.data_captacao) !== month) return false;
        return true;
      })
      .sort((a, b) => dateTimestamp(b.data_captacao) - dateTimestamp(a.data_captacao));
  }, [empresa, month, rows, videomaker]);

  const comProblema = useMemo(() => filteredRows.filter(hasProblema).length, [filteredRows]);

  const videomakerChart = useMemo(() => {
    const map = new Map<string, { name: string; total: number; comProblema: number }>();
    filteredRows.forEach((row) => {
      const key = normalized(row.videomaker);
      const bucket = map.get(key) ?? { name: row.videomaker, total: 0, comProblema: 0 };
      bucket.total += 1;
      if (hasProblema(row)) bucket.comProblema += 1;
      map.set(key, bucket);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredRows]);

  function selectVideomakerFromChart(name: string) {
    setVideomaker(name);
    setDetailsOpen(true);
  }

  const chartOptions = useMemo(() => buildVideomakerOptions(videomakerChart, selectVideomakerFromChart), [videomakerChart]);
  const filtersActive = videomaker !== 'all' || empresa !== 'all' || month !== CURRENT_MONTH_VALUE;

  function clearFilters() {
    setVideomaker('all');
    setEmpresa('all');
    setMonth(CURRENT_MONTH_VALUE);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold tracking-[-0.03em] text-lg">Feedback Captação</h2>
        <p className="text-xs text-[var(--muted-2)] mt-1">Acompanhe as observações e problemas relatados em cada captação.</p>
      </div>

      {loading && rows.length === 0 ? (
        <LoadingSkeleton label="Carregando feedback das captações…" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[190px_190px_minmax(220px,1fr)_auto] gap-3 items-end">
              <FilterSelect label="Mês" value={month} onChange={setMonth} options={months} />
              <FilterSelect label="Videomaker" value={videomaker} onChange={setVideomaker} options={videomakers} />
              <FilterSelect label="Cliente" value={empresa} onChange={setEmpresa} options={empresas} />
              {filtersActive && (
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={clearFilters}>
                  Limpar filtros
                </OriginButton>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              Mostrando <span className="text-[var(--accent)]">{filteredRows.length}</span> de {rows.length}{' '}
              {rows.length === 1 ? 'captação' : 'captações'}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            <SummaryCard label="Total de feedbacks" value={filteredRows.length} />
            <SummaryCard label="Sem problemas relatados" value={filteredRows.length - comProblema} />
            <SummaryCard label="Com problemas relatados" value={comProblema} accent={comProblema > 0} />
          </div>

          <div className="card p-5">
            <h3 className="font-semibold tracking-[-0.025em] mb-3">Captações por videomaker</h3>
            {videomakerChart.length ? (
              <ApexChartBox id="chart-feedback-videomakers" options={chartOptions} className="h-[280px]" />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--muted)]">Sem dados para exibir</div>
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
                  style={{ width: 'min(860px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 3rem)' }}
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
                      <div className="p-12 text-center text-sm text-[var(--muted-2)]">Nenhum registro encontrado com esses filtros.</div>
                    ) : (
                      filteredRows.map((row) => (
                        <div key={row.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <strong className="text-sm text-[var(--text)]">{row.empresa}</strong>
                            <span className="text-xs text-[var(--muted-2)]">
                              {formatDate(row.data_captacao)} · {row.videomaker}
                            </span>
                          </div>
                          <div className="text-sm text-[var(--muted-2)] whitespace-pre-wrap break-words">{row.feedback_cliente || 'Sem feedback registrado.'}</div>
                          {hasProblema(row) && (
                            <div className="mt-2 pt-2 border-t border-[var(--border)]">
                              <div className="kpi-label mb-1 text-[#FBBF24]">Problema relatado</div>
                              <div className="text-sm text-[var(--muted-2)] whitespace-pre-wrap break-words">{row.problemas_solucoes}</div>
                            </div>
                          )}
                        </div>
                      ))
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

function SummaryCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-5 min-h-[94px] flex flex-col justify-between">
      <span className="text-xs text-[var(--muted-2)]">{label}</span>
      <strong className={`text-2xl leading-none tracking-[-0.04em] ${accent ? 'text-[#FBBF24]' : 'text-[var(--text)]'}`}>{value}</strong>
    </div>
  );
}
