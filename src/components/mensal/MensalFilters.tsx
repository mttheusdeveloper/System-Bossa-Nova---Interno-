import { useMemo } from 'react';
import { C } from '../../lib/constants';
import { monthLabel } from '../../lib/months';
import { useDashboard } from '../../state/DashboardContext';
import { CategorySelect } from './CategorySelect';
import type { MensalDerived } from '../../hooks/useMensalDerived';

export function MensalFilters({ mensalDerived }: { mensalDerived: MensalDerived }) {
  const { state, dispatch } = useDashboard();
  const { mesesDisp, mesesSel, cat } = state.mensalFilters;

  const categories = useMemo(() => {
    const set = new Set<string>();
    mensalDerived.all.forEach((r) => {
      const c = r[C.cat];
      if (c) set.add(String(c));
    });
    return [...set].sort();
  }, [mensalDerived.all]);

  return (
    <div className="card p-5 monthly-filters-card">
      <div className="flex flex-wrap items-end gap-4">
        <div className="month-filter-block">
          <div className="kpi-label mb-1">
            Meses ativos <span className="text-[var(--muted)] normal-case">(clique p/ comparar)</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {mesesDisp.length ? (
              mesesDisp.map((key) => (
                <button
                  key={key}
                  className={`chip-btn ${mesesSel.has(key) ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'TOGGLE_MONTH_CHIP', key })}
                >
                  {monthLabel(key)}
                </button>
              ))
            ) : (
              <span className="text-xs text-[var(--muted)]">Sem dados</span>
            )}
          </div>
        </div>

        <div className="h-10 w-px bg-[var(--border)] mx-1 hidden md:block" />

        <CategorySelect value={cat} categories={categories} onChange={(value) => dispatch({ type: 'SET_CATEGORIA', value })} />

        <div className="ml-auto">
          <button className="chip-btn" onClick={() => dispatch({ type: 'CLEAR_MENSAL_FILTERS' })}>
            ✕ Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
