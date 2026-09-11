// Aceita "1.234,56" (BR), "1234.56" (US) ou "R$ 80" — campo vazio devolve
// null, que no fluxo de ajuste de célula significa "remover o ajuste".
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/R\$\s*/gi, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
