import { useState } from 'react';
import { ChevronDown, LineChart, Cloud, FileText, Clapperboard, BarChart3, Table2, LogOut, type LucideIcon } from 'lucide-react';
import { useDashboard } from '../../state/DashboardContext';
import { useAuth } from '../../state/AuthContext';
import type { Tab } from '../../state/dashboardReducer';

interface NavGroup {
  type: 'group';
  key: string;
  label: string;
  icon: LucideIcon;
  hidden?: boolean;
  items: { tab: Tab; label: string }[];
}

interface NavStandalone {
  type: 'item';
  tab: Tab;
  label: string;
  icon: LucideIcon;
  hidden?: boolean;
}

type NavEntry = NavGroup | NavStandalone;

const NAV_ENTRIES: NavEntry[] = [
  {
    type: 'group',
    key: 'financeiro',
    label: 'Financeiro',
    icon: LineChart,
    items: [
      { tab: 'mensal', label: 'Comparativo Mensal' },
      { tab: 'anual', label: 'Visão Anual 2026' },
    ],
  },
  {
    type: 'group',
    key: 'google',
    label: 'Google',
    icon: Cloud,
    hidden: true,
    items: [
      { tab: 'drive', label: 'Google Drive' },
      { tab: 'sheets', label: 'Planilhas' },
    ],
  },
  { type: 'item', tab: 'contratos', label: 'Contratos', icon: FileText, hidden: true },
  {
    type: 'group',
    key: 'captacao',
    label: 'Captação',
    icon: Clapperboard,
    items: [
      { tab: 'captacao', label: 'Relatório de captações' },
      { tab: 'feedback-captacao', label: 'Feedback Captação' },
    ],
  },
  {
    type: 'group',
    key: 'equipe',
    label: 'Equipe',
    icon: BarChart3,
    items: [
      { tab: 'designers', label: 'Relatório Designers' },
      { tab: 'edicoes', label: 'Relatório Edições' },
    ],
  },
  {
    type: 'group',
    key: 'vec',
    label: 'VEC Relatórios',
    icon: Table2,
    items: [
      { tab: 'vec-planilha', label: 'VEC Planilha' },
      { tab: 'vec-custos', label: 'Dashboard de custos' },
    ],
  },
];

function groupKeyOf(tab: Tab): string | undefined {
  return NAV_ENTRIES.find((e): e is NavGroup => e.type === 'group' && e.items.some((i) => i.tab === tab))?.key;
}

const firstGroupKey = NAV_ENTRIES.find((e): e is NavGroup => e.type === 'group')?.key;

export function Sidebar() {
  const { state, dispatch } = useDashboard();
  const { session, signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([groupKeyOf(state.tab) ?? firstGroupKey ?? '']));

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 hidden lg:flex flex-col gap-6 sticky top-0 h-screen">
      <div className="flex flex-col items-center gap-4 px-2 text-center brand-header">
        <div className="brand-logo-box">
          <img src="/assets/logo-bossa.png" alt="Logo Bossa Nova" />
        </div>
        <div className="brand-name">Bossa Nova</div>
      </div>

      <nav className="flex flex-col gap-1">
        <div className="text-[.6rem] uppercase tracking-widest text-[var(--muted)] px-3 mb-1">Workspace</div>
        {NAV_ENTRIES.filter((entry) => !entry.hidden).map((entry) => {
          if (entry.type === 'item') {
            const Icon = entry.icon;
            return (
              <div
                key={entry.tab}
                className={`nav-item nav-item-standalone ${state.tab === entry.tab ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: entry.tab })}
              >
                <Icon size={15} strokeWidth={2} />
                {entry.label}
              </div>
            );
          }

          const isOpen = openGroups.has(entry.key);
          const Icon = entry.icon;
          return (
            <div key={entry.key}>
              <button type="button" className="nav-group-header" onClick={() => toggleGroup(entry.key)}>
                <span className="flex items-center gap-2.5">
                  <Icon size={15} strokeWidth={2} />
                  {entry.label}
                </span>
                <ChevronDown size={13} strokeWidth={2.5} className={`nav-group-chevron ${isOpen ? 'open' : ''}`} />
              </button>
              <div className={`nav-subgroup-collapse ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
                <div>
                  <ul className="nav-subgroup">
                    {entry.items.map((item) => (
                      <li key={item.tab}>
                        <div
                          className={`nav-item ${state.tab === item.tab ? 'active' : ''}`}
                          onClick={() => dispatch({ type: 'SET_TAB', tab: item.tab })}
                        >
                          {item.label}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 px-2">
        <span className="text-[.68rem] text-[var(--muted)] truncate" title={session?.user.email ?? ''}>
          {session?.user.email}
        </span>
        <button
          type="button"
          aria-label="Sair"
          title="Sair"
          className="shrink-0 text-[var(--muted)] hover:text-[#F87171]"
          onClick={() => void signOut()}
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
