import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Film, FileDown, Hash, PenTool, Printer, Search, Trash2, Wallet, X, type LucideIcon } from 'lucide-react';
import { fmtBRL2 } from '../../lib/format';
import { parseMoneyInput } from '../../lib/vecFormat';
import { ordenarPessoas, rateLabel, VALORES_COMPETENCIA_INICIAL } from '../../lib/vecRates';
import { ajusteKey, saveAjuste } from '../../lib/vecAjustes';
import { clientNameKey, upsertClienteMensalidade } from '../../lib/vecClientes';
import { buildMatriz, loadValores, type VecFuncao, type VecItem, type VecLinha, type VecLoadResult } from '../../lib/vecValores';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import { SearchInput } from '../shared/SearchInput';
import { FilterSelect, type FilterOption } from '../shared/FilterSelect';
import { OriginButton } from '../ui/origin-button';
import { ModalShell } from '../modals/ModalShell';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const NOW = new Date();
const CURRENT_COMPETENCIA = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;
const DEFAULT_COMPETENCIA = CURRENT_COMPETENCIA >= VALORES_COMPETENCIA_INICIAL ? CURRENT_COMPETENCIA : VALORES_COMPETENCIA_INICIAL;

const FUNCAO_OPTIONS: FilterOption[] = [
  { value: 'captacao', label: 'Captação' },
  { value: 'edicao', label: 'Edição' },
  { value: 'design', label: 'Design' },
];

const FINANCE_COLUMNS = [
  { key: 'valor_mensalidade', label: 'Mensalidade' },
  { key: 'margem', label: 'Margem' },
  { key: 'lucro_minimo', label: 'Lucro mínimo' },
  { key: 'custo_maximo', label: 'Custo máximo' },
] as const;
type FinanceKey = (typeof FINANCE_COLUMNS)[number]['key'];
type TableColumnKey = FinanceKey | 'total' | `pessoa:${string}`;

const EXCLUIDOS_KEY = 'bossa_vec_clientes_excluidos';
const HIDDEN_COLUMNS_KEY = 'bossa_vec_colunas_ocultas';
const DEFAULT_HIDDEN: TableColumnKey[] = ['valor_mensalidade', 'margem', 'lucro_minimo'];

function pessoaColumnKey(pessoa: string): `pessoa:${string}` {
  return `pessoa:${pessoa}`;
}

// Verde/vermelho comparado ao custo máximo cadastrado (não só "deu negativo")
// — sem custo máximo definido, cai no critério antigo (negativo = vermelho).
// Cor aplicada via style inline porque ".vec-values-table tbody td" (mais
// específico que uma classe utilitária do Tailwind) estava sempre vencendo e
// deixando o texto branco/cinza.
function totalTone(linha: VecLinha): string {
  const custoMaximo = linha.rosterEntry?.custo_maximo;
  if (custoMaximo != null) return linha.total > custoMaximo ? '#FB7185' : '#34D399';
  return linha.total < 0 ? '#FB7185' : '#34D399';
}

function monthLabel(competencia: string): string {
  const [year, month] = competencia.split('-').map(Number);
  return `${MONTH_NAMES[(month || 1) - 1]} de ${year}`;
}

function buildMonthOptions(items: VecItem[]): FilterOption[] {
  const set = new Set(items.map((i) => i.competencia));
  set.add(VALORES_COMPETENCIA_INICIAL);
  set.add(DEFAULT_COMPETENCIA);
  return [...set].sort((a, b) => b.localeCompare(a)).map((value) => ({ value, label: monthLabel(value) }));
}

function readExcluidos(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(EXCLUIDOS_KEY) || '[]') as string[];
    return new Set(raw.map(clientNameKey));
  } catch {
    return new Set();
  }
}

function writeExcluidos(set: Set<string>) {
  try {
    localStorage.setItem(EXCLUIDOS_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage indisponível — o cliente só reaparece no próximo refresh.
  }
}

function readHiddenColumns(): Set<TableColumnKey> {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_COLUMNS_KEY) || 'null') as TableColumnKey[] | null;
    return new Set(raw ?? DEFAULT_HIDDEN);
  } catch {
    return new Set(DEFAULT_HIDDEN);
  }
}

function writeHiddenColumns(set: Set<TableColumnKey>) {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage indisponível — a preferência só não sobrevive a um refresh.
  }
}

export function VecPlanilhaTab() {
  const [loadResult, setLoadResult] = useState<VecLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mes, setMes] = useState<string>(DEFAULT_COMPETENCIA);
  const [pessoaFiltro, setPessoaFiltro] = useState('all');
  const [funcaoFiltro, setFuncaoFiltro] = useState<VecFuncao | 'all'>('all');
  const [soConcluidas, setSoConcluidas] = useState(false);
  const [search, setSearch] = useState('');

  const [clientesExcluidos, setClientesExcluidos] = useState<Set<string>>(() => readExcluidos());
  const [hiddenColumns, setHiddenColumns] = useState<Set<TableColumnKey>>(() => readHiddenColumns());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  const [editing, setEditing] = useState<{ cliente: string; pessoa: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [detailFor, setDetailFor] = useState<{ cliente: string; pessoa: string | null; itens: VecItem[] } | null>(null);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLoadResult(await loadValores());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a planilha de valores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const months = useMemo(() => buildMonthOptions(loadResult?.items ?? []), [loadResult]);
  const pessoasTodas = useMemo(() => ordenarPessoas([...new Set((loadResult?.items ?? []).map((i) => i.pessoa))]), [loadResult]);
  const pessoaOptions: FilterOption[] = pessoasTodas.map((p) => ({ value: p, label: p }));

  const matriz = useMemo(() => {
    if (!loadResult) return null;
    return buildMatriz(loadResult, { competencia: mes, pessoa: pessoaFiltro, funcao: funcaoFiltro, soConcluidas }, clientesExcluidos);
  }, [loadResult, mes, pessoaFiltro, funcaoFiltro, soConcluidas, clientesExcluidos]);

  const pessoasColunas = useMemo(() => (matriz ? ordenarPessoas(matriz.pessoas) : []), [matriz]);
  const pessoasVisiveis = useMemo(
    () => pessoasColunas.filter((pessoa) => !hiddenColumns.has(pessoaColumnKey(pessoa))),
    [pessoasColunas, hiddenColumns],
  );
  const financeColumnsVisiveis = useMemo(
    () => FINANCE_COLUMNS.filter((col) => !hiddenColumns.has(col.key)),
    [hiddenColumns],
  );
  const columnOptions = useMemo<Array<{ key: TableColumnKey; label: string }>>(
    () => [
      ...pessoasColunas.map((pessoa) => ({ key: pessoaColumnKey(pessoa), label: pessoa })),
      { key: 'total', label: 'Total' },
      ...FINANCE_COLUMNS,
    ],
    [pessoasColunas],
  );
  const hiddenColumnCount = columnOptions.filter((col) => hiddenColumns.has(col.key)).length;

  const visibleLinhas = useMemo(() => {
    if (!matriz) return [];
    const query = clientNameKey(search);
    if (!query) return matriz.linhas;
    return matriz.linhas.filter((linha) => clientNameKey(linha.cliente).includes(query));
  }, [matriz, search]);

  const canEdit = Boolean(loadResult?.ajustesDisponivel) && mes !== 'all' && !soConcluidas;
  const filtersActive = pessoaFiltro !== 'all' || funcaoFiltro !== 'all' || soConcluidas || mes !== DEFAULT_COMPETENCIA;

  function clearFilters() {
    setMes(DEFAULT_COMPETENCIA);
    setPessoaFiltro('all');
    setFuncaoFiltro('all');
    setSoConcluidas(false);
  }

  function startEdit(linha: VecLinha, pessoa: string) {
    if (!canEdit) return;
    setEditing({ cliente: linha.cliente, pessoa });
    const atual = linha.celulas[pessoa]?.valorFinal;
    setEditValue(atual == null ? '' : String(atual).replace('.', ','));
  }

  async function commitEdit(linha: VecLinha, pessoa: string) {
    const parsed = parseMoneyInput(editValue);
    setEditing(null);
    const valorAtual = linha.celulas[pessoa]?.valorFinal ?? null;
    const valorNaoMudou =
      (parsed === null && valorAtual === null) ||
      (parsed !== null && valorAtual !== null && Math.abs(parsed - valorAtual) < 0.005);

    if (valorNaoMudou) return;

    const { savedLocally } = await saveAjuste(mes, pessoa, linha.cliente, parsed);
    setLoadResult((prev) => {
      if (!prev) return prev;
      const nextMap = new Map(prev.ajusteMap);
      const key = ajusteKey(mes, pessoa, linha.cliente);
      if (parsed === null) nextMap.delete(key);
      else nextMap.set(key, parsed);
      return { ...prev, ajusteMap: nextMap };
    });
    if (savedLocally) setToast('Salvo neste navegador — o Supabase bloqueou o salvamento agora.');
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, linha: VecLinha, pessoa: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit(linha, pessoa);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      void commitEdit(linha, pessoa);
      const idx = pessoasVisiveis.indexOf(pessoa);
      const next = pessoasVisiveis[idx + 1];
      if (next) startEdit(linha, next);
    }
  }

  function toggleExcluirCliente(cliente: string) {
    if (!window.confirm(`Remover "${cliente}" da planilha? As tarefas continuam intactas no Supabase, só ficam invisíveis aqui.`)) return;
    setClientesExcluidos((prev) => {
      const next = new Set(prev);
      next.add(clientNameKey(cliente));
      writeExcluidos(next);
      return next;
    });
  }

  function toggleColuna(key: TableColumnKey) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeHiddenColumns(next);
      return next;
    });
  }

  async function saveFinanceiro(linha: VecLinha, key: FinanceKey, valor: number | null) {
    const entry = linha.rosterEntry;
    const competencia = mes !== 'all' ? mes : DEFAULT_COMPETENCIA;
    try {
      await upsertClienteMensalidade({
        cliente: linha.cliente,
        competencia,
        valor_mensalidade: key === 'valor_mensalidade' ? valor : (entry?.valor_mensalidade ?? null),
        margem: key === 'margem' ? valor : (entry?.margem ?? null),
        lucro_minimo: key === 'lucro_minimo' ? valor : (entry?.lucro_minimo ?? null),
        custo_maximo: key === 'custo_maximo' ? valor : (entry?.custo_maximo ?? null),
      });
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Não foi possível salvar esse valor.');
    }
  }

  function openDetail(cliente: string, pessoa: string | null) {
    if (!matriz) return;
    const linha = matriz.linhas.find((l) => l.cliente === cliente);
    if (!linha) return;
    const itens = pessoa ? (linha.celulas[pessoa]?.itens ?? []) : Object.values(linha.celulas).flatMap((c) => c.itens);
    setDetailFor({ cliente, pessoa, itens: [...itens].sort((a, b) => b.data.localeCompare(a.data)) });
  }

  function downloadCsv() {
    const header = [
      'Cliente',
      ...pessoasVisiveis,
      ...(hiddenColumns.has('total') ? [] : ['Total']),
      ...financeColumnsVisiveis.map((col) => col.label),
    ];
    const rows = visibleLinhas.map((linha) => [
      linha.cliente,
      ...pessoasVisiveis.map((pessoa) => (linha.celulas[pessoa] ? fmtBRL2(linha.celulas[pessoa].valorFinal) : '')),
      ...(hiddenColumns.has('total') ? [] : [fmtBRL2(linha.total)]),
      ...financeColumnsVisiveis.map((col) => {
        const raw = linha.rosterEntry?.[col.key];
        return raw != null ? fmtBRL2(raw) : '';
      }),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planilha-vec-${mes}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="vec-page">
      <div className="vec-page-heading">
        <div className="vec-cost-eyebrow">VEC RELATÓRIOS</div>
        <h2 className="font-semibold tracking-[-0.03em] text-lg">Planilha de valores</h2>
        <p className="text-xs text-[var(--muted-2)] mt-1">Valores de edição, design e captações, organizados por cliente.</p>
      </div>

      {loading && !loadResult ? (
        <LoadingSkeleton label="Carregando planilha de valores…" />
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-[#F87171]">{error}</p>
          <button className="chip-btn mt-4" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      ) : matriz ? (
        <>
          {!loadResult?.ajustesDisponivel && (
            <div className="card vec-warning p-4 text-xs text-[#FBBF24] bg-[rgba(251,191,36,.08)] border-[rgba(251,191,36,.35)]">
              A tabela <code>valores_ajustes</code> ainda não existe no Supabase — os valores calculados abaixo estão corretos, mas a edição de
              células está desligada até essa tabela ser criada.
            </div>
          )}

          <div className="card vec-filter-panel">
            <div className="vec-filter-grid grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <FilterSelect label="Mês" value={mes} onChange={setMes} options={months} staticStyle />
              <FilterSelect label="Pessoa" value={pessoaFiltro} onChange={setPessoaFiltro} options={pessoaOptions} staticStyle />
              <FilterSelect label="Função" value={funcaoFiltro} onChange={(v) => setFuncaoFiltro(v as VecFuncao | 'all')} options={FUNCAO_OPTIONS} staticStyle />
              <div className="flex flex-col gap-1.5">
                <span className="kpi-label">Status</span>
                <button
                  type="button"
                  className="vec-status-button vec-static-filter-button w-full h-9 px-3 rounded-lg justify-start text-[.8rem] font-semibold tracking-[-0.02em]"
                  onClick={() => setSoConcluidas((v) => !v)}
                >
                  <span className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="truncate">{soConcluidas ? 'Só concluídas' : 'Todas as tarefas'}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-[var(--muted)]" />
                  </span>
                </button>
              </div>
              {filtersActive && (
                <button type="button" className="vec-clear-filters vec-static-filter-button h-9 px-4 rounded-lg text-[.78rem]" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          <div className="vec-task-count text-xs text-[var(--muted)]">
            Mostrando <span className="text-[var(--accent)]">{matriz.tarefasFiltradas}</span> tarefas no período selecionado
            {!canEdit && <span className="ml-2 text-[var(--muted)]">· edição de células desligada {soConcluidas ? '(filtro "só concluídas" ativo)' : mes === 'all' ? '(escolha um mês específico pra editar)' : ''}</span>}
          </div>

          <div className="vec-summary-grid grid grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard icon={Wallet} label="Total a pagar" value={fmtBRL2(matriz.totalGeral)} tone="green" />
            <SummaryCard icon={Film} label="Edição" value={fmtBRL2(matriz.totalEdicao)} />
            <SummaryCard icon={PenTool} label="Design" value={fmtBRL2(matriz.totalDesign)} tone="purple" />
            <SummaryCard icon={Hash} label="Itens no período" value={String(matriz.itensNoPeriodo)} tone="amber" />
          </div>

          <div className="card vec-sheet-card vec-print-area">
            <div className="vec-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold tracking-[-0.025em]">
                Planilha de valores <span className="text-[var(--muted-2)] font-normal">· {visibleLinhas.length} clientes</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 vec-toolbar-actions">
                <SearchInput label="Filtrar cliente..." value={search} onChange={setSearch} className="vec-sheet-search w-56" />
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={downloadCsv}>
                  <FileDown className="w-3.5 h-3.5" />
                  Baixar planilha
                </OriginButton>
                <OriginButton className="h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" />
                  Baixar PDF
                </OriginButton>
                <OriginButton className="vec-new-client h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]" onClick={() => setNovoClienteOpen(true)}>
                  Novo cliente
                </OriginButton>
                <div className="relative">
                  <OriginButton
                    className="vec-columns-button h-9 px-4 rounded-lg text-[.78rem] [--ic-foreground:#fff]"
                    onClick={() => setColumnsMenuOpen((v) => !v)}
                  >
                    Colunas ({hiddenColumnCount} ocultas)
                  </OriginButton>
                  {columnsMenuOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-40 max-h-[min(70vh,32rem)] w-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
                      {columnOptions.map((col) => (
                        <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[.8rem] cursor-pointer hover:bg-[var(--surface-2)]">
                          <input type="checkbox" checked={!hiddenColumns.has(col.key)} onChange={() => toggleColuna(col.key)} />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="vec-table-wrap">
              <table className="vec-values-table">
                <colgroup>
                  <col
                    className="vec-client-col"
                    style={{ width: pessoasVisiveis.length === 0 && hiddenColumns.has('total') && financeColumnsVisiveis.length === 0 ? '100%' : undefined }}
                  />
                  {pessoasVisiveis.map((pessoa) => <col key={pessoa} />)}
                  {!hiddenColumns.has('total') && <col className="vec-total-col" />}
                  {financeColumnsVisiveis.map((col) => (
                    <col key={col.key} className="vec-finance-col" />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                  <tr>
                    <th>Cliente</th>
                    {pessoasVisiveis.map((pessoa) => (
                      <th key={pessoa} title={pessoa}>
                        <div className="vec-column-name">{pessoa}</div>
                        <div className="text-[9px] normal-case tracking-normal text-[var(--muted)] font-normal">{rateLabel(pessoa)}</div>
                      </th>
                    ))}
                    {!hiddenColumns.has('total') && <th className="text-[var(--accent)]">Total</th>}
                    {financeColumnsVisiveis.map((col) => (
                      <th key={col.key} className="whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLinhas.length === 0 ? (
                    <tr>
                      <td colSpan={1 + pessoasVisiveis.length + (hiddenColumns.has('total') ? 0 : 1) + financeColumnsVisiveis.length} className="text-center py-10 text-sm text-[var(--muted-2)]">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    visibleLinhas.map((linha) => (
                      <tr key={linha.cliente}>
                        <td className="font-semibold text-[var(--text)]">
                          <div className="vec-client-cell">
                            <button
                              type="button"
                              className="vec-client-name min-w-0 truncate text-left hover:underline"
                              title={linha.cliente}
                              onClick={() => openDetail(linha.cliente, null)}
                            >
                              {linha.cliente}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remover ${linha.cliente}`}
                              className="vec-client-remove shrink-0 text-[var(--muted)] hover:text-[#F87171]"
                              onClick={() => toggleExcluirCliente(linha.cliente)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        {pessoasVisiveis.map((pessoa) => {
                          const celula = linha.celulas[pessoa];
                          const isEditing = editing?.cliente === linha.cliente && editing.pessoa === pessoa;
                          return (
                            <td key={pessoa} className={canEdit ? 'cursor-pointer' : ''} onClick={() => !isEditing && startEdit(linha, pessoa)}>
                              {isEditing ? (
                                <input
                                  autoFocus
                                  className="w-full min-w-0 bg-[var(--surface-2)] border border-[var(--accent)] rounded px-1.5 py-1 text-[.8rem] text-[var(--text)]"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, linha, pessoa)}
                                  onBlur={() => void commitEdit(linha, pessoa)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : celula ? (
                                <span className={`vec-cell-value ${celula.ajustado ? 'text-[#FBBF24]' : 'text-[var(--text)]'}`}>
                                  <span className="whitespace-nowrap">{fmtBRL2(celula.valorFinal)}</span>
                                  <button
                                    type="button"
                                    aria-label={`Ver tarefas de ${pessoa} em ${linha.cliente}`}
                                    className="text-[var(--muted)] hover:text-[var(--accent)]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetail(linha.cliente, pessoa);
                                    }}
                                  >
                                    <Search className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>
                          );
                        })}
                        {!hiddenColumns.has('total') && (
                          <td
                            className="vec-total-value whitespace-nowrap font-semibold"
                            style={{ color: totalTone(linha) }}
                            title={
                              linha.rosterEntry?.custo_maximo != null
                                ? `Custo máximo: ${fmtBRL2(linha.rosterEntry.custo_maximo)}`
                                : fmtBRL2(linha.total)
                            }
                          >
                            {fmtBRL2(linha.total)}
                          </td>
                        )}
                        {financeColumnsVisiveis.map((col) => (
                          <FinanceCell key={col.key} linha={linha} colKey={col.key} onSave={(valor) => void saveFinanceiro(linha, col.key, valor)} />
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {detailFor && (
        <DetalheModal cliente={detailFor.cliente} pessoa={detailFor.pessoa} itens={detailFor.itens} onClose={() => setDetailFor(null)} />
      )}

      {novoClienteOpen && (
        <NovoClienteModal
          competenciaPadrao={mes !== 'all' ? mes : DEFAULT_COMPETENCIA}
          onClose={() => setNovoClienteOpen(false)}
          onSaved={async () => {
            setNovoClienteOpen(false);
            await load();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs text-[var(--text)] shadow-2xl">
          {toast}
        </div>
      )}
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: 'purple' | 'green' | 'amber' }) {
  return (
    <div className={`card vec-summary-card flex flex-col justify-between ${tone ? `tone-${tone}` : ''}`}>
      <div className="vec-summary-top">
        <span className="vec-summary-icon">
          <Icon />
        </span>
        <span className="vec-summary-label text-[var(--muted-2)]">{label}</span>
      </div>
      <strong className="vec-summary-value leading-none tracking-[-0.04em]">{value}</strong>
    </div>
  );
}

function FinanceCell({ linha, colKey, onSave }: { linha: VecLinha; colKey: FinanceKey; onSave: (valor: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const raw = linha.rosterEntry?.[colKey] ?? null;

  function commit() {
    setEditing(false);
    onSave(parseMoneyInput(value));
  }

  if (editing) {
    return (
      <td>
        <input
          autoFocus
          className="w-24 bg-[var(--surface-2)] border border-[var(--accent)] rounded px-1.5 py-1 text-[.8rem] text-[var(--text)]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commit}
        />
      </td>
    );
  }

  return (
    <td
      className="cursor-pointer whitespace-nowrap"
      onClick={() => {
        setValue(raw ? String(raw).replace('.', ',') : '');
        setEditing(true);
      }}
    >
      {raw !== null ? fmtBRL2(raw) : <span className="text-[var(--muted)]">—</span>}
    </td>
  );
}

function DetalheModal({ cliente, pessoa, itens, onClose }: { cliente: string; pessoa: string | null; itens: VecItem[]; onClose: () => void }) {
  return (
    <ModalShell onBackdropClick={onClose}>
      <div className="card w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="section-eyebrow mb-1">Detalhamento das tarefas</div>
            <h3 className="font-semibold tracking-[-0.025em] text-lg">
              {cliente}
              {pessoa ? ` · ${pessoa}` : ''}
            </h3>
          </div>
          <OriginButton autoFocus aria-label="Fechar" className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:#fff]" onClick={onClose}>
            <X className="h-4 w-4" />
          </OriginButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-2">
          {itens.length === 0 ? (
            <p className="text-sm text-[var(--muted-2)] text-center py-8">Nenhuma tarefa encontrada.</p>
          ) : (
            itens.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{item.descricao}</div>
                  <div className="text-xs text-[var(--muted-2)] mt-0.5">
                    {item.data} · {item.pessoa} · {item.quantidade} {item.quantidade === 1 ? 'item' : 'itens'}
                  </div>
                </div>
                <strong className="text-sm text-[var(--accent)] whitespace-nowrap">{fmtBRL2(item.valor)}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function NovoClienteModal({ competenciaPadrao, onClose, onSaved }: { competenciaPadrao: string; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState('');
  const [mensalidade, setMensalidade] = useState('');
  const [margem, setMargem] = useState('');
  const [lucroMinimo, setLucroMinimo] = useState('');
  const [custoMaximo, setCustoMaximo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nomeRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (!nome.trim()) {
      setError('Digite o nome do cliente.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertClienteMensalidade({
        cliente: nome.trim(),
        competencia: competenciaPadrao,
        valor_mensalidade: parseMoneyInput(mensalidade),
        margem: parseMoneyInput(margem),
        lucro_minimo: parseMoneyInput(lucroMinimo),
        custo_maximo: parseMoneyInput(custoMaximo),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onBackdropClick={onClose}>
      <div className="card w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold tracking-[-0.025em] text-lg">Novo cliente</h3>
          <OriginButton aria-label="Fechar" className="h-9 w-9 shrink-0 rounded-lg p-0 [--ic-foreground:#fff]" onClick={onClose}>
            <X className="h-4 w-4" />
          </OriginButton>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Nome do cliente">
            <input ref={nomeRef} className="w-full" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mensalidade">
              <input className="w-full" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} />
            </Field>
            <Field label="Margem">
              <input className="w-full" value={margem} onChange={(e) => setMargem(e.target.value)} />
            </Field>
            <Field label="Lucro mínimo">
              <input className="w-full" value={lucroMinimo} onChange={(e) => setLucroMinimo(e.target.value)} />
            </Field>
            <Field label="Custo máximo">
              <input className="w-full" value={custoMaximo} onChange={(e) => setCustoMaximo(e.target.value)} />
            </Field>
          </div>
          <div className="text-xs text-[var(--muted)]">Competência: {monthLabel(competenciaPadrao)}</div>
          {error && <p className="text-sm text-[#F87171]">{error}</p>}
          <OriginButton className="w-full h-10 rounded-lg [--ic-foreground:#fff]" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : 'Criar cliente'}
          </OriginButton>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="kpi-label">{label}</span>
      {children}
    </label>
  );
}
