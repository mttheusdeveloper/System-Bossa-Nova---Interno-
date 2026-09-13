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

// Palavras que indicam "isto é um vídeo/entregável" — um número só conta
// como quantidade quando vem colado numa dessas. Isso já exclui de graça
// números de medida tipo "30 segundos", "1080p", "4K", "60fps" (nenhuma
// dessas palavras está na lista, e "1080p"/"60fps" nem têm espaço antes do
// número pra bater com o \s* do regex).
const EDICAO_QUANTIDADE_PALAVRAS = [
  'v[íi]deos?',
  'edi[cç][õo]es?',
  'reels?',
  'stor(?:y|ies)',
  'cortes?',
  'shorts?',
  'clipes?',
  'pe[çc]as?',
  'depoimentos?',
  'entrevistas?',
].join('|');
const EDICAO_QUANTIDADE_RE = new RegExp(`(\\d+)\\s*(?:${EDICAO_QUANTIDADE_PALAVRAS})`, 'gi');

// Soma TODAS as ocorrências de "<número> <palavra-chave>" no nome da tarefa
// (ex.: "2 vídeos + 3 reels" = 5) — sem nenhuma delas, conta como 1 vídeo.
export function extractEdicaoQuantidade(name: string | null): number {
  if (!name) return 1;
  const matches = [...name.matchAll(EDICAO_QUANTIDADE_RE)];
  if (!matches.length) return 1;
  return matches.reduce((sum, match) => sum + Number(match[1]), 0);
}
