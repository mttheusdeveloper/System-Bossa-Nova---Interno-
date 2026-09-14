import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  CircleHelp,
  ChevronsUpDown,
  ChevronRight,
  Grid3X3,
  Info,
  List,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { normalized } from '../../lib/captacaoFormat';
import { fmtBRL2 } from '../../lib/format';
import { clientNameKey } from '../../lib/vecClientes';
import {
  availableCostMonths,
  buildCostRows,
  competenciaLabel,
  COST_CATEGORY_META,
  COST_STATUS_META,
  costStatus,
  formatUsage,
  periodMonths,
  readExcludedClients,
  shiftCompetencia,
  type CostCategory,
  type CostPeriodPreset,
  type CostRow,
  type CostStatus,
} from '../../lib/vecCustos';
import { VALORES_COMPETENCIA_INICIAL } from '../../lib/vecRates';
import { loadValores, type VecLoadResult } from '../../lib/vecValores';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';

type SortKey = 'cliente' | 'custoMaximo' | 'gasto' | 'saldo' | 'utilizacao' | 'status';
type RankingMode = 'maior-utilizacao' | 'menor-utilizacao' | 'menores-gastos' | 'maiores-gastos';
type ViewMode = 'tabela' | 'matriz';

const TODAY = new Date();
const CURRENT_COMPETENCIA = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;
const DEFAULT_COMPETENCIA = CURRENT_COMPETENCIA < VALORES_COMPETENCIA_INICIAL ? VALORES_COMPETENCIA_INICIAL : CURRENT_COMPETENCIA;
const CATEGORY_KEYS = ['edicao', 'design', 'captacao'] as const;
const STATUS_PRIORITY: Record<CostStatus, number> = {
  'sem-limite': 7,
  estourado: 6,
  limite: 5,
  critico: 4,
  atencao: 3,
  saudavel: 1,
};
const STATUS_COUNT_LABELS: Record<Exclude<CostStatus, 'saudavel'>, string> = {
  atencao: 'Em atenção',
  critico: 'Críticos',
  limite: 'No limite',
  estourado: 'Estourados',
  'sem-limite': 'Sem limite',
};

function matchesRegistrationStatus(row: CostRow, value: string, hasActiveClients: boolean): boolean {
  if (value === 'all') return true;
  const registrationStatus = normalized(row.statusCadastro ?? '');
  if (value === 'ativo' && (!hasActiveClients || (!registrationStatus && row.lancamentos.length > 0))) return true;
  return registrationStatus === value;
}

function applyPopulationFilters(
  rows: CostRow[],
  filters: { cliente: string; tipo: string; cadastro: string },
): CostRow[] {
  const hasActiveClients = rows.some((row) => normalized(row.statusCadastro ?? '') === 'ativo');
  return rows.filter((row) => {
    if (filters.cliente !== 'all' && row.cliente !== filters.cliente) return false;
    if (filters.tipo !== 'all' && normalized(row.tipoCliente ?? '') !== filters.tipo) return false;
    return matchesRegistrationStatus(row, filters.cadastro, hasActiveClients);
  });
}

function sortRows(rows: CostRow[], key: SortKey, direction: 'asc' | 'desc'): CostRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (key === 'cliente') return a.cliente.localeCompare(b.cliente, 'pt-BR');
    if (key === 'status') return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    const aValue = a[key] ?? Number.NEGATIVE_INFINITY;
    const bValue = b[key] ?? Number.NEGATIVE_INFINITY;
    return Number(aValue) - Number(bValue);
  });
  return direction === 'asc' ? sorted : sorted.reverse();
}

function ratioPercent(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function formatLaunchDate(value: string): string {
  if (!value) return '—';
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return value;
}

const CostActionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(({ className = '', type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} {...props} className={`vec-cost-action ${className}`} />
));
CostActionButton.displayName = 'CostActionButton';

export function VecCustosTab() {
  const [loadResult, setLoadResult] = useState<VecLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endMonth, setEndMonth] = useState(DEFAULT_COMPETENCIA);
  const [preset, setPreset] = useState<CostPeriodPreset>('mes');
  const [cliente, setCliente] = useState('all');
  const [category, setCategory] = useState<CostCategory>('all');
  const [financialStatus, setFinancialStatus] = useState<CostStatus | 'all'>('all');
  const [tipo, setTipo] = useState('all');
  const [cadastro, setCadastro] = useState('ativo');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('utilizacao');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [rankingMode, setRankingMode] = useState<RankingMode>('maior-utilizacao');
  const [viewMode, setViewMode] = useState<ViewMode>('tabela');
  const [detailClient, setDetailClient] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState('--:--');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextResult = await loadValores();
      setLoadResult(nextResult);
      setUpdatedAt(new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os dados de custos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let timer = 0;
    const scheduleReload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 250);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'bossa_vec_dashboard_updated_at') scheduleReload();
    };
    window.addEventListener('storage', handleStorage);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('bossa-vec-dashboard');
      channel.addEventListener('message', scheduleReload);
    } catch {
      // O evento de storage continua cobrindo navegadores sem BroadcastChannel.
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', handleStorage);
      channel?.close();
    };
  }, [load]);

  useEffect(() => {
    if (!detailClient) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailClient(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailClient]);

  const excluded = useMemo(() => loadResult ? readExcludedClients() : new Set<string>(), [loadResult]);
  const availableMonths = useMemo(() => (loadResult ? availableCostMonths(loadResult) : [DEFAULT_COMPETENCIA]), [loadResult]);
  const selectedMonths = useMemo(() => periodMonths(endMonth, preset), [endMonth, preset]);
  const selectedEndMonth = selectedMonths.at(-1) ?? endMonth;
  const periodSummaryLabel = selectedMonths.length === 1
    ? competenciaLabel(selectedMonths[0])
    : `${competenciaLabel(selectedMonths[0], true)} – ${competenciaLabel(selectedEndMonth, true)}`;
  const allRows = useMemo(
    () => (loadResult ? buildCostRows(loadResult, selectedMonths, category, excluded) : []),
    [loadResult, selectedMonths, category, excluded],
  );
  const populationFilters = useMemo(() => ({ cliente, tipo, cadastro }), [cliente, tipo, cadastro]);
  const populationRows = useMemo(() => applyPopulationFilters(allRows, populationFilters), [allRows, populationFilters]);
  const filteredRows = useMemo(
    () => populationRows.filter((row) => financialStatus === 'all' || row.status === financialStatus),
    [populationRows, financialStatus],
  );

  const clientOptions = useMemo(() => allRows.map((row) => row.cliente).sort((a, b) => a.localeCompare(b, 'pt-BR')), [allRows]);
  const typeOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.tipoCliente).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [allRows],
  );

  const kpis = useMemo(() => {
    const withLimit = filteredRows.filter((row) => row.custoMaximo !== null);
    const limit = withLimit.reduce((sum, row) => sum + (row.custoMaximo ?? 0), 0);
    const spent = filteredRows.reduce((sum, row) => sum + row.gasto, 0);
    const overall = costStatus(withLimit.length ? limit : null, spent);
    return {
      limit,
      spent,
      balance: withLimit.length ? limit - spent : null,
      usage: overall.utilizacao,
      status: overall.status,
      withLimit: withLimit.length,
      withoutLimit: filteredRows.length - withLimit.length,
    };
  }, [filteredRows]);

  const previousSpent = useMemo(() => {
    if (!loadResult) return 0;
    const previousMonths = selectedMonths.map((month) => shiftCompetencia(month, -1)).filter((month) => month >= VALORES_COMPETENCIA_INICIAL);
    if (!previousMonths.length) return 0;
    const rows = applyPopulationFilters(buildCostRows(loadResult, previousMonths, category, excluded), populationFilters);
    return rows.reduce((sum, row) => sum + row.gasto, 0);
  }, [loadResult, selectedMonths, category, excluded, populationFilters]);

  const comparisonDelta = kpis.spent - previousSpent;
  const comparisonPercent = previousSpent > 0 ? (comparisonDelta / previousSpent) * 100 : null;

  const statusCounts = useMemo(() => {
    const counts: Record<CostStatus, number> = { saudavel: 0, atencao: 0, critico: 0, limite: 0, estourado: 0, 'sem-limite': 0 };
    populationRows.forEach((row) => { counts[row.status] += 1; });
    return counts;
  }, [populationRows]);

  const priorities = useMemo(
    () => [...filteredRows]
      .filter((row) => row.status !== 'saudavel' && (row.status !== 'sem-limite' || row.gasto > 0))
      .sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status] || (b.utilizacao ?? -1) - (a.utilizacao ?? -1) || b.gasto - a.gasto)
      .slice(0, 5),
    [filteredRows],
  );

  const ranking = useMemo(() => {
    const candidates = rankingMode.includes('utilizacao')
      ? filteredRows.filter((row) => row.utilizacao !== null && Number.isFinite(row.utilizacao))
      : filteredRows.filter((row) => row.gasto > 0);
    const ascending = rankingMode === 'menor-utilizacao' || rankingMode === 'menores-gastos';
    return [...candidates]
      .sort((a, b) => {
        const aValue = rankingMode.includes('utilizacao') ? (a.utilizacao ?? 0) : a.gasto;
        const bValue = rankingMode.includes('utilizacao') ? (b.utilizacao ?? 0) : b.gasto;
        return ascending ? aValue - bValue : bValue - aValue;
      })
      .slice(0, 5);
  }, [filteredRows, rankingMode]);
  const categoryTotals = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + Object.values(row.categorias).reduce((subtotal, value) => subtotal + value, 0), 0);
    return CATEGORY_KEYS.map((key) => {
      const value = filteredRows.reduce((sum, row) => sum + row.categorias[key], 0);
      const clients = filteredRows.filter((row) => row.categorias[key] > 0).length;
      return { key, value, clients, percent: ratioPercent(value, total), ...COST_CATEGORY_META[key] };
    });
  }, [filteredRows]);

  const alerts = useMemo(() => {
    const entries: Array<{ id: string; tone: CostStatus | 'categoria'; title: string; description: string; cliente?: string; categoria?: CostCategory }> = [];
    filteredRows.forEach((row) => {
      if (row.status === 'estourado') {
        entries.push({ id: `${row.cliente}-over`, tone: row.status, cliente: row.cliente, title: `${row.cliente} estourou o limite`, description: `Ultrapassou em ${fmtBRL2(Math.abs(row.saldo ?? 0))}.` });
      } else if (row.status === 'limite') {
        entries.push({ id: `${row.cliente}-limit`, tone: row.status, cliente: row.cliente, title: `${row.cliente} atingiu o limite`, description: 'O custo máximo foi utilizado integralmente.' });
      } else if (row.status === 'critico') {
        entries.push({ id: `${row.cliente}-critical`, tone: row.status, cliente: row.cliente, title: `${row.cliente} está em nível crítico`, description: `${formatUsage(row.utilizacao)} do limite utilizado.` });
      } else if (row.status === 'sem-limite' && row.gasto > 0) {
        entries.push({ id: `${row.cliente}-no-limit`, tone: row.status, cliente: row.cliente, title: `${row.cliente} está sem limite`, description: `Há ${fmtBRL2(row.gasto)} em custos sem custo máximo definido.` });
      }
      if (row.saldo !== null && row.saldo > 0 && row.saldo <= 75) {
        entries.push({ id: `${row.cliente}-low`, tone: 'atencao', cliente: row.cliente, title: `${row.cliente} tem saldo baixo`, description: `Restam apenas ${fmtBRL2(row.saldo)}.` });
      }
    });
    categoryTotals.forEach((item) => {
      if (item.value > 0 && item.percent >= 40) {
        entries.push({ id: `category-${item.key}`, tone: 'categoria', categoria: item.key, title: `${item.label} concentra os gastos`, description: `${item.percent.toFixed(1)}% do custo do período está nessa categoria.` });
      }
    });
    return entries;
  }, [filteredRows, categoryTotals]);

  const evolution = useMemo(() => {
    if (!loadResult) return [];
    return availableMonths
      .filter((month) => month <= selectedEndMonth)
      .slice(-6)
      .map((month) => {
        const rows = applyPopulationFilters(buildCostRows(loadResult, [month], category, excluded), populationFilters);
        return {
          month,
          label: competenciaLabel(month, true),
          limite: rows.filter((row) => row.custoMaximo !== null).reduce((sum, row) => sum + (row.custoMaximo ?? 0), 0),
          gasto: rows.reduce((sum, row) => sum + row.gasto, 0),
        };
      });
  }, [loadResult, availableMonths, selectedEndMonth, category, excluded, populationFilters]);

  const tableRows = useMemo(() => {
    const query = clientNameKey(search);
    const searched = query ? filteredRows.filter((row) => clientNameKey(row.cliente).includes(query)) : filteredRows;
    return sortRows(searched, sortKey, sortDirection);
  }, [filteredRows, search, sortKey, sortDirection]);

  const detailRow = useMemo(() => filteredRows.find((row) => row.cliente === detailClient) ?? allRows.find((row) => row.cliente === detailClient) ?? null, [filteredRows, allRows, detailClient]);
  const history = useMemo(() => {
    if (!loadResult || !detailRow) return [];
    return availableMonths.filter((month) => month <= selectedEndMonth).slice(-12).map((month) => {
      const row = buildCostRows(loadResult, [month], 'all', excluded).find((item) => clientNameKey(item.cliente) === clientNameKey(detailRow.cliente));
      return row ? { month, ...row } : null;
    }).filter((row): row is { month: string } & CostRow => row !== null);
  }, [loadResult, detailRow, availableMonths, selectedEndMonth, excluded]);

  function clearFilters() {
    setEndMonth(availableMonths.includes(DEFAULT_COMPETENCIA) ? DEFAULT_COMPETENCIA : (availableMonths.at(-1) ?? DEFAULT_COMPETENCIA));
    setPreset('mes');
    setCliente('all');
    setCategory('all');
    setFinancialStatus('all');
    setTipo('all');
    setCadastro('all');
    setSearch('');
  }

  function activatePreset(nextPreset: CostPeriodPreset) {
    setEndMonth(availableMonths.includes(DEFAULT_COMPETENCIA) ? DEFAULT_COMPETENCIA : (availableMonths.at(-1) ?? DEFAULT_COMPETENCIA));
    setPreset(nextPreset);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection(key === 'cliente' ? 'asc' : 'desc');
    }
  }

  if (loading && !loadResult) return <LoadingSkeleton label="Carregando dashboard de custos…" />;
  if (error) {
    return (
      <section className="vec-cost-page">
        <div className="card vec-cost-empty">
          <AlertTriangle />
          <h2>Não foi possível montar o dashboard</h2>
          <p>{error}</p>
          <CostActionButton className="h-9 px-4" onClick={() => void load()}>Tentar novamente</CostActionButton>
        </div>
      </section>
    );
  }

  return (
    <section className="vec-cost-page space-y-5">
      <header className="vec-cost-heading">
        <div>
          <div className="vec-cost-eyebrow">VEC RELATÓRIOS</div>
          <h2>Dashboard gerencial de custos</h2>
          <p>Limites da planilha interna cruzados com os gastos realizados.</p>
        </div>
        <CostActionButton type="button" className="vec-cost-updated" onClick={() => void load()} aria-label="Atualizar dados">
          <i /> Atualizado às {updatedAt}
        </CostActionButton>
      </header>

      {!loadResult?.ajustesDisponivel && (
        <div className="vec-cost-notice"><AlertTriangle /> Ajustes manuais indisponíveis; os valores automáticos estão sendo utilizados.</div>
      )}

      <div className="card vec-cost-filters">
        <div className="vec-cost-filter-grid">
          <div className="vec-cost-field vec-cost-competencia-field">
            <span>Mês</span>
            <CostDropdown
              value={endMonth}
              options={availableMonths.map((month) => ({ value: month, label: competenciaLabel(month) }))}
              onChange={(value) => { setEndMonth(value); setPreset('mes'); }}
              ariaLabel="Mês"
            />
          </div>
          <CostSelect label="Cliente" allLabel="Todos os clientes" value={cliente} onChange={setCliente} options={clientOptions.map((value) => ({ value, label: value }))} />
          <CostSelect label="Categoria" allLabel="Todas as categorias" value={category} onChange={(value) => setCategory(value as CostCategory)} options={CATEGORY_KEYS.map((key) => ({ value: key, label: COST_CATEGORY_META[key].label }))} />
          <CostSelect label="Status financeiro" allLabel="Todos os status" value={financialStatus} onChange={(value) => setFinancialStatus(value as CostStatus | 'all')} options={(Object.keys(COST_STATUS_META) as CostStatus[]).map((key) => ({ value: key, label: COST_STATUS_META[key].label }))} />
          <CostSelect label="Tipo de cliente" allLabel="Todos os tipos" value={tipo} onChange={setTipo} options={typeOptions.map((label) => ({ value: normalized(label), label }))} />
          <CostSelect label="Cadastro" value={cadastro} onChange={setCadastro} options={[{ value: 'ativo', label: 'ATIVO' }, { value: 'inativo', label: 'INATIVO' }]} />
          <div className="vec-cost-clear-wrap"><CostActionButton type="button" className="vec-cost-clear" onClick={clearFilters}>Limpar</CostActionButton></div>
        </div>
        <div className="vec-cost-filter-footer">
          <div className="vec-cost-period-shortcuts">
            {([
              ['mes', 'Este mês'],
              ['anterior', 'Mês anterior'],
              ['trimestre', 'Últimos 3 meses'],
              ['ano', 'Ano atual'],
            ] as Array<[CostPeriodPreset, string]>).map(([key, label]) => (
              <CostActionButton key={key} type="button" className={preset === key ? 'active' : ''} onClick={() => activatePreset(key)}>{label}</CostActionButton>
            ))}
          </div>
        </div>
      </div>

      <div className="vec-cost-period-summary">Mostrando {periodSummaryLabel} · {filteredRows.length} clientes</div>

      <div className="vec-cost-kpis">
        <CostKpi icon={<WalletCards />} label="Custo máximo total" value={fmtBRL2(kpis.limit)} tone="blue" sub={`${kpis.withLimit} definidos · ${kpis.withoutLimit} sem limite`} />
        <CostKpi
          icon={comparisonDelta >= 0 ? <ArrowUp /> : <ArrowDown />}
          label="Gasto total"
          value={fmtBRL2(kpis.spent)}
          tone="purple"
          sub={comparisonPercent === null ? 'Sem base para comparação' : `${comparisonPercent >= 0 ? '+' : ''}${comparisonPercent.toFixed(1)}% · ${fmtBRL2(comparisonDelta)}`}
        />
        <CostKpi icon={<TrendingUp />} label="Saldo disponível" value={kpis.balance === null ? 'Não calculável' : fmtBRL2(kpis.balance)} tone={(kpis.balance ?? 0) < 0 ? 'red' : 'green'} sub="Limite menos gasto realizado" emphasis />
        <CostKpi icon={<BarChart3 />} label="Utilização geral" value={formatUsage(kpis.usage)} tone="amber" sub="Percentual consolidado" status={kpis.status} progress={kpis.usage} />
      </div>

      <div className="vec-cost-status-strip">
        {(['atencao', 'critico', 'limite', 'estourado', 'sem-limite'] as Array<Exclude<CostStatus, 'saudavel'>>).map((status) => (
          <CostActionButton
            key={status}
            type="button"
            className={financialStatus === status ? 'active' : ''}
            style={{ '--status-color': COST_STATUS_META[status].color } as React.CSSProperties}
            onClick={() => setFinancialStatus((current) => current === status ? 'all' : status)}
          >
            <i />
            <strong>{statusCounts[status]}</strong>
            <span className="vec-cost-status-label">{STATUS_COUNT_LABELS[status]}</span>
          </CostActionButton>
        ))}
      </div>

      <div className="vec-cost-overview-grid">
        <div className="card vec-cost-panel vec-cost-priorities">
          <PanelHeading eyebrow="Prioridade" title="Clientes que exigem atenção" count={priorities.length} />
          <div className="vec-cost-priority-list">
            {priorities.length ? priorities.map((row) => <ClientAttention key={row.cliente} row={row} onOpen={() => setDetailClient(row.cliente)} />) : <EmptyInline text="Nenhum cliente exige atenção neste filtro." />}
          </div>
        </div>

        <div className="card vec-cost-panel vec-cost-ranking">
          <PanelHeading eyebrow="Rankings" title="Onde agir primeiro" />
          <div className="vec-cost-ranking-tabs">
            {([
              ['maior-utilizacao', 'Maior utilização'],
              ['menor-utilizacao', 'Menor utilização'],
              ['menores-gastos', 'Menores gastos em R$'],
              ['maiores-gastos', 'Maiores gastos em R$'],
            ] as Array<[RankingMode, string]>).map(([mode, label]) => (
              <CostActionButton key={mode} type="button" className={rankingMode === mode ? 'active' : ''} onClick={() => setRankingMode(mode)}>{label}</CostActionButton>
            ))}
          </div>
          <div className="vec-cost-ranking-list">
            {ranking.length ? ranking.map((row, index) => {
              const width = row.utilizacao === null || !Number.isFinite(row.utilizacao) ? 0 : Math.min(100, row.utilizacao);
              return (
                <CostActionButton key={row.cliente} type="button" onClick={() => setDetailClient(row.cliente)}>
                  <span className="vec-cost-rank-row">
                    <span className="vec-cost-rank-position">{index + 1}</span>
                    <span className="vec-cost-rank-name">{row.cliente}</span>
                    <strong>{rankingMode.includes('utilizacao') ? formatUsage(row.utilizacao) : fmtBRL2(row.gasto)}</strong>
                  </span>
                  <span className="vec-cost-rank-track" title={`Utilização: ${formatUsage(row.utilizacao)}`}><i style={{ width: `${Math.max(0, width)}%`, background: COST_STATUS_META[row.status].color }} /></span>
                </CostActionButton>
              );
            }) : <EmptyInline text="Sem clientes para este ranking." />}
          </div>
        </div>
      </div>

      <div className="card vec-cost-panel vec-cost-data-panel">
        <div className="vec-cost-data-toolbar">
          <PanelHeading eyebrow="Visão operacional" title={viewMode === 'tabela' ? 'Custos por cliente' : 'Matriz por categoria'} />
          <div className="vec-cost-data-actions">
            <div className="vec-cost-view-switch">
              <CostActionButton type="button" className={viewMode === 'tabela' ? 'active' : ''} onClick={() => setViewMode('tabela')}><List /> Clientes</CostActionButton>
              <CostActionButton type="button" className={viewMode === 'matriz' ? 'active' : ''} onClick={() => setViewMode('matriz')}><Grid3X3 /> Matriz por categoria</CostActionButton>
            </div>
            <label className="vec-cost-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente…" /></label>
          </div>
        </div>
        {viewMode === 'tabela' ? (
          <CostTable rows={tableRows} sortKey={sortKey} direction={sortDirection} onSort={toggleSort} onOpen={(row) => setDetailClient(row.cliente)} />
        ) : (
          <CostMatrix rows={tableRows} onOpen={(row) => setDetailClient(row.cliente)} />
        )}
      </div>

      <div className="vec-cost-chart-grid">
        <div className="card vec-cost-panel vec-cost-evolution">
          <PanelHeading eyebrow="Tendência" title="Evolução dos gastos" note="Últimos 6 meses" />
          <div className="vec-cost-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="costSpentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27313A" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#A6B0BB', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value: number) => value === 0 ? 'R$ 0' : `R$ ${(value / 1000).toFixed(0)} mil`} tick={{ fill: '#A6B0BB', fontSize: 12 }} axisLine={false} tickLine={false} width={66} />
                <Tooltip formatter={(value) => fmtBRL2(Number(value))} contentStyle={{ background: '#0E141A', border: '1px solid #2B3742', borderRadius: 8, fontSize: 12 }} />
                <Legend verticalAlign="top" height={34} iconType="circle" iconSize={10} wrapperStyle={{ color: '#BAC3CC', fontSize: 12 }} />
                <Line type="monotone" dataKey="limite" name="Custo máximo" stroke="#5CABC4" strokeWidth={2} dot={{ r: 3, fill: '#12181E', stroke: '#5CABC4', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="gasto" name="Gasto realizado" stroke="#A78BFA" strokeWidth={2} fill="url(#costSpentGradient)" dot={{ r: 3, fill: '#12181E', stroke: '#A78BFA', strokeWidth: 1 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card vec-cost-panel vec-cost-categories">
          <PanelHeading eyebrow="Distribuição" title="Gastos por categoria" note="Clique para filtrar" />
          <div className="vec-cost-category-list">
            {categoryTotals.map((item) => (
              <CostActionButton key={item.key} type="button" className={category === item.key ? 'active' : ''} aria-pressed={category === item.key} onClick={() => setCategory((current) => current === item.key ? 'all' : item.key)}>
                <div><strong>{item.label}</strong></div>
                <div><strong>{fmtBRL2(item.value)}</strong><span>· {item.percent.toFixed(0)}%</span></div>
                <span className="vec-cost-category-track"><span style={{ width: `${Math.min(100, item.percent)}%`, background: item.color }} /></span>
                <em>{item.clients} clientes</em>
              </CostActionButton>
            ))}
          </div>
        </div>
      </div>

      <div className="card vec-cost-panel vec-cost-alerts">
        <PanelHeading eyebrow="Monitoramento" title="Alertas gerenciais" note={`${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'}`} />
        <div className="vec-cost-alert-grid">
          {alerts.length ? alerts.slice(0, 8).map((alert) => {
            const color = alert.tone === 'categoria' ? '#5CABC4' : COST_STATUS_META[alert.tone].color;
            const AlertIcon = alert.tone === 'categoria' ? Info : alert.tone === 'sem-limite' ? CircleHelp : AlertTriangle;
            const canOpen = Boolean(alert.cliente || alert.categoria);
            return (
              <CostActionButton
                key={alert.id}
                type="button"
                className={!canOpen ? 'is-static' : ''}
                style={{ '--alert-color': color } as React.CSSProperties}
                onClick={() => {
                  if (alert.cliente) setDetailClient(alert.cliente);
                  else if (alert.categoria) setCategory(alert.categoria);
                }}
                disabled={!canOpen}
              >
                <span className="vec-cost-alert-icon"><AlertIcon /></span>
                <span className="vec-cost-alert-copy"><strong>{alert.title}</strong><small>{alert.description}</small></span>
                {canOpen && <span className="vec-cost-alert-link">{alert.cliente ? 'Ver cliente' : 'Filtrar categoria'} <ChevronRight /></span>}
              </CostActionButton>
            );
          }) : <EmptyInline text="Nenhum alerta gerencial para os filtros atuais." />}
        </div>
      </div>

      {detailRow && (
        <ClientCostDrawer row={detailRow} history={history} periodLabel={periodSummaryLabel} onClose={() => setDetailClient(null)} />
      )}
    </section>
  );
}

function CostDropdown({ value, options, onChange, ariaLabel }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div
      ref={wrapRef}
      className={`vec-cost-select ${open ? 'open' : ''}`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <CostActionButton
        ref={triggerRef}
        className={`vec-cost-select-trigger ${open ? 'active' : ''}`}
        aria-label={ariaLabel}
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="vec-cost-select-trigger-content"><span>{selectedLabel}</span><ChevronsUpDown /></span>
      </CostActionButton>
      {open && (
        <div id={menuId} className="vec-cost-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <CostActionButton
                key={option.value}
                className={`vec-cost-select-option ${selected ? 'active' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => selectValue(option.value)}
              >
                <span>{option.label}</span>{selected && <Check />}
              </CostActionButton>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CostSelect({ label, allLabel = 'Todos', value, options, onChange }: { label: string; allLabel?: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="vec-cost-field">
      <span>{label}</span>
      <CostDropdown value={value} options={[{ value: 'all', label: allLabel }, ...options]} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function CostKpi({ icon, label, value, tone, sub, emphasis = false, status, progress }: { icon: React.ReactNode; label: string; value: string; tone: 'blue' | 'purple' | 'green' | 'red' | 'amber'; sub: string; emphasis?: boolean; status?: CostStatus; progress?: number | null }) {
  return (
    <div className={`card vec-cost-kpi tone-${tone}${emphasis ? ' emphasis' : ''}`}>
      <div className="vec-cost-kpi-top"><small>{label}</small><span>{icon}</span></div>
      <div className="vec-cost-kpi-value-row"><strong>{value}</strong>{status && <StatusBadge status={status} />}</div>
      <p>{sub}</p>
      {progress !== undefined && (
        <span className="vec-cost-kpi-progress"><i style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }} /></span>
      )}
    </div>
  );
}

function PanelHeading({ eyebrow, title, count, icon, note }: { eyebrow: string; title: string; count?: number; icon?: React.ReactNode; note?: string }) {
  return (
    <div className="vec-cost-panel-heading">
      <div><span>{eyebrow}</span><h3>{icon}{title}</h3></div>
      {count !== undefined && <em>{count}</em>}
      {note && <small className="vec-cost-panel-note">{note}</small>}
    </div>
  );
}

function StatusBadge({ status }: { status: CostStatus }) {
  const meta = COST_STATUS_META[status];
  return <span className="vec-cost-status-badge" style={{ '--status-color': meta.color } as React.CSSProperties}>{meta.label}</span>;
}

function UsageBar({ row }: { row: CostRow }) {
  const color = COST_STATUS_META[row.status].color;
  const width = row.utilizacao === null ? 0 : Math.min(100, Number.isFinite(row.utilizacao) ? row.utilizacao : 100);
  return (
    <div className="vec-cost-usage"><div><i style={{ width: `${Math.max(0, width)}%`, background: color }} /></div><span>{formatUsage(row.utilizacao)}</span></div>
  );
}

function ClientAttention({ row, onOpen }: { row: CostRow; onOpen: () => void }) {
  return (
    <CostActionButton type="button" onClick={onOpen}>
      <span className="vec-cost-client-avatar">{clientInitials(row.cliente)}</span>
      <span className="vec-cost-attention-copy">
        <strong>{row.cliente}</strong>
        <small>{fmtBRL2(row.gasto)} de {row.custoMaximo === null ? 'limite não definido' : fmtBRL2(row.custoMaximo)}</small>
      </span>
      <span className="vec-cost-attention-result">
        <strong>{row.utilizacao === null ? 'Não calculável' : formatUsage(row.utilizacao)}</strong>
        <StatusBadge status={row.status} />
      </span>
    </CostActionButton>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div className="vec-cost-inline-empty">{text}</div>;
}

function SortHeader({ label, column, active, direction, onSort }: { label: string; column: SortKey; active: boolean; direction: 'asc' | 'desc'; onSort: (key: SortKey) => void }) {
  return <th><CostActionButton type="button" onClick={() => onSort(column)}>{label}{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}</CostActionButton></th>;
}

function CostTable({ rows, sortKey, direction, onSort, onOpen }: { rows: CostRow[]; sortKey: SortKey; direction: 'asc' | 'desc'; onSort: (key: SortKey) => void; onOpen: (row: CostRow) => void }) {
  return (
    <div className="vec-cost-table-wrap">
      <table className="vec-cost-table">
        <thead><tr>
          <SortHeader label="Cliente" column="cliente" active={sortKey === 'cliente'} direction={direction} onSort={onSort} />
          <SortHeader label="Custo máximo" column="custoMaximo" active={sortKey === 'custoMaximo'} direction={direction} onSort={onSort} />
          <SortHeader label="Gasto" column="gasto" active={sortKey === 'gasto'} direction={direction} onSort={onSort} />
          <SortHeader label="Saldo" column="saldo" active={sortKey === 'saldo'} direction={direction} onSort={onSort} />
          <SortHeader label="% utilizado" column="utilizacao" active={sortKey === 'utilizacao'} direction={direction} onSort={onSort} />
          <SortHeader label="Status" column="status" active={sortKey === 'status'} direction={direction} onSort={onSort} />
          <th aria-label="Detalhes" />
        </tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.cliente}>
              <td><CostActionButton type="button" className="vec-cost-client-link" onClick={() => onOpen(row)}><span className="vec-cost-client-avatar">{clientInitials(row.cliente)}</span><span>{row.cliente}</span></CostActionButton></td>
              <td>{row.custoMaximo === null ? '—' : fmtBRL2(row.custoMaximo)}</td>
              <td>{fmtBRL2(row.gasto)}</td>
              <td className={(row.saldo ?? 0) < 0 ? 'negative' : 'positive'}>{row.saldo === null ? '—' : fmtBRL2(row.saldo)}</td>
              <td><UsageBar row={row} /></td>
              <td><StatusBadge status={row.status} /></td>
              <td><CostActionButton type="button" className="vec-cost-eye" aria-label={`Detalhes de ${row.cliente}`} onClick={() => onOpen(row)}><ChevronRight /></CostActionButton></td>
            </tr>
          )) : <tr><td colSpan={7}><EmptyInline text="Nenhum cliente encontrado." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CostMatrix({ rows, onOpen }: { rows: CostRow[]; onOpen: (row: CostRow) => void }) {
  const maxima = CATEGORY_KEYS.reduce<Record<string, number>>((result, key) => {
    result[key] = Math.max(1, ...rows.map((row) => row.categorias[key]));
    return result;
  }, {});
  const colors: Record<string, string> = { edicao: '92,171,196', design: '167,139,250', captacao: '251,191,36' };
  return (
    <div className="vec-cost-table-wrap">
      <table className="vec-cost-table vec-cost-matrix">
        <thead><tr><th>Cliente</th>{CATEGORY_KEYS.map((key) => <th key={key}>{COST_CATEGORY_META[key].label}</th>)}<th>Total</th><th>Custo máximo</th><th>Saldo</th><th>Utilização</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.cliente}>
              <td><CostActionButton type="button" className="vec-cost-client-link" onClick={() => onOpen(row)}><span className="vec-cost-client-avatar">{clientInitials(row.cliente)}</span><span>{row.cliente}</span></CostActionButton></td>
              {CATEGORY_KEYS.map((key) => {
                const opacity = row.categorias[key] > 0 ? 0.08 + (row.categorias[key] / maxima[key]) * 0.3 : 0;
                return <td key={key} style={{ background: `rgba(${colors[key]},${opacity})` }}>{row.categorias[key] ? fmtBRL2(row.categorias[key]) : '—'}</td>;
              })}
              <td>{fmtBRL2(row.gasto)}</td><td>{row.custoMaximo === null ? '—' : fmtBRL2(row.custoMaximo)}</td><td>{row.saldo === null ? '—' : fmtBRL2(row.saldo)}</td><td><UsageBar row={row} /></td>
            </tr>
          )) : <tr><td colSpan={8}><EmptyInline text="Nenhum cliente encontrado." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ClientCostDrawer({ row, history, periodLabel, onClose }: { row: CostRow; history: Array<{ month: string } & CostRow>; periodLabel: string; onClose: () => void }) {
  const fullCost = Object.values(row.categorias).reduce((sum, value) => sum + value, 0);
  const detailCategories = ['captacao', 'edicao', 'design'] as const;
  return (
    <div className="vec-cost-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="vec-cost-drawer" role="dialog" aria-modal="true" aria-label={`Custos de ${row.cliente}`}>
        <header>
          <div>
            <span>{periodLabel}</span>
            <h2>{row.cliente}</h2>
            <div className="vec-cost-drawer-client-meta"><small>{row.tipoCliente || 'Não definido'}</small><StatusBadge status={row.status} /></div>
          </div>
          <CostActionButton type="button" onClick={onClose} aria-label="Fechar"><X /></CostActionButton>
        </header>
        <div className="vec-cost-drawer-content">
          <section className="vec-cost-drawer-summary">
            <div className="vec-cost-detail-kpis">
              <DetailMetric label="Custo máximo" value={row.custoMaximo === null ? '—' : fmtBRL2(row.custoMaximo)} />
              <DetailMetric label="Gasto atual" value={fmtBRL2(row.gasto)} />
              <DetailMetric label="Saldo disponível" value={row.saldo === null ? '—' : fmtBRL2(row.saldo)} tone={(row.saldo ?? 0) < 0 ? 'negative' : 'positive'} />
              <DetailMetric label="% utilizado" value={formatUsage(row.utilizacao)} />
            </div>
          </section>

          <section>
            <DrawerHeading eyebrow="Distribuição" title="Com o que este cliente está gastando?" />
            <div className="vec-cost-distribution-list">
              {detailCategories.map((key) => {
                const percent = ratioPercent(row.categorias[key], fullCost);
                return (
                  <div key={key}>
                    <div><strong>{COST_CATEGORY_META[key].label}</strong><span>{fmtBRL2(row.categorias[key])} · {percent.toFixed(0)}%</span></div>
                    <span className="vec-cost-distribution-track"><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <DrawerHeading eyebrow="Rentabilidade" title="Resultado após custos" />
            {row.parceria ? (
              <div className="vec-cost-partnership">Cliente classificado como parceria. Indicadores financeiros não se aplicam.</div>
            ) : (
              <div className="vec-cost-profit-grid">
                <DetailMetric label="Mensalidade" value={row.mensalidade === null ? '—' : fmtBRL2(row.mensalidade)} />
                <DetailMetric label="Custo realizado" value={fmtBRL2(row.gasto)} />
                <DetailMetric label="Resultado" value={row.resultado === null ? '—' : fmtBRL2(row.resultado)} tone={(row.resultado ?? 0) < 0 ? 'negative' : 'positive'} />
                <DetailMetric label="Margem real" value={row.margemReal === null ? '—' : `${row.margemReal.toFixed(1)}%`} />
                <DetailMetric label="Lucro mínimo" value={row.lucroMinimo === null ? '—' : fmtBRL2(row.lucroMinimo)} />
              </div>
            )}
          </section>

          <section>
            <DrawerHeading eyebrow="Composição" title="Lançamentos do período" count={`${row.lancamentos.length} ${row.lancamentos.length === 1 ? 'item' : 'itens'}`} />
            <div className="vec-cost-launch-table">
              <div className="head"><span>Data</span><span>Categoria</span><span>Descrição</span><span>Valor</span></div>
              {row.lancamentos.length ? row.lancamentos.map((item) => (
                <div key={item.id} className={item.ajuste ? 'adjustment' : ''}>
                  <span>{formatLaunchDate(item.data)}</span>
                  <span>{COST_CATEGORY_META[item.categoria].label}</span>
                  <span>{item.descricao}</span>
                  <strong>{fmtBRL2(item.valor)}</strong>
                </div>
              )) : <EmptyInline text="Nenhum lançamento neste período." />}
            </div>
          </section>

          <section>
            <DrawerHeading eyebrow="Histórico" title="Evolução mensal do cliente" />
            <div className="vec-cost-history">
              <div className="head"><span>Mês</span><span>Custo máximo</span><span>Gasto</span><span>Saldo</span><span>Utilização</span></div>
              {history.map((item) => <div key={item.month}><span>{competenciaLabel(item.month, true)}</span><span>{item.custoMaximo === null ? '—' : fmtBRL2(item.custoMaximo)}</span><span>{fmtBRL2(item.gasto)}</span><span>{item.saldo === null ? '—' : fmtBRL2(item.saldo)}</span><span>{formatUsage(item.utilizacao)}</span></div>)}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function DrawerHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count?: string }) {
  return <div className="vec-cost-drawer-heading"><div><span>{eyebrow}</span><h3>{title}</h3></div>{count && <small>{count}</small>}</div>;
}

function DetailMetric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return <div className={tone ? `tone-${tone}` : ''}><small>{label}</small><strong>{value}</strong></div>;
}
