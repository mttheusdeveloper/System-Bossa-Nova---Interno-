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
}

// A coluna "tipo" da tabela nunca vem preenchida na prática — o cliente e o
// tipo de arte (carrossel/estático/story) vêm embutidos no texto de "name",
// no formato "<Cliente> - <qtd> <tipo> (<responsável>)". Aqui a gente separa
// isso pra poder filtrar/agrupar por cliente e classificar por tipo.
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

  return { cliente, descricao, categoria };
}
