import { sb } from './supabase';
import { normalized } from './captacaoFormat';

export interface ClienteMensalidade {
  id: string;
  cliente: string;
  competencia: string;
  valor_mensalidade: number | null;
  margem: number | null;
  lucro_minimo: number | null;
  custo_maximo: number | null;
  tipo_cliente: string | null;
  status_cliente: string | null;
}

export async function fetchClientesMensalidade(): Promise<ClienteMensalidade[]> {
  const { data, error } = await sb.from('clientes_mensalidade').select('*');
  if (error) {
    throw new Error(`Não foi possível carregar public.clientes_mensalidade: ${error.message}`);
  }
  return (data ?? []) as ClienteMensalidade[];
}

export async function upsertClienteMensalidade(payload: {
  cliente: string;
  competencia: string;
  valor_mensalidade: number | null;
  margem: number | null;
  lucro_minimo: number | null;
  custo_maximo: number | null;
}): Promise<void> {
  const { data: candidates, error: findError } = await sb
    .from('clientes_mensalidade')
    .select('id,cliente')
    .eq('competencia', payload.competencia);
  if (findError) throw new Error(findError.message);
  const payloadClientKey = clientNameKey(payload.cliente);
  const existing = (candidates ?? []).find((entry) => clientNameKey(entry.cliente) === payloadClientKey);

  if (existing) {
    const { error } = await sb.from('clientes_mensalidade').update({ ...payload, cliente: existing.cliente }).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('clientes_mensalidade').insert({ ...payload, status_cliente: 'ATIVO' });
    if (error) throw new Error(error.message);
  }
}

const CLIENT_ALIAS_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Aiqfome', ['Aiqfome', 'H&F Agenciamento', 'H&F Agenciamento de Empresas, Serviços e Negócios']],
  ['Arena Ouro Verde', ['Arena Ouro Verde', 'AOV']],
  ['Bão Experience', ['Bão Experience', 'BAO Experience', 'Bão']],
  ['Burguer Haus', ['Burguer Haus', 'Haus']],
  ['Ana Paula Vieira Silva', ['Ana Paula', 'Ana Paula (tráfego)', 'Ana Paula Vieira', 'Ana Paula Vieira Silva', 'Ana Paula Viera Silva']],
  ['Cantinho de Minas', ['Cantinho', 'Cantinho de Minas']],
  ['Casa de Repouso Relíquias', ['Casa de Repouso Relíquias', 'Casa de Repouso Reliquías', 'Relíquias']],
  ['Clínica Pró Vida', ['Clínica Pró Vida', 'Clinica Pró Vida', 'Pró Vida', 'VG Saúde', 'VG Saude', 'VG Saude LTDA']],
  ['Dr. Rafael Leão e Golden Clinic', ['Dr Rafael', 'Dr. Rafael', 'Dr. Rafael Leão', 'Golden', 'Golden Clinic', 'Dr. Rafael Leão & Golden Clinic', 'Dr. Rafael Leão e Golden Clinic']],
  ['Dra. Beatriz Gomes', ['Dra. Beatriz Gomes', 'Dra. Bia Gomes', 'Dra Bia Gomes', 'Dra. Beatriz Leão']],
  ['Dra. Carla Rezende', ['Dra Carla', 'Dra. Carla', 'Dra Carla Rezende', 'Dra. Carla Rezende']],
  ['Dra. Nathalie Silva', ['Nathalie', 'Dra Nathalie', 'Dra. Nathalie', 'Dra Nathalie Silva', 'Dra. Nathalie Silva']],
  ['Dra. Vanessa Lopes', ['Vanessa', 'Dra Vanessa', 'Dra. Vanessa', 'Dra. Vanessa Lopes']],
  ['Du Cheff', ['Du Cheff', 'Du cheff', 'DC', 'DC+']],
  ['Fazenda Prainha', ['Fazenda Prainha', 'Prainha']],
  ['Gherardi Cucina', ['Gherardi', 'Gherardi Cucina']],
  ['Mais Popular Drogajovem', ['Mais Popular Drogajovem', 'Drogajovem', 'Droga Jovem']],
  ['Pharmavity Manipullar', ['Pharmavity Manipullar', 'Manipullar']],
  ['Pizzaria Barão', ['Pizzaria Barão', 'Barão']],
  ['Premium Veículos', ['Premium', 'Premium Veículos', 'Premium Veiculos']],
  ['Radar Veículos', ['Radar', 'Radar Veículos', 'Nelson Adilson', 'Nelson Adilson Moreira Júnior']],
  ['Renata Reis Rodrigues e Castro', ['Dra Renata', 'Dra. Renata', 'Dra. Renata Reis', 'Renata Reis Rodrigues e Castro']],
  ['Santos Netimóveis', ['Santos', 'Santos Netimóveis']],
  ['Stone Light', ['Stone', 'Stone Light']],
  ['Supremo Burguer', ['Supremo', 'Supremo Burguer']],
  ['Valentino Pizzeria', ['Valentino', 'Valentino Pizzeria', 'Valentino Pizzeria Napoletana']],
  ['Dr. Rômulo de Castro', ['Dr Rômulo', 'Dr. Rômulo', 'Dr. Rômulo de Castro', 'Dr. Rômulo de Castro / Vitae', 'Vitae', 'Vitae Dr Rômulo de Castro']],
];

function formattingInsensitiveKey(value: string | null | undefined): string {
  return normalized(value)
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CANONICAL_NAME_BY_ALIAS = new Map<string, string>();
CLIENT_ALIAS_GROUPS.forEach(([canonicalName, aliases]) => {
  [canonicalName, ...aliases].forEach((alias) => CANONICAL_NAME_BY_ALIAS.set(formattingInsensitiveKey(alias), canonicalName));
});

/** Retorna o rótulo único usado para as variações de cliente conhecidas. */
export function canonicalClientName(rawName: string): string {
  const cleanName = rawName.trim();
  return CANONICAL_NAME_BY_ALIAS.get(formattingInsensitiveKey(cleanName)) ?? cleanName;
}

/** Chave estável para agrupamentos, filtros e comparações de clientes. */
export function clientNameKey(rawName: string | null | undefined): string {
  const formattingKey = formattingInsensitiveKey(rawName);
  const canonicalName = CANONICAL_NAME_BY_ALIAS.get(formattingKey);
  return formattingInsensitiveKey(canonicalName ?? rawName);
}

// A tabela clientes_mensalidade tem os nomes "oficiais" (razão social/nome
// completo) usados pra cobrança. As tarefas em relatorio_design/edicao e as
// atas de captação usam apelidos/abreviações do mesmo cliente — aqui a gente
// tenta casar um com o outro pra não duplicar linha na planilha. Quando não
// acha correspondência, mantém o nome como veio (fica sua própria linha).
export function canonicalClientDisplayName(rawName: string, roster: ClienteMensalidade[]): string {
  const cleanName = rawName.trim();
  const rawKey = formattingInsensitiveKey(cleanName);
  if (!rawKey) return cleanName;

  const explicitCanonicalName = CANONICAL_NAME_BY_ALIAS.get(rawKey);
  if (explicitCanonicalName) return explicitCanonicalName;

  const exact = roster.find((entry) => formattingInsensitiveKey(entry.cliente) === rawKey);
  if (exact) return exact.cliente;
  return cleanName;
}
