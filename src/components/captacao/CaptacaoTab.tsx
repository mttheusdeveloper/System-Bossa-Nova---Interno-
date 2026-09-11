import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronRight, FileText, RefreshCw, X } from 'lucide-react';
import { captacaoDateParts, dateTimestamp, durationMinutes, formatCreatedAt, formatDate, formatDuration, normalized } from '../../lib/captacaoFormat';
import { fetchAtasCaptacao, type AtaCaptacao } from '../../lib/captacoes';
import { CaptacaoOverview } from './CaptacaoOverview';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import { SearchInput } from '../shared/SearchInput';
import { FilterSelect, type FilterOption } from '../shared/FilterSelect';
import { OriginButton } from '../ui/origin-button';
import { ModalShell } from '../modals/ModalShell';
import { motion } from 'framer-motion';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CURRENT_DATE = new Date();
const CURRENT_MONTH_VALUE = `${CURRENT_DATE.getFullYear()}-${String(CURRENT_DATE.getMonth() + 1).padStart(2, '0')}`;

function filterOptions(rows: AtaCaptacao[], field: 'videomaker' | 'tipo_equipamento'): FilterOption[] {
  return [...new Set(rows.map((row) => row[field].trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((value) => ({ value, label: value }));
}

function monthValue(value: string): string {
  const parts = captacaoDateParts(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : '';
}

function monthOptions(rows: AtaCaptacao[]): FilterOption[] {
  const availableMonths = new Map<string, FilterOption & { sortValue: number }>();
  availableMonths.set(CURRENT_MONTH_VALUE, {
    value: CURRENT_MONTH_VALUE,
    label: `${MONTH_LABELS[CURRENT_DATE.getMonth()]}/${String(CURRENT_DATE.getFullYear()).slice(-2)}`,
    sortValue: CURRENT_DATE.getFullYear() * 100 + CURRENT_DATE.getMonth() + 1,
  });

  rows.forEach((row) => {
    const parts = captacaoDateParts(row.data_captacao);
    if (!parts) return;

    const value = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    availableMonths.set(value, {
      value,
      label: `${MONTH_LABELS[parts.month - 1]}/${String(parts.year).slice(-2)}`,
      sortValue: parts.year * 100 + parts.month,
    });
  });

  return [...availableMonths.values()]
    .sort((a, b) => b.sortValue - a.sortValue)
    .map(({ value, label }) => ({ value, label }));
}

export function CaptacaoTab() {
  const [rows, setRows] = useState<AtaCaptacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(CURRENT_MONTH_VALUE);
  const [videomaker, setVideomaker] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [atasOpen, setAtasOpen] = useState(false);
  const atasButtonRef = useRef<HTMLButtonElement>(null);

  const closeAtasModal = useCallback(() => {
    setAtasOpen(false);
    setExpandedId(null);
    requestAnimationFrame(() => atasButtonRef.current?.focus());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAtasCaptacao();
      setRows(
        [...result].sort(
          (a, b) => dateTimestamp(b.data_captacao) - dateTimestamp(a.data_captacao) || Date.parse(b.criado_em) - Date.parse(a.criado_em),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o relatório de captações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!atasOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (expandedId) setExpandedId(null);
      else closeAtasModal();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [atasOpen, closeAtasModal, expandedId]);

  const videomakers = useMemo(() => filterOptions(rows, 'videomaker'), [rows]);
  const equipmentTypes = useMemo(() => filterOptions(rows, 'tipo_equipamento'), [rows]);
  const months = useMemo(() => monthOptions(rows), [rows]);

  const filteredRows = useMemo(() => {
    const query = normalized(search);
    return rows.filter((row) => {
      if (month !== 'all' && monthValue(row.data_captacao) !== month) return false;
      if (videomaker !== 'all' && row.videomaker !== videomaker) return false;
      if (equipment !== 'all' && row.tipo_equipamento !== equipment) return false;
      if (!query) return true;
      return [
        row.empresa,
        row.data_captacao,
        row.videomaker,
        row.tipo_equipamento,
        row.feedback_cliente,
        row.checklist_videos,
        row.problemas_solucoes,
      ].some((value) => normalized(value).includes(query));
    });
  }, [equipment, month, rows, search, videomaker]);
  const selectedAta = expandedId ? rows.find((row) => row.id === expandedId) || null : null;

  const filtersActive = Boolean(search || month !== 'all' || videomaker !== 'all' || equipment !== 'all');

  function clearFilters() {
    setSearch('');
    setMonth(CURRENT_MONTH_VALUE);
    setVideomaker('all');
    setEquipment('all');
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-[-0.03em] text-lg">Visão geral das captações</h2>
          <p className="text-xs text-[var(--muted-2)] mt-1">Dados sincronizados da tabela public.atas_captacao.</p>
        </div>
        <OriginButton className="h-9 px-4 text-[.78rem]" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </OriginButton>
      </div>

      {loading && rows.length === 0 ? (
        <LoadingSkeleton label="Carregando captações…" />
      ) : error ? (
        <div className="card p-8 text-center">
          <Camera className="w-8 h-8 mx-auto text-[#F87171] mb-3" />
          <p className="text-sm text-[#F87171]">{error}</p>
          <p className="text-xs text-[var(--muted)] mt-2">Confira se a tabela possui permissão SELECT para a chave usada pelo site.</p>
          <button className="chip-btn mt-4" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_190px_190px_auto] gap-3 items-end">
              <SearchInput label="Buscar empresa, videomaker ou conteúdo" value={search} onChange={setSearch} />
              <FilterSelect label="Mês" value={month} onChange={setMonth} options={months} />
              <FilterSelect label="Videomaker" value={videomaker} onChange={setVideomaker} options={videomakers} />
              <FilterSelect label="Equipamento" value={equipment} onChange={setEquipment} options={equipmentTypes} />
              {filtersActive && (
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={clearFilters}>
                  Limpar filtros
                </OriginButton>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              Mostrando <span className="text-[var(--accent)]">{filteredRows.length}</span> de {rows.length}{' '}
              {rows.length === 1 ? 'captação' : 'captações'}
            </div>
          </div>

          <CaptacaoOverview rows={filteredRows} />

          <OriginButton
            ref={atasButtonRef}
            className="w-full h-auto min-h-20 px-5 py-4 rounded-xl justify-start [&>span]:w-full [--ic-foreground:#fff]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-controls="atas-captacao-dialog"
            aria-expanded={atasOpen}
            aria-haspopup="dialog"
            onClick={() => setAtasOpen(true)}
          >
            <span className="flex w-full min-w-0 items-center justify-between gap-4 text-left">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/20">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold tracking-[-0.025em]">Ver atas de captação</span>
                  <span className="mt-1 block text-xs opacity-65">
                    {filteredRows.length} {filteredRows.length === 1 ? 'ata encontrada' : 'atas encontradas'} com os filtros atuais
                  </span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0" />
            </span>
          </OriginButton>

          {atasOpen &&
            createPortal(
              <ModalShell onBackdropClick={closeAtasModal}>
                <motion.div
                  id="atas-captacao-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="atas-captacao-title"
                  className="card flex flex-col overflow-hidden shadow-2xl"
                  style={{ width: 'min(1180px, calc(100vw - 2rem))', height: 'min(680px, calc(100vh - 3rem))' }}
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
                  <div>
                    <h3 id="atas-captacao-title" className="font-semibold tracking-[-0.025em] text-lg">
                      Atas de captação
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {filteredRows.length} {filteredRows.length === 1 ? 'registro encontrado' : 'registros encontrados'} — clique em “Ver” para abrir os detalhes.
                    </p>
                  </div>
                  <OriginButton
                    autoFocus
                    aria-label="Fechar atas de captação"
                    className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:var(--accent)]"
                    onClick={closeAtasModal}
                  >
                    <X className="h-4 w-4" />
                  </OriginButton>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {rows.length === 0 ? (
                    <EmptyState text="Nenhuma captação cadastrada." />
                  ) : filteredRows.length === 0 ? (
                    <EmptyState text="Nenhuma captação encontrada com esses filtros." />
                  ) : (
                    <table className="w-full min-w-[980px]">
                      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                        <tr>
                          <th>Data</th>
                          <th>Empresa</th>
                          <th>Videomaker</th>
                          <th>Equipamento</th>
                          <th>Captação</th>
                          <th>Duração</th>
                          <th className="w-24">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.id}>
                            <td className="mono whitespace-nowrap text-[var(--muted-2)]">{formatDate(row.data_captacao)}</td>
                            <td className="font-semibold text-[var(--text)]">{row.empresa}</td>
                            <td>{row.videomaker}</td>
                            <td>
                              <span className="pill normal-case tracking-normal">{row.tipo_equipamento}</span>
                            </td>
                            <td className="mono whitespace-nowrap">
                              {row.horario_inicio_captacao} – {row.horario_fim_captacao}
                            </td>
                            <td className="mono whitespace-nowrap text-[var(--accent)]">{formatDuration(durationMinutes(row))}</td>
                            <td>
                              <button
                                type="button"
                                className="chip-btn h-8 px-2.5"
                                aria-haspopup="dialog"
                                aria-controls="captacao-detail-dialog"
                                onClick={() => setExpandedId(row.id)}
                              >
                                Ver
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                </motion.div>
              </ModalShell>,
              document.body,
            )}

          {selectedAta &&
            createPortal(
              <ModalShell onBackdropClick={() => setExpandedId(null)}>
                <motion.div
                  id="captacao-detail-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="captacao-detail-title"
                  className="card w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <div className="section-eyebrow mb-1">Detalhes da ata</div>
                      <h3 id="captacao-detail-title" className="truncate font-semibold tracking-[-0.025em] text-lg">
                        {selectedAta.empresa}
                      </h3>
                    </div>
                    <OriginButton
                      autoFocus
                      aria-label="Fechar detalhes da ata"
                      className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:#fff]"
                      onClick={() => setExpandedId(null)}
                    >
                      <X className="h-4 w-4" />
                    </OriginButton>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Detail label="Data" value={formatDate(selectedAta.data_captacao)} />
                      <Detail label="Videomaker" value={selectedAta.videomaker} />
                      <Detail label="Equipamento" value={selectedAta.tipo_equipamento} />
                      <Detail label="Duração" value={formatDuration(durationMinutes(selectedAta))} />
                      <Detail label="Chegada da equipe" value={selectedAta.horario_chegada_equipe} />
                      <Detail label="Chegada do cliente" value={selectedAta.horario_chegada_cliente} />
                      <Detail label="Início da captação" value={selectedAta.horario_inicio_captacao} />
                      <Detail label="Fim da captação" value={selectedAta.horario_fim_captacao} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <Detail label="Feedback do cliente" value={selectedAta.feedback_cliente} long />
                      <Detail label="Checklist de vídeos" value={selectedAta.checklist_videos} long />
                      <Detail label="Problemas e soluções" value={selectedAta.problemas_solucoes} long />
                    </div>
                    <p className="mt-4 text-[.67rem] text-[var(--muted)]">Registro criado em {formatCreatedAt(selectedAta.criado_em)}</p>
                  </div>
                </motion.div>
              </ModalShell>,
              document.body,
            )}
        </>
      )}
    </section>
  );
}

function Detail({ label, value, long = false }: { label: string; value: ReactNode; long?: boolean }) {
  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 ${long ? 'min-h-28' : ''}`}>
      <div className="kpi-label mb-2">{label}</div>
      <div className="text-sm text-[var(--muted-2)] whitespace-pre-wrap break-words">{value || 'Não informado'}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-12 text-center">
      <Camera className="w-9 h-9 mx-auto text-[var(--muted)] mb-3" />
      <p className="text-sm text-[var(--muted-2)]">{text}</p>
    </div>
  );
}
