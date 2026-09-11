import * as React from 'react';

import { cn } from '@/lib/utils';

const componentThemeClassName =
  '[--ic-background:#111111] [--ic-foreground:#f6f3ec] [--ic-primary:#f6f3ec] [--ic-secondary:#cbc6bb] [--ic-surface-border:#2a2a25] [--ic-border:#2b2a25] [--ic-card:#111111] [--ic-card-foreground:#f6f3ec] [--ic-muted:#171716] [--ic-muted-foreground:#9a958a] [--ic-accent:#1a1a18] [--ic-accent-foreground:#f6f3ec] [--ic-input:#2b2a25] [--ic-ring:rgba(246,243,236,0.18)] [--ic-destructive:#f87171] [--ic-paper:#171716] [--ic-popover-foreground:#f6f3ec] [--ic-brand:#38bdf8] [--ic-brand-soft:#0c4a6e] [--ic-shadow-soft:0_20px_44px_-28px_rgba(0,0,0,0.6)] [--ic-chart-1:oklch(0.68_0.17_250)] [--ic-chart-2:oklch(0.82_0.09_225)] [--ic-chart-3:oklch(0.58_0.15_260)] [--ic-chart-4:oklch(0.75_0.12_235)] [--ic-chart-5:oklch(0.88_0.06_220)] [--color-background:var(--ic-background)] [--color-foreground:var(--ic-foreground)] [--color-primary:var(--ic-primary)] [--color-secondary:var(--ic-secondary)] [--color-border:var(--ic-border)] [--color-card:var(--ic-card)] [--color-card-foreground:var(--ic-card-foreground)] [--color-muted:var(--ic-muted)] [--color-muted-foreground:var(--ic-muted-foreground)] [--color-accent:var(--ic-accent)] [--color-accent-foreground:var(--ic-accent-foreground)] [--color-input:var(--ic-input)] [--color-ring:var(--ic-ring)] [--color-destructive:var(--ic-destructive)] [--color-paper:var(--ic-paper)] [--color-popover-foreground:var(--ic-popover-foreground)] [--color-brand:var(--ic-brand)] [--color-brand-soft:var(--ic-brand-soft)] [--color-chart-1:var(--ic-chart-1)] [--color-chart-2:var(--ic-chart-2)] [--color-chart-3:var(--ic-chart-3)] [--color-chart-4:var(--ic-chart-4)] [--color-chart-5:var(--ic-chart-5)]';

function hasTextContent(node: React.ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim().length > 0;
  if (Array.isArray(node)) return node.some(hasTextContent);
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return hasTextContent(node.props.children);
  return false;
}

type OriginButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode;
  loading?: boolean;
  active?: boolean;
};

/**
 * Botão estático compartilhado. O nome da exportação foi mantido para não
 * quebrar as telas existentes, mas o preenchimento radial pelo cursor não faz
 * mais parte do componente.
 */
const OriginButton = React.forwardRef<HTMLButtonElement, OriginButtonProps>(
  ({ active = false, children, className, disabled = false, loading = false, type = 'button', ...props }, ref) => {
    const isDisabled = Boolean(disabled || loading);
    const ariaLabel = props['aria-label'];
    const ariaLabelledBy = props['aria-labelledby'];

    React.useEffect(() => {
      if (import.meta.env.PROD || hasTextContent(children) || ariaLabel?.trim() || ariaLabelledBy?.trim()) return;
      console.warn('Button: provide visible label text or aria-label / aria-labelledby so the control has an accessible name.');
    }, [ariaLabel, ariaLabelledBy, children]);

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-active={active ? 'true' : 'false'}
        className={cn(
          componentThemeClassName,
          'origin-button-static relative inline-flex h-12 cursor-pointer touch-manipulation select-none items-center justify-center overflow-hidden rounded-xl px-8 font-medium text-[15px] tracking-[-0.02em]',
          'border-[0.5px] border-border bg-muted text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          active && 'active',
          className,
        )}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
      </button>
    );
  },
);
OriginButton.displayName = 'OriginButton';

export { OriginButton };
export type { OriginButtonProps };
