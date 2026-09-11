import type { LucideIcon } from 'lucide-react';
import { PulsingIcon } from './PulsingIcon';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Placeholder pras abas que ainda não têm dados/planilha plugados.
export function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <section className="space-y-6">
      <div className="card p-10 flex flex-col items-center justify-center text-center gap-4">
        <PulsingIcon icon={icon} />
        <h2 className="font-semibold tracking-[-0.03em] text-lg">{title}</h2>
        <p className="text-sm text-[var(--muted-2)] max-w-md">{description}</p>
      </div>
    </section>
  );
}
