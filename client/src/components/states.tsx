// Empty, error and loading states, so every page handles "no data yet" the same way.
import type { ReactNode } from 'react';
import { RotateCw, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center', className)}>
      <div className="relative mb-4">
        <div aria-hidden className="absolute inset-0 rounded-2xl bg-primary/25 blur-xl" />
        <div className="relative grid size-14 place-items-center rounded-2xl border bg-card shadow-soft">
          <Icon aria-hidden className="size-6 text-brand-text" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-critical/30 bg-critical/5 px-6 py-12 text-center">
      <TriangleAlert aria-hidden className="mb-3 size-7 text-critical" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground break-words">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw aria-hidden /> Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

/** Generic skeleton block list while data loads. aria-busy tells screen readers to wait. */
export function LoadingBlock({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { Skeleton };
