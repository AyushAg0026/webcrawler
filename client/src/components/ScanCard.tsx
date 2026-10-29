import { Link } from 'react-router-dom';
import { CircleX, LoaderCircle } from 'lucide-react';
import type { ScanSummary } from '@/types';
import { isActive } from '@/lib/scan-utils';
import { plural, shortUrl, timeAgo } from '@/lib/format';
import { Favicon } from './Favicon';
import { ScoreBadge } from './ScoreBadge';

function StatusBadge({ scan }: { scan: ScanSummary }) {
  if (isActive(scan.status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-sm font-medium text-brand-text">
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> Scanning
      </span>
    );
  }
  if (scan.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-critical/12 px-2.5 py-1 text-sm font-medium text-critical">
        <CircleX aria-hidden className="size-3.5" /> Failed
      </span>
    );
  }
  return <ScoreBadge score={scan.score} />;
}

export function ScanCard({ scan }: { scan: ScanSummary }) {
  const href = isActive(scan.status) ? `/scans/${scan.id}/progress` : `/scans/${scan.id}`;
  const detail =
    scan.status === 'done'
      ? plural(scan.violationCount, 'issue')
      : scan.status === 'failed'
        ? 'Scan failed'
        : `${plural(scan.pagesScanned, 'page')} scanned`;

  return (
    // The whole card is clickable via the link's ::after overlay, but only the
    // domain is the link text, so screen readers hear a short, clear name.
    <article className="group relative flex h-full flex-col rounded-xl border bg-card p-4 shadow-soft transition-colors focus-within:border-ring hover:border-foreground/25">
      <div className="flex items-start gap-3">
        <Favicon url={scan.url} domain={scan.domain} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">
            <Link to={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl">
              {scan.domain}
            </Link>
          </h3>
          <p className="truncate font-mono text-xs text-muted-foreground">{shortUrl(scan.url)}</p>
        </div>
        <StatusBadge scan={scan} />
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-sm text-muted-foreground">
        <span>{detail}</span>
        <time dateTime={scan.createdAt}>{timeAgo(scan.createdAt)}</time>
      </div>
    </article>
  );
}
