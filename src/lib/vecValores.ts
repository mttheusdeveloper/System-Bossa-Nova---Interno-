import { captacaoDateParts, durationMinutes, formatDuration, normalized } from './captacaoFormat';
import { fetchAtasCaptacao } from './captacoes';
import { fetchRelatorioDesign, parseDesignName } from './relatorioDesign';
import { fetchRelatorioEdicao, parseEdicaoName } from './relatorioEdicao';
import { canonicalClientDisplayName, clientNameKey, fetchClientesMensalidade, type ClienteMensalidade } from './vecClientes';
import { ajusteKey, fetchAjustes, readLocalFallback } from './vecAjustes';
import { CAPTACAO_PESSOA, VALORES_COMPETENCIA_INICIAL, valorCaptacao, valorPorItem } from './vecRates';

export type VecFuncao = 'captacao' | 'edicao' | 'design';

export interface VecItem {
  id: string;
  competencia: string;
  data: string;
  cliente: string;
  pessoa: string;
  funcao: VecFuncao;
  quantidade: number;
  valor: number;
  concluida: boolean;
  descricao: string;
}

export interface VecLoadResult {
  items: VecItem[];
  roster: ClienteMensalidade[];
  ajusteMap: Map<string, number>;
  ajustesDisponivel: boolean;
}

const EDICAO_ITEM_RE = /(\d+)\s*(?:videos?|edica(?:o|oes)|reels?|stories?|story|cortes?|shorts?|clipes?|pecas?|depoimentos?|entrevistas?)/g;
const DESIGN_ITEM_RE = /(\d+)\s*(?:carrosse(?:l|is)|estatic(?:o|a)s?|stories?|story|artes?|capas?|pecas?)/g;

function extractCount(text: string, funcao: 'edicao' | 'design'): number {
  const source = normalized(text);
  const pattern = funcao === 'edicao' ? EDICAO_ITEM_RE : DESIGN_ITEM_RE;
  let total = 0;
  for (const match of source.matchAll(pattern)) total += Number(match[1]) || 0;
  return total || 1;
}

function competenciaOf(dateStr: string | null): string | null {
  const parts = dateStr ? captacaoDateParts(dateStr) : null;
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : null;
}

export async function loadValores(): Promise<VecLoadResult> {
  const [designRows, edicaoRows, captacaoRows, rawRoster, ajustesResult] = await Promise.all([
    fetchRelatorioDesign(),
    fetchRelatorioEdicao(),
    fetchAtasCaptacao(),
    fetchClientesMensalidade(),
    fetchAjustes(),
  ]);
  const roster = rawRoster.map((entry) => ({
    ...entry,
    cliente: canonicalClientDisplayName(entry.cliente, rawRoster),
  }));

  const items: VecItem[] = [];

  designRows.forEach((row) => {
    const competencia = competenciaOf(row.datainicio);
    if (!competencia || competencia < VALORES_COMPETENCIA_INICIAL) return;
    const { cliente } = parseDesignName(row.name);
    const clienteCanonico = canonicalClientDisplayName(cliente, roster);
    const quantidade = extractCount(row.name, 'design');
    items.push({
      id: `design-${row.id}`,
      competencia,
      data: row.datainicio || '',
      cliente: clienteCanonico,
      pessoa: row.designer,
      funcao: 'design',
      quantidade,
      valor: quantidade * valorPorItem(row.designer, 'design'),
      concluida: normalized(row.status) === 'concluido',
      descricao: row.name,
    });
  });

  edicaoRows.forEach((row) => {
    if (!row.editor) return;
    const competencia = competenciaOf(row.datainicio);
    if (!competencia || competencia < VALORES_COMPETENCIA_INICIAL) return;
    const cliente = parseEdicaoName(row.name);
    const clienteCanonico = canonicalClientDisplayName(cliente, roster);
    const quantidade = extractCount(row.name ?? '', 'edicao');
    items.push({
      id: `edicao-${row.id}`,
      competencia,
      data: row.datainicio || '',
      cliente: clienteCanonico,
      pessoa: row.editor,
      funcao: 'edicao',
      quantidade,
      valor: quantidade * valorPorItem(row.editor, 'edicao'),
      concluida: normalized(row.status) === 'concluido',
      descricao: row.name || '',
    });
  });

  captacaoRows.forEach((row) => {
    const competencia = competenciaOf(row.data_captacao);
    if (!competencia || competencia < VALORES_COMPETENCIA_INICIAL) return;
    const clienteCanonico = canonicalClientDisplayName(row.empresa, roster);
    items.push({
      id: `captacao-${row.id}`,
      competencia,
      data: row.data_captacao,
      cliente: clienteCanonico,
      pessoa: CAPTACAO_PESSOA,
      funcao: 'captacao',
      quantidade: 1,
      valor: valorCaptacao(row, clienteCanonico),
      concluida: true,
      descricao: `${row.empresa} · ${row.videomaker} · ${formatDuration(durationMinutes(row))}`,
    });
  });

  // Segunda passada: mesmo sem achar correspondência no cadastro
  // (clientes_mensalidade), duas variações de maiúscula/minúscula do mesmo
  // nome cru (ex.: "aiqfome" vs "Aiqfome") não podem virar duas linhas —
  // aqui tudo que bate pelo nome normalizado usa o mesmo rótulo (o primeiro
  // visto), sem depender do roster.
  const displayNameByNormalized = new Map<string, string>();
  items.forEach((item) => {
    const key = clientNameKey(item.cliente);
    if (!displayNameByNormalized.has(key)) displayNameByNormalized.set(key, item.cliente);
  });
  items.forEach((item) => {
    item.cliente = displayNameByNormalized.get(clientNameKey(item.cliente)) ?? item.cliente;
  });

  const ajusteMap = new Map<string, number>();
  ajustesResult.ajustes.forEach((a) => ajusteMap.set(ajusteKey(a.competencia, a.pessoa, a.cliente), a.valor));
  Object.entries(readLocalFallback()).forEach(([key, valor]) => ajusteMap.set(key, valor));

  return { items, roster, ajusteMap, ajustesDisponivel: ajustesResult.disponivel };
}

export interface VecCelula {
  pessoa: string;
  cliente: string;
  valorCalculado: number;
  valorFinal: number;
  ajustado: boolean;
  itens: VecItem[];
}

export interface VecLinha {
  cliente: string;
  celulas: Record<string, VecCelula>;
  total: number;
  rosterEntry: ClienteMensalidade | null;
}

// Prefere o cadastro exato do mês selecionado; se não existir (cliente ainda
// não recadastrado nesse mês), usa o cadastro mais recente disponível — é
// assim que um valor de mensalidade "vale até alguém mudar" na prática.
function findRosterEntry(roster: ClienteMensalidade[], cliente: string, competencia: string): ClienteMensalidade | null {
  const clienteKey = clientNameKey(cliente);
  const doCliente = roster.filter((r) => clientNameKey(r.cliente) === clienteKey);
  if (!doCliente.length) return null;
  const exato = doCliente.find((r) => r.competencia === competencia);
  if (exato) return exato;
  return [...doCliente].sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
}

export interface VecMatrizFiltros {
  competencia: string | 'all';
  pessoa: string | 'all';
  funcao: VecFuncao | 'all';
  soConcluidas: boolean;
}

export interface VecMatriz {
  linhas: VecLinha[];
  pessoas: string[];
  totalGeral: number;
  totalEdicao: number;
  totalDesign: number;
  tarefasFiltradas: number;
  itensNoPeriodo: number;
}

export function buildMatriz(
  { items, roster, ajusteMap }: VecLoadResult,
  filtros: VecMatrizFiltros,
  clientesExcluidos: Set<string>,
): VecMatriz {
  const filteredItems = items.filter((item) => {
    if (filtros.pessoa !== 'all' && item.pessoa !== filtros.pessoa) return false;
    if (filtros.funcao !== 'all' && item.funcao !== filtros.funcao) return false;
    if (filtros.soConcluidas && !item.concluida) return false;
    if (clientesExcluidos.has(clientNameKey(item.cliente))) return false;
    return true;
  });

  // Agrupa por (competência, pessoa, cliente) primeiro pra poder aplicar o
  // ajuste manual (que é por mês) antes de somar entre meses quando o filtro
  // de mês estiver em "Todos".
  const grupos = new Map<string, { competencia: string; pessoa: string; cliente: string; calculado: number; itens: VecItem[] }>();
  filteredItems.forEach((item) => {
    if (filtros.competencia !== 'all' && item.competencia !== filtros.competencia) return;
    const key = ajusteKey(item.competencia, item.pessoa, item.cliente);
    const grupo = grupos.get(key) ?? { competencia: item.competencia, pessoa: item.pessoa, cliente: item.cliente, calculado: 0, itens: [] };
    grupo.calculado += item.valor;
    grupo.itens.push(item);
    grupos.set(key, grupo);
  });

  const linhaMap = new Map<string, VecLinha>();
  const pessoasSet = new Set<string>();
  let totalGeral = 0;
  let totalEdicao = 0;
  let totalDesign = 0;

  grupos.forEach((grupo, key) => {
    const ajuste = ajusteMap.get(key);
    const valorFinal = ajuste ?? grupo.calculado;

    pessoasSet.add(grupo.pessoa);
    totalGeral += valorFinal;
    const funcao = grupo.itens[0]?.funcao;
    if (funcao === 'edicao') totalEdicao += valorFinal;
    if (funcao === 'design') totalDesign += valorFinal;

    const linha = linhaMap.get(grupo.cliente) ?? {
      cliente: grupo.cliente,
      celulas: {},
      total: 0,
      rosterEntry: findRosterEntry(roster, grupo.cliente, filtros.competencia !== 'all' ? filtros.competencia : grupo.competencia),
    };

    const celulaExistente = linha.celulas[grupo.pessoa];
    if (celulaExistente) {
      celulaExistente.valorCalculado += grupo.calculado;
      celulaExistente.valorFinal += valorFinal;
      celulaExistente.ajustado = celulaExistente.ajustado || ajuste !== undefined;
      celulaExistente.itens.push(...grupo.itens);
    } else {
      linha.celulas[grupo.pessoa] = {
        pessoa: grupo.pessoa,
        cliente: grupo.cliente,
        valorCalculado: grupo.calculado,
        valorFinal,
        ajustado: ajuste !== undefined,
        itens: [...grupo.itens],
      };
    }
    linha.total += valorFinal;
    linhaMap.set(grupo.cliente, linha);
  });

  const linhas = [...linhaMap.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));

  const itensDoPeriodo = filteredItems.filter((item) => filtros.competencia === 'all' || item.competencia === filtros.competencia);

  return {
    linhas,
    pessoas: [...pessoasSet],
    totalGeral,
    totalEdicao,
    totalDesign,
    tarefasFiltradas: itensDoPeriodo.length,
    itensNoPeriodo: itensDoPeriodo.reduce((sum, item) => sum + item.quantidade, 0),
  };
}
