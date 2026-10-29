import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChartLine } from 'lucide-react';
import type { ScanSummary } from '@/types';
import { useScans } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Favicon } from '@/components/Favicon';
import { ScoreBadge } from '@/components/ScoreBadge';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';
import { plural, timeAgo } from '@/lib/format';
import { fadeUp, staggerList } from '@/lib/motion';

interface SiteRow {
  domain: string;
  url: string;
  scans: number;
  latest: ScanSummary | undefined;
  lastScanAt: string;
}

/** Groups the scan list by domain; the newest finished scan gives the current score. */
function groupBySite(scans: ScanSummary[]): SiteRow[] {
  const sites = new Map<string, SiteRow>();
  for (const scan of scans) {
    const row = sites.get(scan.domain) ?? { domain: scan.domain, url: scan.url, scans: 0, latest: undefined, lastScanAt: scan.createdAt };
    row.scans += 1;
    if (scan.createdAt > row.lastScanAt) row.lastScanAt = scan.createdAt;
    if (scan.status === 'done' && (!row.latest || scan.createdAt > row.latest.createdAt)) row.latest = scan;
    sites.set(scan.domain, row);
  }
  return [...sites.values()].sort((a, b) => b.lastScanAt.localeCompare(a.lastScanAt));
}

export default function SitesPage() {
  usePageTitle('History');
  const { data, isPending, isError, error, refetch } = useScans();

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-muted-foreground">Pick a site to see how its score changed over time.</p>
      <div className="mt-8">
        {isPending ? (
          <LoadingBlock label="Loading sites" className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-xl" />
            ))}
          </LoadingBlock>
        ) : isError ? (
          <ErrorState title="Couldn’t load sites" message={error.message} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ChartLine}
            title="No sites scanned yet"
            description="Your scanned sites and their score trends will be listed here."
            action={
              <Button asChild>
                <Link to="/">Start a scan</Link>
              </Button>
            }
          />
        ) : (
          <motion.ul variants={staggerList} initial="hidden" animate="show" className="space-y-3">
            {groupBySite(data).map((site) => (
              <motion.li key={site.domain} variants={fadeUp}>
                <div className="relative flex items-center gap-4 rounded-xl border bg-card p-4 shadow-soft transition-colors focus-within:border-ring hover:border-foreground/25">
                  <Favicon url={site.url} domain={site.domain} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium">
                      <Link to={`/sites/${encodeURIComponent(site.domain)}`} className="rounded-sm after:absolute after:inset-0 after:rounded-xl">
                        {site.domain}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {plural(site.scans, 'scan')} · last {timeAgo(site.lastScanAt)}
                    </p>
                  </div>
                  {site.latest ? (
                    <ScoreBadge score={site.latest.score} />
                  ) : (
                    <span className="text-sm text-muted-foreground">No score yet</span>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </>
  );
}
