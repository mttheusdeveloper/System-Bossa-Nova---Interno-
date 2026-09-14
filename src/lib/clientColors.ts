import { normalized } from './captacaoFormat';

// Paleta compartilhada — mesmo cliente sempre cai na mesma cor, em qualquer
// gráfico (Designers, Edições, ...), já que a cor é escolhida por hash do
// nome normalizado, não pela posição da barra.
const CLIENT_PALETTE = [
  '#5CABC4', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#60A5FA',
  '#F472B6', '#FB923C', '#4ADE80', '#818CF8', '#2DD4BF', '#FACC15',
  '#C084FC', '#38BDF8', '#A3E635', '#FB7185',
];

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function clientColor(name: string): string {
  const key = normalized(name);
  if (!key) return CLIENT_PALETTE[0];
  return CLIENT_PALETTE[hashString(key) % CLIENT_PALETTE.length];
}

export function clientColors(names: string[]): string[] {
  return names.map(clientColor);
}
