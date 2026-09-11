import { normalized } from './captacaoFormat';
import { canonicalClientName, clientNameKey, type ClienteMensalidade } from './vecClientes';
import type { VecFuncao, VecItem, VecLoadResult } from './vecValores';
import { ajusteKey } from './vecAjustes';
import { VALORES_COMPETENCIA_INICIAL } from './vecRates';

export type CostCategory = VecFuncao | 'all';
export type CostStatus = 'saudavel' | 'atencao' | 'critico' | 'limite' | 'estourado' | 'sem-limite';
export type CostPeriodPreset = 'mes' | 'anterior' | 'trimestre' | 'ano';

export interface CostLaunch {
  id: string;
  data: string;
  categoria: VecFuncao;
  descricao: string;
  pessoa: string;
  valor: number;
  ajuste: boolean;
}

export interface CostRow {
  cliente: string;
  custoMaximo: number | null;
  gasto: number;
  saldo: number | null;
  utilizacao: number | null;
  status: CostStatus;
  categorias: Record<VecFuncao, number>;
  mensalidade: number | null;
  margemEsperada: number | null;
  lucroMinimo: number | null;
  resultado: number | null;
  margemReal: number | null;
  tipoCliente: string | null;
  statusCadastro: string | null;
  parceria: boolean;
  lancamentos: CostLaunch[];
}

export const COST_STATUS_META: Record<CostStatus, { label: string; color: string }> = {
  saudavel: { label: 'Saudável', color: '#34D399' },
  atencao: { label: 'Atenção', color: '#FBBF24' },
  critico: { label: 'Crítico', color: '#FB923C' },
  limite: { label: 'Limite atingido', color: '#F97316' },
  estourado: { label: 'Estourado', color: '#FB7185' },
  'sem-limite': { label: 'Sem limite', color: '#94A3B8' },
};

export const COST_CATEGORY_META: Record<VecFuncao, { label: string; color: string }> = {
  edicao: { label: 'Edição', color: '#5CABC4' },
  design: { label: 'Design', color: '#A78BFA' },
  captacao: { label: 'Captação', color: '#FBBF24' },
};

const EXCLUIDOS_KEY = 'bossa_vec_clientes_excluidos';

export function readExcludedClients(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXCLUIDOS_KEY) || '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').map(clientNameKey) : []);
  } catch {
    return new Set();
  }
}

export function shiftCompetencia(competencia: string, amount: number): string {
  const [year, month] = competencia.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function competenciaLabel(competencia: string, short = false): string {
  const [year, month] = competencia.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  const label = new Intl.DateTimeFormat('pt-BR', { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric' }).format(date);
  return label.replace('.', '').replace(/^./, (char) => char.toUpperCase());
}

export function availableCostMonths(loadResult: VecLoadResult): string[] {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = new Set<string>([VALORES_COMPETENCIA_INICIAL, current < VALORES_COMPETENCIA_INICIAL ? VALORES_COMPETENCIA_INICIAL : current]);
  loadResult.items.forEach((item) => months.add(item.competencia));
  loadResult.roster.forEach((entry) => months.add(entry.competencia));
  return [...months].filter((month) => month >= VALORES_COMPETENCIA_INICIAL).sort();
}

function continuousMonths(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < 24) {
    months.push(cursor);
    cursor = shiftCompetencia(cursor, 1);
  }
  return months;
}

export function periodMonths(endMonth: string, preset: CostPeriodPreset): string[] {
  if (preset === 'mes') return [endMonth];
  if (preset === 'anterior') {
    const previous = shiftCompetencia(endMonth, -1);
    return previous >= VALORES_COMPETENCIA_INICIAL ? [previous] : [VALORES_COMPETENCIA_INICIAL];
  }
  if (preset === 'trimestre') {
    const start = [shiftCompetencia(endMonth, -2), VALORES_COMPETENCIA_INICIAL].sort().at(-1) ?? VALORES_COMPETENCIA_INICIAL;
    return continuousMonths(start, endMonth);
  }
  const yearStart = `${endMonth.slice(0, 4)}-01`;
  return continuousMonths(yearStart < VALORES_COMPETENCIA_INICIAL ? VALORES_COMPETENCIA_INICIAL : yearStart, endMonth);
}

function latestRosterEntry(roster: ClienteMensalidade[], client: string, endMonth: string): ClienteMensalidade | null {
  const clientKey = clientNameKey(client);
  const eligible = roster.filter((entry) => clientNameKey(entry.cliente) === clientKey && entry.competencia <= endMonth);
  return eligible.sort((a, b) => b.competencia.localeCompare(a.competencia))[0] ?? null;
}

export function costStatus(custoMaximo: number | null, gasto: number): { status: CostStatus; utilizacao: number | null } {
  if (custoMaximo === null) return { status: 'sem-limite', utilizacao: null };
  if (custoMaximo === 0) return { status: gasto > 0 ? 'estourado' : 'saudavel', utilizacao: gasto > 0 ? Infinity : 0 };
  const utilizacao = (gasto / custoMaximo) * 100;
  if (utilizacao > 100.0001) return { status: 'estourado', utilizacao };
  if (Math.abs(utilizacao - 100) <= 0.0001) return { status: 'limite', utilizacao: 100 };
  if (utilizacao >= 85) return { status: 'critico', utilizacao };
  if (utilizacao >= 70) return { status: 'atencao', utilizacao };
  return { status: 'saudavel', utilizacao };
}

interface CostAccumulator {
  cliente: string;
  categorias: Record<VecFuncao, number>;
  lancamentos: CostLaunch[];
}

function emptyCategories(): Record<VecFuncao, number> {
  return { edicao: 0, design: 0, captacao: 0 };
}

function buildGroups(loadResult: VecLoadResult, months: Set<string>, excluded: Set<string>) {
  const groups = new Map<string, { competencia: string; cliente: string; pessoa: string; categoria: VecFuncao; calculado: number; itens: VecItem[] }>();

  loadResult.items.forEach((item) => {
    if (!months.has(item.competencia) || excluded.has(clientNameKey(item.cliente))) return;
    const key = ajusteKey(item.competencia, item.pessoa, item.cliente);
    const group = groups.get(key) ?? {
      competencia: item.competencia,
      cliente: item.cliente,
      pessoa: item.pessoa,
      categoria: item.funcao,
      calculado: 0,
      itens: [],
    };
    group.calculado += item.valor;
    group.itens.push(item);
    groups.set(key, group);
  });

  return groups;
}

export function buildCostRows(
  loadResult: VecLoadResult,
  monthsList: string[],
  category: CostCategory,
  excluded: Set<string>,
): CostRow[] {
  const months = new Set(monthsList);
  const endMonth = monthsList.at(-1) ?? VALORES_COMPETENCIA_INICIAL;
  const accumulators = new Map<string, CostAccumulator>();
  const displayNames = new Map<string, string>();

  loadResult.roster.forEach((entry) => {
    if (entry.competencia > endMonth || excluded.has(clientNameKey(entry.cliente))) return;
    const key = clientNameKey(entry.cliente);
    if (!displayNames.has(key)) displayNames.set(key, canonicalClientName(entry.cliente));
  });

  buildGroups(loadResult, months, excluded).forEach((group, key) => {
    const clientKey = clientNameKey(group.cliente);
    if (!displayNames.has(clientKey)) displayNames.set(clientKey, group.cliente);
    const displayName = displayNames.get(clientKey) ?? group.cliente;
    const accumulator = accumulators.get(clientKey) ?? { cliente: displayName, categorias: emptyCategories(), lancamentos: [] };
    const adjusted = loadResult.ajusteMap.get(key);
    const finalValue = adjusted ?? group.calculado;
    accumulator.categorias[group.categoria] += finalValue;
    group.itens.forEach((item) => {
      accumulator.lancamentos.push({
        id: item.id,
        data: item.data,
        categoria: item.funcao,
        descricao: item.descricao,
        pessoa: item.pessoa,
        valor: item.valor,
        ajuste: false,
      });
    });
    if (adjusted !== undefined && Math.abs(adjusted - group.calculado) >= 0.005) {
      accumulator.lancamentos.push({
        id: `ajuste-${key}`,
        data: `${group.competencia}-01`,
        categoria: group.categoria,
        descricao: `Ajuste manual · ${group.pessoa}`,
        pessoa: group.pessoa,
        valor: adjusted - group.calculado,
        ajuste: true,
      });
    }
    accumulators.set(clientKey, accumulator);
  });

  displayNames.forEach((cliente, key) => {
    if (!accumulators.has(key)) accumulators.set(key, { cliente, categorias: emptyCategories(), lancamentos: [] });
  });

  return [...accumulators.values()]
    .map((accumulator): CostRow => {
      const rosterEntry = latestRosterEntry(loadResult.roster, accumulator.cliente, endMonth);
      const gasto = category === 'all' ? Object.values(accumulator.categorias).reduce((sum, value) => sum + value, 0) : accumulator.categorias[category];
      const custoMaximo = rosterEntry?.custo_maximo ?? null;
      const { status, utilizacao } = costStatus(custoMaximo, gasto);
      const mensalidade = rosterEntry?.valor_mensalidade ?? null;
      const parceria = normalized(rosterEntry?.tipo_cliente ?? '').includes('parceria');
      const resultado = parceria || mensalidade === null ? null : mensalidade - gasto;
      const margemReal = resultado === null || mensalidade === null || mensalidade === 0 ? null : (resultado / mensalidade) * 100;
      return {
        cliente: accumulator.cliente,
        custoMaximo,
        gasto,
        saldo: custoMaximo === null ? null : custoMaximo - gasto,
        utilizacao,
        status,
        categorias: accumulator.categorias,
        mensalidade,
        margemEsperada: rosterEntry?.margem ?? null,
        lucroMinimo: rosterEntry?.lucro_minimo ?? null,
        resultado,
        margemReal,
        tipoCliente: rosterEntry?.tipo_cliente ?? null,
        statusCadastro: rosterEntry?.status_cliente ?? null,
        parceria,
        lancamentos: accumulator.lancamentos.sort((a, b) => b.data.localeCompare(a.data)),
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

export function formatUsage(value: number | null): string {
  if (value === null) return '—';
  if (!Number.isFinite(value)) return '∞';
  return `${value.toFixed(1)}%`;
}
