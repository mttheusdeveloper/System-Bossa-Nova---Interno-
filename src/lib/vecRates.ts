import { durationMinutes, normalized } from './captacaoFormat';
import type { AtaCaptacao } from './captacoes';

export const VALORES_COMPETENCIA_INICIAL = '2026-08';
export const CAPTACAO_PESSOA = 'Captações';
export const CAPTACAO_RATE_LABEL = 'R$ 300 / captação';

interface PessoaRate {
  funcao: 'edicao' | 'design';
  valorPorItem: number;
  unidade: string;
}

// Ordem fixa = ordem das colunas na planilha (Captações sempre primeiro, depois
// quem já está "cadastrado" aqui). Gente que aparecer no Supabase sem estar
// nessa lista ainda entra como coluna extra, usando o valor padrão da função.
export const VALORES_EQUIPE: Record<string, PessoaRate> = {
  João: { funcao: 'edicao', valorPorItem: 50, unidade: 'vídeo' },
  Davi: { funcao: 'edicao', valorPorItem: 25, unidade: 'vídeo' },
  Estela: { funcao: 'design', valorPorItem: 20, unidade: 'arte' },
  Matheus: { funcao: 'design', valorPorItem: 20, unidade: 'arte' },
  Lara: { funcao: 'design', valorPorItem: 20, unidade: 'arte' },
};

export const VALOR_PADRAO_EDICAO = 25;
export const VALOR_PADRAO_DESIGN = 20;

export function valorPorItem(pessoa: string, funcao: 'edicao' | 'design'): number {
  const cadastro = VALORES_EQUIPE[pessoa];
  if (cadastro) return cadastro.valorPorItem;
  return funcao === 'edicao' ? VALOR_PADRAO_EDICAO : VALOR_PADRAO_DESIGN;
}

export function rateLabel(pessoa: string): string {
  if (pessoa === CAPTACAO_PESSOA) return CAPTACAO_RATE_LABEL;
  const cadastro = VALORES_EQUIPE[pessoa];
  if (!cadastro) return 'não cadastrado';
  return `R$ ${cadastro.valorPorItem} / ${cadastro.unidade}`;
}

const PESSOA_ORDEM_CADASTRADA = [CAPTACAO_PESSOA, ...Object.keys(VALORES_EQUIPE)];

// Captações sempre primeiro, depois a equipe cadastrada na ordem definida
// acima, e por fim qualquer pessoa nova que apareça nos dados sem estar
// cadastrada ainda (ordenada por nome).
export function ordenarPessoas(pessoas: string[]): string[] {
  const presentes = new Set(pessoas);
  const cadastradas = PESSOA_ORDEM_CADASTRADA.filter((p) => presentes.has(p));
  const novas = pessoas.filter((p) => !PESSOA_ORDEM_CADASTRADA.includes(p)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...cadastradas, ...novas];
}

// Tabela especial do Gustavo, preservando os degraus usados pela operação.
function valorCaptacaoGustavo(minutos: number): number {
  if (minutos < 90) return 150;
  if (minutos < 120) return 175;
  if (minutos < 150) return 200;
  if (minutos < 180) return 225;
  if (minutos < 210) return 250;
  if (minutos < 240) return 300;
  if (minutos < 270) return 350;
  if (minutos < 300) return 425;
  if (minutos < 330) return 450;
  if (minutos < 360) return 475;
  if (minutos < 390) return 500;
  return 500 + Math.floor((minutos - 360) / 30) * 50;
}

// Exceção fixa: aiqfome começa zerada pro Gustavo até alguém ajustar a célula
// manualmente na planilha — dali em diante o ajuste manual sempre vence (ver
// vecAjustes.ts), então essa regra só importa enquanto não houver ajuste.
export function valorCaptacao(row: AtaCaptacao, clienteCanonico: string): number {
  const videomaker = normalized(row.videomaker);
  if (videomaker === 'pedro' || videomaker === 'marcos') return 300;
  if (videomaker === 'gustavo') {
    if (normalized(clienteCanonico) === 'aiqfome') return 0;
    return valorCaptacaoGustavo(durationMinutes(row));
  }
  return 0;
}
