import { useMemo } from 'react';
import type { ApexOptions } from 'apexcharts';
import { ApexChartBox } from '../charts/ApexChartBox';
import { baseAxis, baseGrid, legendOptions } from '../../lib/chartTheme';
import { captacaoDateParts, durationMinutes, formatDuration, normalized } from '../../lib/captacaoFormat';
import type { AtaCaptacao } from '../../lib/captacoes';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ACCENT = '#5CABC4';
const EQUIPMENT_GRAY = '#343946';

interface MonthBucket {
  key: string;
  label: string;
  sort: number;
  total: number;
}

interface VideomakerBucket {
  name: string;
  total: number;
  clients: string[];
}

function pluralCaptacoes(value: number): string {
  return `${value} ${value === 1 ? 'captação' : 'captações'}`;
}

function buildMonthlyOptions(items: MonthBucket[], onSelect: (key: string) => void): ApexOptions {
  return {
    chart: {
      type: 'bar',
      height: 280,
      background: 'transparent',
      toolbar: { show: false },
      foreColor: '#9A9A9A',
      fontFamily: 'Roboto',
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          const item = config ? items[config.dataPointIndex] : undefined;
          if (item) onSelect(item.key);
        },
      },
    },
    series: [{ name: 'Atas', data: items.map((item) => item.total) }],
    colors: [ACCENT],
    plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '44%' } },
    fill: { opacity: 0.9 },
    dataLabels: { enabled: false },
    grid: baseGrid,
    xaxis: { ...baseAxis, categories: items.map((item) => item.label) },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      decimalsInFloat: 0,
      labels: { style: { colors: '#9A9A9A', fontFamily: 'Roboto', fontSize: '11px' }, formatter: (value: number) => String(Math.round(value)) },
    },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => pluralCaptacoes(value) } },
    legend: { show: false },
  };
}

function buildEquipmentOptions(phone: number, camera: number): ApexOptions {
  return {
    chart: { type: 'donut', height: 280, background: 'transparent', foreColor: '#9A9A9A', fontFamily: 'Roboto' },
    series: [phone, camera],
    labels: ['Telefone', 'Câmera'],
    colors: [EQUIPMENT_GRAY, ACCENT],
    stroke: { colors: ['#15191E'], width: 3 },
    dataLabels: { enabled: false },
    legend: legendOptions({ position: 'bottom', markers: { width: 11, height: 8, radius: 1 } }),
    plotOptions: { pie: { customScale: 0.88, donut: { size: '52%' } } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => pluralCaptacoes(value) } },
  };
}

function buildVideomakerOptions(items: VideomakerBucket[], onSelect: (name: string) => void): ApexOptions {
  return {
    chart: {
      type: 'bar',
      height: Math.max(270, items.length * 64),
      background: 'transparent',
      toolbar: { show: false },
      foreColor: '#9A9A9A',
      fontFamily: 'Roboto',
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          const item = config ? items[config.dataPointIndex] : undefined;
          if (item) onSelect(item.name);
        },
      },
    },
    series: [{ name: 'Captações', data: items.map((item) => item.total) }],
    colors: [ACCENT],
    stroke: { show: false },
    plotOptions: { bar: { horizontal: true, borderRadius: 6, borderRadiusApplication: 'end', barHeight: '42%' } },
    fill: { opacity: 0.92 },
    dataLabels: { enabled: false },
    grid: baseGrid,
    xaxis: {
      ...baseAxis,
      categories: items.map((item) => item.name),
      min: 0,
      labels: { style: { colors: '#9A9A9A', fontFamily: 'Roboto', fontSize: '11px' }, formatter: (value: string) => String(Math.round(Number(value))) },
    },
    yaxis: { labels: { style: { colors: '#C7C7C7', fontFamily: 'Roboto', fontSize: '11px' } } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => pluralCaptacoes(value) } },
    legend: { show: false },
  };
}

interface CaptacaoOverviewProps {
  rows: AtaCaptacao[];
  onSelectMonth: (key: string) => void;
  onSelectVideomaker: (name: string) => void;
}

export function CaptacaoOverview({ rows, onSelectMonth, onSelectVideomaker }: CaptacaoOverviewProps) {
  const report = useMemo(() => {
    const monthMap = new Map<string, MonthBucket>();
    const makerMap = new Map<string, { name: string; total: number; clients: Map<string, string> }>();
    let phone = 0;
    let camera = 0;
    let totalMinutes = 0;

    rows.forEach((row) => {
      const parts = captacaoDateParts(row.data_captacao);
      if (parts) {
        const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
        const bucket = monthMap.get(key) ?? {
          key,
          label: `${MONTH_LABELS[parts.month - 1]}/${String(parts.year).slice(-2)}`,
          sort: parts.year * 100 + parts.month,
          total: 0,
        };
        bucket.total += 1;
        monthMap.set(key, bucket);
      }

      const equipment = normalized(row.tipo_equipamento);
      if (equipment === 'telefone') phone += 1;
      if (equipment === 'camera') camera += 1;

      const makerKey = normalized(row.videomaker);
      const maker = makerMap.get(makerKey) ?? { name: row.videomaker, total: 0, clients: new Map<string, string>() };
      maker.total += 1;
      maker.clients.set(normalized(row.empresa), row.empresa);
      makerMap.set(makerKey, maker);
      totalMinutes += durationMinutes(row);
    });

    const months = [...monthMap.values()].sort((a, b) => a.sort - b.sort);
    const videomakers: VideomakerBucket[] = [...makerMap.values()]
      .map((item) => ({ ...item, clients: [...item.clients.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

    return {
      months,
      videomakers,
      phone,
      camera,
      clients: new Set(rows.map((row) => normalized(row.empresa)).filter(Boolean)).size,
      averageMinutes: rows.length ? totalMinutes / rows.length : 0,
    };
  }, [rows]);

  const monthlyOptions = useMemo(() => buildMonthlyOptions(report.months, onSelectMonth), [report.months]);
  const equipmentOptions = useMemo(() => buildEquipmentOptions(report.phone, report.camera), [report.camera, report.phone]);
  const videomakerOptions = useMemo(() => buildVideomakerOptions(report.videomakers, onSelectVideomaker), [report.videomakers]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Total de atas" value={rows.length} />
        <SummaryCard label="Videomakers ativos" value={report.videomakers.length} />
        <SummaryCard label="Clientes atendidos" value={report.clients} />
        <SummaryCard label="Duração média" value={formatDuration(report.averageMinutes)} accent />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <ReportCard title="Atas criadas por mês" className="xl:col-span-2">
          {rows.length ? <ApexChartBox id="chart-captacao-meses" options={monthlyOptions} className="h-[280px]" /> : <ChartEmpty />}
        </ReportCard>
        <ReportCard title="Telefone vs Câmera">
          {rows.length ? <ApexChartBox id="chart-captacao-equipamentos" options={equipmentOptions} className="h-[280px]" /> : <ChartEmpty />}
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <ReportCard title="Captações por videomaker" className="xl:col-span-2">
          {rows.length ? (
            <ApexChartBox id="chart-captacao-videomakers" options={videomakerOptions} revealDirection="horizontal" />
          ) : (
            <ChartEmpty />
          )}
        </ReportCard>
        <ReportCard title="Clientes por videomaker">
          {report.videomakers.length ? (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {report.videomakers.map((maker) => (
                <div key={maker.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-[var(--text)]">{maker.name}</strong>
                    <span className="text-xs font-semibold text-[var(--accent)] whitespace-nowrap">{pluralCaptacoes(maker.total)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {maker.clients.map((client) => (
                      <span key={client} className="pill normal-case tracking-normal text-[.65rem]">
                        {client}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ChartEmpty />
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-5 min-h-[94px] flex flex-col justify-between">
      <span className="text-xs text-[var(--muted-2)]">{label}</span>
      <strong className={`text-2xl leading-none tracking-[-0.04em] ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{value}</strong>
    </div>
  );
}

function ReportCard({ title, className = '', children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="font-semibold tracking-[-0.025em] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ChartEmpty() {
  return <div className="h-[280px] flex items-center justify-center text-sm text-[var(--muted)]">Sem dados para exibir</div>;
}
