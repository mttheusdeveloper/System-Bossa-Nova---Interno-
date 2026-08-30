import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  iconClassName?: string;
  pill?: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  sub?: ReactNode;
  onClick?: () => void;
  accent?: boolean;
}

export function KpiCard({ icon, iconClassName, pill, label, value, valueClassName, sub, onClick, accent }: KpiCardProps) {
  return (
    <div
      className={`card p-5 ${accent ? 'kpi-accent' : ''} ${onClick ? 'cursor-pointer hover:border-white transition' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={`kpi-icon ${iconClassName || ''}`}>{icon}</div>
        {pill}
      </div>
      <p className="kpi-label mt-3">{label}</p>
      <p className={`kpi-value mono ${valueClassName || ''}`}>{value}</p>
      {sub}
    </div>
  );
}
