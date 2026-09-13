import { sb } from './supabase';
import { normalized } from './captacaoFormat';

export interface RelatorioDesignRow {
  id: string;
  name: string;
  designer: string;
  tipo: string | null;
  status: string | null;
  criado_em: string;
  IDClickUp: string | null;
  datainicio: string | null;
}

export async function fetchRelatorioDesign(): Promise<RelatorioDesignRow[]> {
  const { data, error } = await sb
    .from('relatorio_design')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar public.relatorio_design: ${error.message}`);
  }

  return (data ?? []) as RelatorioDesignRow[];
}

export type DesignCategoria = 'Carrossel' | 'Estático' | 'Outros';

export interface ParsedDesignName {
  cliente: string;
  descricao: string;
  categoria: DesignCategoria;
  quantidade: number;
}

const CARROSSEL_QTD_RE = /(\d+)\s*carross\w*/gi;
const ESTATICO_QTD_RE = /(\d+)\s*est[áa]tic\w*/gi;
// Sem palavra-chave fixa pra "Outros" — soma qualquer "<número> <palavra>"
// solto (ex.: "1 capa Facebook e 1 capa LinkedIn" = 2). Exige espaço entre o
// número e a palavra, o que já livra números de medida colados tipo "1080p".
const GENERICO_QTD_RE = /(\d+)\s+[a-z]+/gi;

function sumMatches(text: string, pattern: RegExp): number {
  const matches = [...text.matchAll(pattern)];
  return matches.reduce((sum, match) => sum + Number(match[1]), 0);
}

// A coluna "tipo" da tabela nunca vem preenchida na prática — o cliente, o
// tipo de arte (carrossel/estático/outros) e a quantidade vêm embutidos no
// texto de "name", no formato "<Cliente> - <qtd> <tipo> (<responsável>)".
// Cada tarefa só entra em UMA categoria — a ordem de prioridade é
// Carrossel > Estático > Outros (uma tarefa "2 carrosséis + 3 estáticos"
// conta só como 2 carrosséis; é uma limitação conhecida, não bug).
export function parseDesignName(name: string): ParsedDesignName {
  const dashMatch = /^(.*?)\s*-\s*(.*)$/.exec(name.trim());
  const cliente = (dashMatch ? dashMatch[1] : name).trim() || name.trim();
  const rest = dashMatch ? dashMatch[2] : '';

  const trailingMatch = /^(.*)\([^()]*\)\s*$/.exec(rest);
  const descricao = (trailingMatch ? trailingMatch[1] : rest).trim();

  const normalizedDescricao = normalized(descricao);
  let categoria: DesignCategoria = 'Outros';
  if (normalizedDescricao.includes('carross')) categoria = 'Carrossel';
  else if (normalizedDescricao.includes('estatic')) categoria = 'Estático';

  let quantidade: number;
  if (categoria === 'Carrossel') quantidade = sumMatches(normalizedDescricao, CARROSSEL_QTD_RE) || 1;
  else if (categoria === 'Estático') quantidade = sumMatches(normalizedDescricao, ESTATICO_QTD_RE) || 1;
  else quantidade = sumMatches(normalizedDescricao, GENERICO_QTD_RE) || 1;

  return { cliente, descricao, categoria, quantidade };
}
