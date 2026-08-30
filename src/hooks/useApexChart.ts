import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import { normalizeChartOptions, chartOptionSignature } from '../lib/chartOptions';
import { mergeOptions } from '../lib/chartTheme';

// Porta de upsert()/destroyChart() (script.js:2080-2122): cria o gráfico na
// primeira montagem, chama updateOptions() quando o tipo não muda, destrói e
// recria quando muda (ApexCharts falha ao trocar tipo via updateOptions), e
// pula updates sem alteração real via assinatura JSON das opções. Diferença
// vs. o legado: aqui o gráfico é destruído no unmount, já que o React
// desmonta ao trocar de aba em vez de só escondê-la via CSS.
//
// `externalChartRef` permite que o chamador (ex.: legenda custom do donut)
// acesse a mesma instância do ApexCharts sem precisar de forwardRef.
export function useApexChart(
  containerRef: RefObject<HTMLDivElement | null>,
  options: ApexOptions | null,
  chartId: string,
  externalChartRef?: MutableRefObject<ApexCharts | null>,
) {
  const internalRef = useRef<ApexCharts | null>(null);
  const chartRef = externalChartRef ?? internalRef;
  const typeRef = useRef<string | null>(null);
  const signatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !options) return;

    const normalized = normalizeChartOptions(mergeOptions(options as Record<string, unknown>, { chart: { id: chartId } }));
    const nextType = (normalized.chart?.type as string) || 'line';
    const signature = chartOptionSignature(normalized);

    if (chartRef.current && typeRef.current === nextType && signatureRef.current === signature) return;

    if (chartRef.current && typeRef.current !== nextType) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    signatureRef.current = signature;

    if (chartRef.current) {
      chartRef.current.updateOptions(normalized, false, false, false);
    } else {
      containerRef.current.innerHTML = '';
      chartRef.current = new ApexCharts(containerRef.current, normalized as ApexOptions);
      typeRef.current = nextType;
      chartRef.current.render();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, chartId]);

  useEffect(
    () => () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return chartRef;
}
