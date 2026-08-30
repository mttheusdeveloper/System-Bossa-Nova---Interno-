import { useState } from 'react';
import { normKey } from '../../lib/parse';
import { fmtBRL2 } from '../../lib/format';
import { moneyClass } from '../../lib/money';
import { buildDreModalRows, dreModalHaystack, type DreModalRow } from '../../lib/dre';
import { ModalShell } from './ModalShell';
import { useDashboard } from '../../state/DashboardContext';
import { useModals } from '../../state/ModalsContext';
import { useDreContext } from '../../hooks/useDreContext';

// Porta de openDreModal()/renderDreFullModal() (script.js:2775-2893).
export function DreModal() {
  const { dreOpen, closeDre } = useModals();
  const { state } = useDashboard();
  const dreContext = useDreContext(state.dreRows, state.mensalFilters);
  const [search, setSearch] = useState('');

  if (!dreOpen) return null;

  const rows = buildDreModalRows(dreContext);
  const hasData = dreContext.grupos.length > 0;
  const title = hasData ? `Detalhamento da DRE — ${dreContext.periodoLabel || ''}` : 'Detalhamento da DRE';
  const eyebrow = hasData ? `Total receitas: ${fmtBRL2(dreContext.totalReceitas || 0)}` : 'Sem dados da DRE';

  const terms = normKey(search).split(/\s+/).filter(Boolean);
  let rowsToRender: DreModalRow[];
  if (terms.length) {
    const matchedGroups = new Set(rows.filter((r) => r.type === 'item' && terms.every((t) => dreModalHaystack(r).includes(t))).map((r) => r.group));
    rowsToRender = rows.filter((r) => (r.type === 'group' ? matchedGroups.has(r.group) : matchedGroups.has(r.group) && terms.every((t) => dreModalHaystack(r).includes(t))));
  } else {
    rowsToRender = rows;
  }

  const itemTotal = rows.filter((r) => r.type === 'item').length;
  const itemFiltered = terms.length ? rowsToRender.filter((r) => r.type === 'item').length : itemTotal;

  return (
    <ModalShell onBackdropClick={closeDre}>
      <div className="card w-full max-w-5xl max-h-[88vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <div>
            <div className="section-eyebrow mb-1">{eyebrow}</div>
            <h2 className="font-semibold tracking-[-0.03em] text-lg">{title}</h2>
          </div>
          <button className="chip-btn" onClick={closeDre}>
            ✕ Fechar
          </button>
        </div>
        <div className="modal-toolbar px-6 py-3 border-b border-[var(--border)] flex flex-wrap items-center gap-3">
          <div className="modal-search-shell">
            <span className="modal-search-icon">⌕</span>
            <div className="modal-search-copy">
              <span className="modal-search-label">Busca na DRE</span>
              <input
                className="modal-search-input"
                placeholder="Busque por grupo, descrição, valor ou porcentagem"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button type="button" className="modal-search-clear" onClick={() => setSearch('')}>
                Limpar
              </button>
            )}
          </div>
          <span className="modal-filter-pill">{terms.length ? `Filtrando: ${itemFiltered}/${itemTotal}` : 'Pesquise em todas as colunas da DRE'}</span>
        </div>
        <div className="overflow-y-auto flex-1 annual-summary-scroll">
          <table className="w-full">
            <thead className="bg-black/75 backdrop-blur-sm sticky top-0">
              <tr>
                <th>Grupo</th>
                <th>Descrição</th>
                <th className="text-right">Valor</th>
                <th className="text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[var(--muted)] py-10">
                    Sem dados da DRE
                  </td>
                </tr>
              ) : rowsToRender.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[var(--muted)] py-10">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                rowsToRender.map((row, i) =>
                  row.type === 'group' ? (
                    <tr key={i} className="bg-[#0a0a0a] dre-group-row">
                      <td colSpan={4} className="text-[.68rem] uppercase tracking-[.14em] text-[var(--muted)] font-semibold">
                        {row.group}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td className="text-xs text-[var(--muted)]">{row.tipo}</td>
                      <td className="text-xs">{row.desc}</td>
                      <td className={`text-right mono ${moneyClass(row.valor || 0)}`}>{fmtBRL2(row.valor || 0)}</td>
                      <td className="text-right mono text-[var(--muted-2)]">{row.pct}</td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModalShell>
  );
}
