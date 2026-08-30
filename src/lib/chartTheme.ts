import { CHART_THEME, PERFORMANCE_MODE } from './constants';
import { prefersReducedMotion } from './debounce';

export const PALETTE = [
  CHART_THEME.primary,
  CHART_THEME.secondary,
  CHART_THEME.accent,
  CHART_THEME.accent2,
  CHART_THEME.positive,
  CHART_THEME.warning,
  CHART_THEME.negative,
  CHART_THEME.cost,
  CHART_THEME.muted,
];

export const baseGrid = { borderColor: '#1f1f1f', strokeDashArray: 4, padding: { left: 8, right: 8 } };

export const baseAxis = {
  labels: { style: { colors: '#737373', fontSize: '11px', fontFamily: 'IBM Plex Mono' } },
  axisBorder: { show: false },
  axisTicks: { show: false },
};

const MOTION_EASE = 'easeinout';
const MOTION_DURATION = PERFORMANCE_MODE ? 120 : 420;
const CHART_MOTION = PERFORMANCE_MODE
  ? { enabled: false }
  : {
      enabled: true,
      easing: MOTION_EASE,
      speed: MOTION_DURATION,
      animateGradually: { enabled: false },
      dynamicAnimation: { enabled: true, speed: 300 },
    };

export function chartMotionOptions() {
  return PERFORMANCE_MODE || prefersReducedMotion() ? { enabled: false } : CHART_MOTION;
}

// Deep-ish merge para objetos de opções do ApexCharts (arrays são substituídos, não mesclados).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeOptions<T extends Record<string, any>>(base: T, extra: Record<string, any> = {}): T {
  const out: Record<string, any> = { ...base };
  Object.keys(extra || {}).forEach((k) => {
    const bv = out[k];
    const ev = extra[k];
    const bothObjects = bv && ev && typeof bv === 'object' && typeof ev === 'object' && !Array.isArray(bv) && !Array.isArray(ev);
    out[k] = bothObjects ? mergeOptions(bv, ev) : ev;
  });
  return out as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function legendOptions(extra: Record<string, any> = {}) {
  const base = {
    show: true,
    showForSingleSeries: true,
    position: 'bottom',
    horizontalAlign: 'center',
    floating: false,
    fontSize: '12px',
    fontFamily: 'Sora',
    fontWeight: 650,
    labels: { colors: '#f5f5f5', useSeriesColors: false },
    markers: { width: 10, height: 10, radius: 99, offsetX: 0, offsetY: 0 },
    itemMargin: { horizontal: 6, vertical: 6 },
    onItemClick: { toggleDataSeries: true },
    onItemHover: { highlightDataSeries: true },
  };
  return mergeOptions(base, extra);
}
