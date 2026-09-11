import type { AtaCaptacao } from './captacoes';

export interface CaptacaoDateParts {
  day: number;
  month: number;
  year: number;
}

export function normalized(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function captacaoDateParts(value: string): CaptacaoDateParts | null {
  const text = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (br) return { day: Number(br[1]), month: Number(br[2]), year: Number(br[3]) };

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return { day: Number(iso[3]), month: Number(iso[2]), year: Number(iso[1]) };

  return null;
}

export function dateTimestamp(value: string): number {
  const parts = captacaoDateParts(value);
  if (parts) return Date.UTC(parts.year, parts.month - 1, parts.day);

  const parsed = Date.parse(value.trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDate(value: string): string {
  const parts = captacaoDateParts(value);
  if (!parts) return value.trim() || '—';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

function timeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function durationMinutes(row: AtaCaptacao): number {
  const start = timeToMinutes(row.horario_inicio_captacao);
  const end = timeToMinutes(row.horario_fim_captacao);
  if (start === null || end === null) return 0;
  return end >= start ? end - start : 24 * 60 - start + end;
}

export function formatDuration(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
}

export function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
