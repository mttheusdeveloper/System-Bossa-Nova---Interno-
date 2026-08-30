import { useDashboard } from '../../state/DashboardContext';
import type { Tab } from '../../state/dashboardReducer';
import { StatusCard } from './StatusCard';

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: 'mensal', label: 'Comparativo Mensal' },
  { tab: 'anual', label: 'Visão Anual 2026' },
];

export function Sidebar() {
  const { state, dispatch } = useDashboard();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 hidden lg:flex flex-col gap-6 sticky top-0 h-screen">
      <div className="flex items-center gap-3 px-2 brand-header">
        <div className="brand-logo-box">
          <img src="/assets/logo-virtus.png" alt="Logo Virtus" />
        </div>
        <div>
          <div className="brand-name">Virtus Ads</div>
          <div className="brand-subtitle">Finance OS</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <div className="text-[.6rem] uppercase tracking-widest text-[var(--muted)] px-3 mb-1">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.tab}
            className={`nav-item ${state.tab === item.tab ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: item.tab })}
          >
            <span className="dot" />
            {item.label}
          </div>
        ))}
      </nav>

      <StatusCard />
    </aside>
  );
}
