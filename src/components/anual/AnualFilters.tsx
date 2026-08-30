import { ACTIVE_MONTHS } from '../../lib/constants';
import { useDashboard } from '../../state/DashboardContext';

export function AnualFilters() {
  const { state, dispatch } = useDashboard();
  const { mMin, mMax } = state.anualFilters;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="kpi-label mb-1">Janela</div>
          <div className="flex items-center gap-1">
            <select className="w-24" value={mMin} onChange={(e) => dispatch({ type: 'SET_ANUAL_RANGE', mMin: +e.target.value, mMax })}>
              {ACTIVE_MONTHS.map((m, i) => (
                <option key={m.key} value={i}>
                  {m.short}
                </option>
              ))}
            </select>
            <span className="text-[var(--muted)]">→</span>
            <select className="w-24" value={mMax} onChange={(e) => dispatch({ type: 'SET_ANUAL_RANGE', mMin, mMax: +e.target.value })}>
              {ACTIVE_MONTHS.map((m, i) => (
                <option key={m.key} value={i}>
                  {m.short}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ml-auto">
          <button className="chip-btn" onClick={() => dispatch({ type: 'CLEAR_ANUAL_RANGE' })}>
            ✕ Resetar
          </button>
        </div>
      </div>
    </div>
  );
}
