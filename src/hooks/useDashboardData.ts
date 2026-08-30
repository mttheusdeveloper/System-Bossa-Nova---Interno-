import { useCallback, useEffect, useRef } from 'react';
import { ACTIVE_MONTHS, MONTHS, TABLES } from '../lib/constants';
import { fetchTable } from '../lib/supabase';
import { validMensalRows } from '../lib/rows';
import type { DashboardAction } from '../state/dashboardReducer';
import type { RawRow } from '../types';

// Porta de loadAll(): busca em paralelo as tabelas Caixa <Mês> (só meses ativos),
// Financeiro 2026 e dre, e despacha o resultado no reducer.
export function useDashboardData(dispatch: (action: DashboardAction) => void) {
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    dispatch({ type: 'SET_STATUS', status: 'connecting' });
    try {
      const [mensalResults, anualRows, dreRows] = await Promise.all([
        Promise.all(ACTIVE_MONTHS.map((m) => fetchTable(TABLES[m.key] || m.table))),
        fetchTable(TABLES.anual),
        fetchTable(TABLES.dre),
      ]);

      const mensalRows: Record<string, RawRow[]> = Object.fromEntries(MONTHS.map((m) => [m.key, [] as RawRow[]]));
      ACTIVE_MONTHS.forEach((m, i) => {
        mensalRows[m.key] = mensalResults[i] || [];
      });

      dispatch({ type: 'DATA_LOADED', mensalRows, anualRows, dreRows });

      const totalMensal = ACTIVE_MONTHS.reduce((acc, m) => acc + validMensalRows(mensalRows[m.key]).length, 0);
      dispatch({ type: 'SET_STATUS', status: 'connected', count: totalMensal + anualRows.length + dreRows.length });
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_STATUS', status: 'error' });
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  return { reload: load };
}
