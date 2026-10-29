import { CircleAlert, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Impact } from '@/types';
import { cn } from '@/lib/utils';

// One place that defines how each severity looks. Every severity has its own
// icon AND label, so it never depends on color alone (WCAG 1.4.1).
// Class names are written out in full so Tailwind can find them.
export const SEVERITY: Record<
  Impact,
  { label: string; icon: LucideIcon; text: string; tint: string; border: string; color: string }
> = {
  critical: { label: 'Critical', icon: OctagonAlert, text: 'text-critical', tint: 'bg-critical/12', border: 'border-critical/30', color: 'var(--critical)' },
  serious: { label: 'Serious', icon: TriangleAlert, text: 'text-serious', tint: 'bg-serious/12', border: 'border-serious/30', color: 'var(--serious)' },
  moderate: { label: 'Moderate', icon: CircleAlert, text: 'text-moderate', tint: 'bg-moderate/12', border: 'border-moderate/30', color: 'var(--moderate)' },
  minor: { label: 'Minor', icon: Info, text: 'text-minor', tint: 'bg-minor/12', border: 'border-minor/30', color: 'var(--minor)' },
};

export function SeverityIcon({ impact, className }: { impact: Impact; className?: string }) {
  const { icon: Icon, text } = SEVERITY[impact];
  return <Icon aria-hidden className={cn('size-4 shrink-0', text, className)} />;
}

export function SeverityBadge({ impact, className }: { impact: Impact; className?: string }) {
  const { label, icon: Icon, text, tint, border } = SEVERITY[impact];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
        text,
        tint,
        border,
        className
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
