import { useId, useState, type ReactNode } from 'react';
import { ChartColumn, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  description: string;
  /** One-sentence text alternative read by screen readers instead of the chart. */
  summary: string;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}

/**
 * A card with a Chart / Table switch. A canvas or SVG chart is hard to read
 * with a screen reader, so it's hidden from assistive tech and replaced by a
 * text summary, and anyone can switch to the same data as a real table.
 */
export function ChartCard({ title, description, summary, chart, table, className }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const headingId = useId();

  const toggle = (value: 'chart' | 'table', label: string, Icon: typeof Table2) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        view === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  );

  return (
    <section aria-labelledby={headingId} className={cn('rounded-xl border bg-card p-5 shadow-soft', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div role="group" aria-label={`Show ${title.toLowerCase()} as`} className="flex rounded-lg bg-muted p-0.5">
          {toggle('chart', 'Chart', ChartColumn)}
          {toggle('table', 'Table', Table2)}
        </div>
      </div>
      <div className="mt-4">
        {view === 'chart' ? (
          <figure>
            <figcaption className="sr-only">{summary}</figcaption>
            <div aria-hidden>{chart}</div>
          </figure>
        ) : (
          table
        )}
      </div>
    </section>
  );
}

/** Tooltip box styled like our cards (Recharts' default is a plain white box). */
export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-soft">{children}</div>;
}

export const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
export const MONO_FONT = '"JetBrains Mono Variable", ui-monospace, monospace';
