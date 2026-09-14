import { useMemo, useState } from 'react';
import { Cell, LabelList, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/pie-chart';
import { fmtBRL2, fmtK } from '../../lib/format';
import { normKey } from '../../lib/parse';
import { useModals } from '../../state/ModalsContext';
import type { DreContext } from '../../types';

function slugify(label: string): string {
  return normKey(label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'grupo';
}

// Porta visual do gráfico "Visão Geral" pro componente shadcn Pie Chart
// (rounded/padded, com labels dentro das fatias) — dados reais dos grupos da
// DRE (useDreContext), não os dados de exemplo do componente original.
export function ChartCatDonut({ dreContext }: { dreContext: DreContext }) {
  const { openDre } = useModals();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const grupos = dreContext.grupos;

  const { chartData, chartConfig } = useMemo(() => {
    const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
    const usedKeys = new Set<string>();
    const config: ChartConfig = {};

    const data = grupos.map((g, i) => {
      let key = slugify(g.label);
      while (usedKeys.has(key)) key = `${key}_${i}`;
      usedKeys.add(key);
      config[key] = { label: g.label, color: palette[i % palette.length] };
      return { key, value: Math.abs(g.value), fill: `var(--color-${key})` };
    });

    return { chartData: data, chartConfig: config };
  }, [grupos]);

  const totalReceitas = dreContext.totalReceitas || chartData.reduce((acc, d) => acc + d.value, 0);
  const activeKey = selectedKey && chartData.some((item) => item.key === selectedKey) ? selectedKey : null;

  function toggleHighlight(key: string) {
    setSelectedKey((current) => (current === key ? null : key));
  }

  return (
    <Card className="mensal-chart-card xl:col-span-2 flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-0">
        <div>
          <CardTitle className="text-lg">Visão Geral</CardTitle>
          <CardDescription>{dreContext.periodoLabel || 'Sem dados'}</CardDescription>
        </div>
        <button className="chip-btn text-[.68rem] whitespace-nowrap" onClick={openDre}>
          DRE completa
        </button>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        {chartData.length ? (
          <ChartContainer config={chartConfig} className="[&_.recharts-text]:fill-background mx-auto aspect-square max-h-[320px]">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="key"
                    formatter={(value) => <span className="font-mono font-medium">{fmtBRL2(Number(value))}</span>}
                  />
                }
              />
              <Pie data={chartData} dataKey="value" nameKey="key" innerRadius={30} radius={10} cornerRadius={8} paddingAngle={4}>
                {chartData.map((item) => {
                  const isActive = activeKey === item.key;
                  const isMuted = activeKey !== null && !isActive;

                  return (
                    <Cell
                      key={item.key}
                      fill={item.fill}
                      fillOpacity={isMuted ? 0.24 : 1}
                      stroke={isActive ? 'rgba(255,255,255,.82)' : 'transparent'}
                      strokeWidth={isActive ? 3 : 0}
                      className="cursor-pointer"
                      style={{
                        filter: isActive
                          ? 'brightness(1.14) drop-shadow(0 0 5px rgba(255,255,255,.28))'
                          : isMuted
                            ? 'brightness(.48)'
                            : 'none',
                        transition: 'fill-opacity .18s ease, filter .18s ease, stroke-width .18s ease',
                      }}
                      onClick={() => toggleHighlight(item.key)}
                    />
                  );
                })}
                <LabelList dataKey="value" stroke="none" fontSize={11} fontWeight={600} fill="currentColor" formatter={(value: number) => fmtK(value)} />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          {chartData.map((d) => {
            const isActive = activeKey === d.key;
            const isMuted = activeKey !== null && !isActive;
            const color = chartConfig[d.key]?.color;

            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={isActive}
                title={isActive ? 'Remover destaque' : `Destacar ${String(chartConfig[d.key]?.label || d.key)}`}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-[opacity,background-color,border-color,box-shadow] ${
                  isActive ? 'text-foreground' : 'border-transparent text-muted-foreground'
                } ${isMuted ? 'opacity-35' : 'opacity-100'}`}
                style={
                  isActive
                    ? {
                        borderColor: color,
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 18%, transparent)`,
                      }
                    : undefined
                }
                onClick={() => toggleHighlight(d.key)}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: color, boxShadow: isActive ? `0 0 7px ${color}` : undefined }}
                />
                {chartConfig[d.key]?.label}
              </button>
            );
          })}
        </div>
        {chartData.length > 0 && <div className="mt-3 text-center text-xs text-muted-foreground">Total Receitas: {fmtBRL2(totalReceitas)}</div>}
      </CardContent>
    </Card>
  );
}
