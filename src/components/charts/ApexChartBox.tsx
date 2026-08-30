import { useRef, type MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useApexChart } from '../../hooks/useApexChart';

interface ApexChartBoxProps {
  id: string;
  options: ApexOptions | null;
  className?: string;
  chartRef?: MutableRefObject<ApexCharts | null>;
}

// A animação "de subida" nativa do ApexCharts (chart.animations) não é
// confiável aqui: o React StrictMode (main.tsx) destrói e recria o gráfico
// duas vezes assim que ele monta, o que atropela a animação de entrada do
// ApexCharts antes dela terminar. Em vez de depender disso, o CONTÊINER do
// gráfico é revelado de baixo pra cima via clip-path (framer-motion) — dá o
// efeito de "subida" sem esticar/distorcer os eixos e rótulos (o que um
// scaleY no container inteiro faria), e cobre os ~14 gráficos de uma vez só
// por passar por aqui.
export function ApexChartBox({ id, options, className, chartRef }: ApexChartBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useApexChart(containerRef, options, id, chartRef);

  return (
    <motion.div
      id={id}
      className={className}
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0 0)' }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </motion.div>
  );
}
