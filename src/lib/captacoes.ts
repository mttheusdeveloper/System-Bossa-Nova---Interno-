import { sb } from './supabase';

export interface AtaCaptacao {
  id: string;
  empresa: string;
  data_captacao: string;
  videomaker: string;
  tipo_equipamento: string;
  horario_chegada_equipe: string | null;
  horario_chegada_cliente: string | null;
  horario_inicio_captacao: string;
  horario_fim_captacao: string;
  feedback_cliente: string | null;
  checklist_videos: string | null;
  problemas_solucoes: string | null;
  criado_em: string;
}

export async function fetchAtasCaptacao(): Promise<AtaCaptacao[]> {
  const { data, error } = await sb
    .from('atas_captacao')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar public.atas_captacao: ${error.message}`);
  }

  return (data ?? []) as AtaCaptacao[];
}
