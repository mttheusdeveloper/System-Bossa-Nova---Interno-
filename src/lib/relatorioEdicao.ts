import { sb } from './supabase';

export interface RelatorioEdicaoRow {
  id: number;
  name: string | null;
  editor: string | null;
  status: string | null;
  criado_em: string;
  idclick: string | null;
  datainicio: string | null;
}

export async function fetchRelatorioEdicao(): Promise<RelatorioEdicaoRow[]> {
  const { data, error } = await sb
    .from('relatorio_edicao')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar public.relatorio_edicao: ${error.message}`);
  }

  return (data ?? []) as RelatorioEdicaoRow[];
}

const EDICAO_PREFIX = /^edi[cç][aã]o\s+/i;

// O nome vem como "[Edição ]<Cliente> - <descrição>" (ex.: "Edição Manipullar
// - 4 vídeos", "Gherardi - 2 vídeos (ler descrição)") — sem tag de
// responsável entre parênteses no final, diferente do relatório de design.
export function parseEdicaoName(name: string | null): string {
  const cleaned = (name ?? '').trim().replace(EDICAO_PREFIX, '');
  const dashMatch = /^(.*?)\s*-\s*.*$/.exec(cleaned);
  const cliente = (dashMatch ? dashMatch[1] : cleaned).trim();
  return cliente || cleaned || 'Sem cliente';
}
