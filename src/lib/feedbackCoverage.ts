import type { AtaCaptacao } from './captacoes';
import { canonicalClientName, clientNameKey } from './vecClientes';
import type { RespostaPesquisa } from './respostasPesquisa';

export interface FeedbackCoverage {
  totalClients: number;
  respondedClients: string[];
  missingClients: string[];
  unmatchedRespondents: string[];
}

interface CaptacaoClient {
  key: string;
  name: string;
}

const RESPONSE_KEY_ALIASES: Record<string, string> = {
  'santos netmoveis': 'santos netimoveis',
};

function sortedNames(names: string[]): string[] {
  return names.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function responseKeys(row: RespostaPesquisa): string[] {
  return [row.empresa, row.nome]
    .map((value) => clientNameKey(value))
    .filter(Boolean)
    .map((key) => RESPONSE_KEY_ALIASES[key] ?? key);
}

function matchesClient(candidate: string, clientKey: string): boolean {
  if (candidate === clientKey) return true;

  // Algumas respostas trazem apenas a parte reconhecível do nome, como
  // "Arena" ou "Romulo", e outras acrescentam o segmento do negócio, como
  // "Restaurante Cantinho de Minas".
  return candidate.length >= 5 && (candidate.includes(clientKey) || clientKey.includes(candidate));
}

export function buildFeedbackCoverage(captacoes: AtaCaptacao[], respostas: RespostaPesquisa[]): FeedbackCoverage {
  const clientsByKey = new Map<string, CaptacaoClient>();

  captacoes.forEach((row) => {
    const name = canonicalClientName(row.empresa || '');
    const key = clientNameKey(name);
    if (key && !clientsByKey.has(key)) clientsByKey.set(key, { key, name });
  });

  const clients = [...clientsByKey.values()];
  const respondedKeys = new Set<string>();
  const unmatchedByKey = new Map<string, string>();

  respostas.forEach((row) => {
    const candidates = responseKeys(row);
    const matchedClient = clients.find((client) => candidates.some((candidate) => matchesClient(candidate, client.key)));

    if (matchedClient) {
      respondedKeys.add(matchedClient.key);
      return;
    }

    const displayName = (row.empresa || row.nome || '').trim();
    const displayKey = clientNameKey(displayName);
    if (displayKey && !unmatchedByKey.has(displayKey)) unmatchedByKey.set(displayKey, displayName);
  });

  return {
    totalClients: clients.length,
    respondedClients: sortedNames(clients.filter((client) => respondedKeys.has(client.key)).map((client) => client.name)),
    missingClients: sortedNames(clients.filter((client) => !respondedKeys.has(client.key)).map((client) => client.name)),
    unmatchedRespondents: sortedNames([...unmatchedByKey.values()]),
  };
}
