import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApexOptions } from 'apexcharts';
import { Film, Table2, X } from 'lucide-react';
import { ApexChartBox } from '../charts/ApexChartBox';
import { baseAxis, baseGrid } from '../../lib/chartTheme';
import { captacaoDateParts, formatDate, normalized } from '../../lib/captacaoFormat';
import { fetchRelatorioEdicao, parseEdicaoName, type RelatorioEdicaoRow } from '../../lib/relatorioEdicao';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import { FilterSelect, type FilterOption } from '../shared/FilterSelect';
import { OriginButton } from '../ui/origin-button';
import { ModalShell } from '../modals/ModalShell';

const ACCENT = '#5CABC4';
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CURRENT_DATE = new Date();
const CURRENT_MONTH_VALUE = `${CURRENT_DATE.getFullYear()}-${String(CURRENT_DATE.getMonth() + 1).padStart(2, '0')}`;

interface EnrichedRow extends RelatorioEdicaoRow {
  cliente: string;
}

function enrich(rows: RelatorioEdicaoRow[]): EnrichedRow[] {
  return rows.map((row) => ({ ...row, cliente: parseEdicaoName(row.name) }));
}

function filterOptions(rows: EnrichedRow[], field: 'editor' | 'cliente'): FilterOption[] {
  return [...new Set(rows.map((row) => (row[field] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((value) => ({ value, label: value }));
}

function monthValue(value: string | null): string {
  const parts = value ? captacaoDateParts(value) : null;
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : '';
}

function monthOptions(rows: RelatorioEdicaoRow[]): FilterOption[] {
  const months = new Map<string, FilterOption & { sortValue: number }>();
  months.set(CURRENT_MONTH_VALUE, {
    value: CURRENT_MONTH_VALUE,
    label: `${MONTH_NAMES[CURRENT_DATE.getMonth()]} de ${CURRENT_DATE.getFullYear()}`,
    sortValue: CURRENT_DATE.getFullYear() * 100 + CURRENT_DATE.getMonth() + 1,
  });

  rows.forEach((row) => {
    const parts = row.datainicio ? captacaoDateParts(row.datainicio) : null;
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

function buildEditorOptions(items: { name: string; total: number }[]): ApexOptions {
  return {
    chart: { type: 'bar', height: 280, background: 'transparent', toolbar: { show: false }, foreColor: '#9A9A9A', fontFamily: 'Roboto' },
    series: [{ name: 'Registros', data: items.map((item) => item.total) }],
    colors: [ACCENT],
    plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '40%' } },
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
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `${value} ${value === 1 ? 'registro' : 'registros'}` } },
    legend: { show: false },
  };
}

function buildClientOptions(items: { name: string; total: number }[]): ApexOptions {
  return {
    chart: { type: 'bar', height: Math.max(280, items.length * 26), background: 'transparent', toolbar: { show: false }, foreColor: '#9A9A9A', fontFamily: 'Roboto' },
    series: [{ name: 'Vídeos', data: items.map((item) => item.total) }],
    colors: [ACCENT],
    stroke: { show: false },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '58%' } },
    fill: { opacity: 0.92 },
    dataLabels: { enabled: false },
    grid: baseGrid,
    xaxis: {
      ...baseAxis,
      categories: items.map((item) => item.name),
      min: 0,
      labels: { style: { colors: '#9A9A9A', fontFamily: 'Roboto', fontSize: '11px' }, formatter: (value: string) => String(Math.round(Number(value))) },
    },
    yaxis: { labels: { style: { colors: '#C7C7C7', fontFamily: 'Roboto', fontSize: '11px' } } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `${value} ${value === 1 ? 'vídeo' : 'vídeos'}` } },
    legend: { show: false },
  };
}

export function EdicoesTab() {
  const [rawRows, setRawRows] = useState<RelatorioEdicaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState('all');
  const [month, setMonth] = useState(CURRENT_MONTH_VALUE);
  const [cliente, setCliente] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRawRows(await fetchRelatorioEdicao());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o relatório de edições.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => enrich(rawRows), [rawRows]);
  const editors = useMemo(() => filterOptions(rows, 'editor'), [rows]);
  const clientes = useMemo(() => filterOptions(rows, 'cliente'), [rows]);
  const months = useMemo(() => monthOptions(rows), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (editor !== 'all' && row.editor !== editor) return false;
      if (cliente !== 'all' && row.cliente !== cliente) return false;
      if (month !== 'all' && monthValue(row.datainicio) !== month) return false;
      return true;
    });
  }, [cliente, editor, month, rows]);

  const editorChart = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    filteredRows.forEach((row) => {
      const key = normalized(row.editor);
      const bucket = map.get(key) ?? { name: row.editor || 'Sem editor', total: 0 };
      bucket.total += 1;
      map.set(key, bucket);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredRows]);

  const clientChart = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    filteredRows.forEach((row) => {
      const key = normalized(row.cliente);
      const bucket = map.get(key) ?? { name: row.cliente, total: 0 };
      bucket.total += 1;
      map.set(key, bucket);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredRows]);

  const editorOptions = useMemo(() => buildEditorOptions(editorChart), [editorChart]);
  const clientOptions = useMemo(() => buildClientOptions(clientChart), [clientChart]);
  const concluidos = useMemo(() => filteredRows.filter((row) => normalized(row.status) === 'concluido').length, [filteredRows]);
  const filtersActive = editor !== 'all' || cliente !== 'all' || month !== CURRENT_MONTH_VALUE;

  function clearFilters() {
    setEditor('all');
    setCliente('all');
    setMonth(CURRENT_MONTH_VALUE);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold tracking-[-0.03em] text-lg">Relatório Edições</h2>
        <p className="text-xs text-[var(--muted-2)] mt-1">Acompanhe as edições realizadas por cada editor.</p>
      </div>

      {loading && rawRows.length === 0 ? (
        <LoadingSkeleton label="Carregando relatório de edições…" />
      ) : error ? (
        <div className="card p-8 text-center">
          <Film className="w-8 h-8 mx-auto text-[#F87171] mb-3" />
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
              <FilterSelect label="Editor" value={editor} onChange={setEditor} options={editors} />
              <FilterSelect label="Mês" value={month} onChange={setMonth} options={months} />
              <FilterSelect label="Cliente" value={cliente} onChange={setCliente} options={clientes} />
              {filtersActive && (
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={clearFilters}>
                  Limpar filtros
                </OriginButton>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              Mostrando <span className="text-[var(--accent)]">{filteredRows.length}</span> de {rows.length}{' '}
              {rows.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard label="Total de registros" value={filteredRows.length} />
            <SummaryCard label="Concluídos" value={concluidos} accent />
            <SummaryCard label="Editores ativos" value={editorChart.length} />
            <SummaryCard label="Clientes atendidos" value={clientChart.length} />
          </div>

          <div className="card p-5">
            <h3 className="font-semibold tracking-[-0.025em] mb-3">Registros por editor</h3>
            {editorChart.length ? (
              <ApexChartBox id="chart-edicoes-editores" options={editorOptions} className="h-[280px]" />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--muted)]">Sem dados para exibir</div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold tracking-[-0.025em] mb-3">Vídeos por cliente</h3>
            {clientChart.length ? (
              <ApexChartBox id="chart-edicoes-clientes" options={clientOptions} revealDirection="horizontal" />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--muted)]">Sem dados para exibir</div>
            )}
          </div>

          <button type="button" className="chip-btn" onClick={() => setDetailsOpen(true)}>
            <Table2 className="w-3.5 h-3.5" />
            Ver registros detalhados
            <span className="pill">{filteredRows.length}</span>
          </button>

          {detailsOpen &&
            createPortal(
              <ModalShell onBackdropClick={() => setDetailsOpen(false)}>
                <div
                  id="edicoes-details-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="edicoes-details-title"
                  className="card flex flex-col overflow-hidden shadow-2xl"
                  style={{ width: 'min(1000px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 3rem)' }}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
                    <div>
                      <h3 id="edicoes-details-title" className="font-semibold tracking-[-0.025em] text-lg">
                        Registros detalhados
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {filteredRows.length} {filteredRows.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                      </p>
                    </div>
                    <OriginButton
                      autoFocus
                      aria-label="Fechar registros detalhados"
                      className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:#fff]"
                      onClick={() => setDetailsOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </OriginButton>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    {filteredRows.length === 0 ? (
                      <div className="p-12 text-center text-sm text-[var(--muted-2)]">Nenhum registro encontrado com esses filtros.</div>
                    ) : (
                      <table className="w-full min-w-[780px]">
                        <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                          <tr>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>Edição</th>
                            <th>Editor</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row) => (
                            <tr key={row.id}>
                              <td className="mono whitespace-nowrap text-[var(--muted-2)]">{row.datainicio ? formatDate(row.datainicio) : '—'}</td>
                              <td className="font-semibold text-[var(--text)] whitespace-nowrap">{row.cliente}</td>
                              <td className="text-[var(--muted-2)]">{row.name || '—'}</td>
                              <td className="whitespace-nowrap">{row.editor || '—'}</td>
                              <td className="text-[var(--muted-2)] whitespace-nowrap">{row.status || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
      <strong className={`text-2xl leading-none tracking-[-0.04em] ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{value}</strong>
    </div>
  );
}
