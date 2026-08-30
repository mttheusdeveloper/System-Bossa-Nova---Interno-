import { useRef, type MutableRefObject } from 'react';
import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useApexChart } from '../../hooks/useApexChart';

interface ApexChartBoxProps {
  id: string;
  options: ApexOptions | null;
  className?: string;
  chartRef?: MutableRefObject<ApexCharts | null>;
}

export function ApexChartBox({ id, options, className, chartRef }: ApexChartBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useApexChart(containerRef, options, id, chartRef);
  return <div id={id} ref={containerRef} className={className} />;
}
