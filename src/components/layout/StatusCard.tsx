import { useDashboard } from '../../state/DashboardContext';

const STATUS_TEXT: Record<string, string> = {
  connecting: 'Carregando…',
  connected: 'Conectado',
  error: 'Erro de conexão',
};

const STATUS_CLASS: Record<string, string> = {
  connecting: 'text-amber-300',
  connected: 'text-emerald-300',
  error: 'text-rose-400',
};

export function StatusCard() {
  const { state } = useDashboard();

  return (
    <div className="mt-auto card-flat p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="pulse" />
        <span className="text-[.7rem] text-[var(--muted)] uppercase tracking-wider">Status</span>
      </div>
      <div className={`text-xs ${STATUS_CLASS[state.status]}`}>{STATUS_TEXT[state.status]}</div>
      {state.status === 'connected' && (
        <div className="text-[.65rem] text-[var(--muted)] mt-2">{state.statusCount} registros</div>
      )}
    </div>
  );
}
