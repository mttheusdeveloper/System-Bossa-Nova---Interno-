import { sb } from './supabase';

export interface RespostaPesquisa {
  id: string;
  created_at: string;
  nota_captacao: number;
  nota_videomaker: number;
  nota_equipe: number;
  melhorias: string | null;
  nome: string | null;
  empresa: string | null;
}

export async function fetchRespostasPesquisa(): Promise<RespostaPesquisa[]> {
  const { data, error } = await sb
    .from('respostas_pesquisa')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar public.respostas_pesquisa: ${error.message}`);
  }

  return (data ?? []) as RespostaPesquisa[];
}
