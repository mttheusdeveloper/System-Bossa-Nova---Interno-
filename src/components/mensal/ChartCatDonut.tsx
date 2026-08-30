import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type ApexCharts from 'apexcharts';
import { buildDonutOptions } from '../../lib/chartBuilders';
import { PALETTE } from '../../lib/chartTheme';
import { fmtBRL2 } from '../../lib/format';
import { moneyColor } from '../../lib/money';
import { ApexChartBox } from '../charts/ApexChartBox';
import { ChartCustomLegend } from '../charts/ChartCustomLegend';
import { useModals } from '../../state/ModalsContext';
import type { DreContext, DreItem } from '../../types';

interface HoverState {
  idx: number;
  x: number;
  y: number;
}

// Porta de renderDonutDre() (script.js:2378-2620): donut com tooltip custom
// que segue o mouse (o tooltip nativo do ApexCharts fica preso no SVG e corta
// nas bordas do card, por isso é feito manualmente aqui via portal pro body).
export function ChartCatDonut({ dreContext }: { dreContext: DreContext }) {
  const chartRef = useRef<ApexCharts | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const { openDre } = useModals();

  const grupos = dreContext.grupos;
  const donutLabels = grupos.length ? grupos.map((g) => g.label) : ['Sem dados'];
  const donutData = grupos.length ? grupos.map((g) => g.value) : [0];

  const options = useMemo(
    () => buildDonutOptions(donutData, donutLabels, PALETTE, dreContext.totalReceitas || null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [donutData.join(','), donutLabels.join(','), dreContext.totalReceitas],
  );

  const optionsWithEvents = useMemo(
    () => ({
      ...options,
      chart: {
        ...options.chart,
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dataPointMouseEnter: (event: MouseEvent, _ctx: any, config: any) => {
            const idx = typeof config?.dataPointIndex === 'number' && config.dataPointIndex >= 0 ? config.dataPointIndex : config?.seriesIndex;
            setHover({ idx, x: event.clientX, y: event.clientY });
          },
          mouseMove: (event: MouseEvent) => {
            setHover((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
          },
          dataPointMouseLeave: () => setHover(null),
          mouseLeave: () => setHover(null),
        },
      },
    }),
    [options],
  );

  useEffect(() => {
    if (!hover || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    let x = hover.x + 16;
    let y = hover.y + 16;
    if (x + rect.width > window.innerWidth - 12) x = hover.x - rect.width - 16;
    if (y + rect.height > window.innerHeight - 12) y = hover.y - rect.height - 16;
    setPos({ left: Math.max(12, x), top: Math.max(12, y) });
  }, [hover]);

  const grupo = hover ? grupos[hover.idx] : null;
  const totalPizza = donutData.reduce((acc, v) => acc + (Number(v) || 0), 0);
  const pctFatia = grupo && hover && totalPizza ? (((Number(donutData[hover.idx]) || 0) / totalPizza) * 100).toFixed(2) + '%' : '';

  return (
    <div className="card p-6 xl:col-span-2 min-h-[580px] flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="section-eyebrow mb-1">Mix</div>
          <h2 className="font-semibold tracking-[-0.03em] text-lg">Visão Geral</h2>
        </div>
        <button className="chip-btn text-[.68rem] whitespace-nowrap" onClick={openDre}>
          DRE completa
        </button>
      </div>
      <ApexChartBox id="chart-cat" chartRef={chartRef} options={optionsWithEvents} />
      <ChartCustomLegend chartRef={chartRef} labels={donutLabels} colors={PALETTE} />

      {typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{ position: 'fixed', zIndex: 999999, pointerEvents: 'none', left: pos.left, top: pos.top, opacity: grupo ? 1 : 0, transition: 'opacity .08s ease' }}
          >
            {grupo && <DreTooltip grupo={grupo} pctFatia={pctFatia} periodoLabel={dreContext.periodoLabel} />}
          </div>,
          document.body,
        )}
    </div>
  );
}

function DreTooltip({ grupo, pctFatia, periodoLabel }: { grupo: DreContext['grupos'][number]; pctFatia: string; periodoLabel: string }) {
  return (
    <div style={{ minWidth: 320, maxWidth: 'min(820px, calc(100vw - 24px))', padding: 12, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
      <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>
        {grupo.label} {pctFatia ? `• ${pctFatia} da pizza` : ''}
      </div>
      <div style={{ fontSize: 11, color: '#a3a3a3', margin: '-4px 0 8px 0' }}>Período: {grupo.periodo || periodoLabel || ''}</div>
      {grupo.totalItem ? (
        <TooltipLine item={grupo.totalItem} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, margin: '5px 0', alignItems: 'start' }}>
          <span style={{ color: '#e5e5e5' }}>{grupo.label}</span>
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', color: moneyColor(grupo.value), whiteSpace: 'nowrap' }}>{fmtBRL2(grupo.value)}</span>
        </div>
      )}
      {grupo.detalhes.length > 0 && (
        <>
          <div style={{ height: 1, background: '#2a2a2a', margin: '9px 0' }} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${grupo.detalhes.length > 7 ? 2 : 1}, minmax(250px, 1fr))`,
              columnGap: 18,
              rowGap: 1,
              alignItems: 'start',
            }}
          >
            {grupo.detalhes.map((item, i) => (
              <TooltipLine key={i} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TooltipLine({ item }: { item: DreItem }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, margin: '5px 0', alignItems: 'start' }}>
      <span style={{ color: '#e5e5e5', maxWidth: 210, whiteSpace: 'normal', lineHeight: 1.25 }}>{item.desc}</span>
      <span style={{ fontFamily: 'IBM Plex Mono,monospace', color: moneyColor(item.valorOriginal), whiteSpace: 'nowrap', textAlign: 'right' }}>
        {fmtBRL2(item.valorOriginal)}
        {item.pct && <span style={{ color: '#a3a3a3', marginLeft: 4 }}>({item.pct})</span>}
      </span>
    </div>
  );
}
