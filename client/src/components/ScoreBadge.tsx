import { CircleCheck, CircleMinus, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreTone {
  label: string;
  icon: LucideIcon;
  text: string;
  tint: string;
  color: string;
}

// Score ranges: under 50 = red, 50-79 = amber, 80+ = green.
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return { label: 'No score', icon: CircleMinus, text: 'text-muted-foreground', tint: 'bg-muted', color: 'var(--muted-foreground)' };
  if (score >= 80) return { label: 'Good', icon: CircleCheck, text: 'text-good', tint: 'bg-good/12', color: 'var(--good)' };
  if (score >= 50) return { label: 'Fair', icon: TriangleAlert, text: 'text-moderate', tint: 'bg-moderate/12', color: 'var(--moderate)' };
  return { label: 'Poor', icon: CircleX, text: 'text-critical', tint: 'bg-critical/12', color: 'var(--critical)' };
}

/** Compact score pill: number + label, so the meaning never relies on color. */
export function ScoreBadge({ score, size = 'md', className }: { score: number | null; size?: 'sm' | 'md'; className?: string }) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        tone.text,
        tone.tint,
        className
      )}
    >
      <tone.icon aria-hidden className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {score ?? '–'}
      <span className="font-medium">{tone.label}</span>
    </span>
  );
}
