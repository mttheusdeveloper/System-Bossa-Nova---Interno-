import { sb } from './supabase';
import { clientNameKey } from './vecClientes';

export interface AjusteValor {
  competencia: string;
  pessoa: string;
  cliente: string;
  valor: number;
}

const BROADCAST_CHANNEL_NAME = 'bossa-vec-dashboard';
const NOTIFY_KEY = 'bossa_vec_dashboard_updated_at';
const LOCAL_FALLBACK_KEY = 'bossa_vec_ajustes_fallback';

export function ajusteKey(competencia: string, pessoa: string, cliente: string): string {
  return `${competencia}::${pessoa}::${clientNameKey(cliente)}`;
}

function canonicalStoredAjusteKey(key: string): string {
  const [competencia, pessoa, ...clienteParts] = key.split('::');
  if (!competencia || !pessoa || !clienteParts.length) return key;
  return ajusteKey(competencia, pessoa, clienteParts.join('::'));
}

// Avisa outras abas (ex.: Dashboard de custos) que os valores mudaram, pra
// elas recarregarem — é só um "toque de campainha", sem payload de verdade.
export function notificarDashboard() {
  try {
    localStorage.setItem(NOTIFY_KEY, String(Date.now()));
  } catch {
    // localStorage indisponível — segue o jogo, só não avisa outras abas.
  }
  try {
    new BroadcastChannel(BROADCAST_CHANNEL_NAME).postMessage({ type: 'ajuste-atualizado', at: Date.now() });
  } catch {
    // BroadcastChannel indisponível nesse navegador — sem problema.
  }
}

export function readLocalFallback(): Record<string, number> {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_FALLBACK_KEY) || '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(stored).map(([key, value]) => [canonicalStoredAjusteKey(key), value]));
  } catch {
    return {};
  }
}

function writeLocalFallback(map: Record<string, number>) {
  try {
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(map));
  } catch {
    // localStorage indisponível — o ajuste só não sobrevive a um refresh.
  }
}

export interface FetchAjustesResult {
  ajustes: AjusteValor[];
  disponivel: boolean;
}

// Se a tabela valores_ajustes ainda não existir, o Supabase retorna um erro
// específico de "tabela não encontrada" — nesse caso a planilha continua
// mostrando os valores calculados, só desliga a edição de célula.
export async function fetchAjustes(): Promise<FetchAjustesResult> {
  const { data, error } = await sb.from('valores_ajustes').select('competencia,pessoa,cliente,valor');
  if (error) {
    return { ajustes: [], disponivel: false };
  }
  return { ajustes: (data ?? []) as AjusteValor[], disponivel: true };
}

// Upsert manual (select + update/insert) em vez de .upsert(onConflict:...)
// porque não temos garantia de que existe uma unique constraint em
// (competencia, pessoa, cliente) na tabela — assim funciona de qualquer jeito.
export async function saveAjuste(competencia: string, pessoa: string, cliente: string, valor: number | null): Promise<{ savedLocally: boolean }> {
  try {
    const { data: existing, error: findError } = await sb
      .from('valores_ajustes')
      .select('id')
      .eq('competencia', competencia)
      .eq('pessoa', pessoa)
      .eq('cliente', cliente)
      .maybeSingle();
    if (findError) throw findError;

    if (valor === null) {
      if (existing) {
        const { error } = await sb.from('valores_ajustes').delete().eq('id', existing.id);
        if (error) throw error;
      }
    } else if (existing) {
      const { error } = await sb.from('valores_ajustes').update({ valor, atualizado_em: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('valores_ajustes').insert({ competencia, pessoa, cliente, valor });
      if (error) throw error;
    }

    const map = readLocalFallback();
    delete map[ajusteKey(competencia, pessoa, cliente)];
    writeLocalFallback(map);
    notificarDashboard();
    return { savedLocally: false };
  } catch {
    const map = readLocalFallback();
    const key = ajusteKey(competencia, pessoa, cliente);
    if (valor === null) delete map[key];
    else map[key] = valor;
    writeLocalFallback(map);
    notificarDashboard();
    return { savedLocally: true };
  }
}
