import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChartLine, Download, ExternalLink, FileText, Keyboard, ListChecks, LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import type { Scan } from '@/types';
import { useScan, useStartScan } from '@/api/hooks';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreGauge } from '@/components/ScoreGauge';
import { SEVERITY } from '@/components/SeverityBadge';
import { StatCard } from '@/components/StatCard';
import { RuleBarChart } from '@/components/charts/RuleBarChart';
import { ImpactDonut } from '@/components/charts/ImpactDonut';
import { IssuesPanel } from '@/components/IssuesPanel';
import { PagesTable } from '@/components/PagesTable';
import { KeyboardPanel } from '@/components/KeyboardPanel';
import { ErrorState, LoadingBlock, Skeleton } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';
import { countByImpact, countElements, IMPACTS, isActive } from '@/lib/scan-utils';
import { formatDateTime, plural, shortUrl } from '@/lib/format';
import { fadeUp, staggerList } from '@/lib/motion';
import { cn } from '@/lib/utils';

function downloadJson(scan: Scan) {
  const blob = new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `a11y-report-${scan.domain}-${scan.createdAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ResultsSkeleton() {
  return (
    <LoadingBlock label="Loading scan results" className="space-y-6">
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </LoadingBlock>
  );
}

function useRescan(scan: Scan | undefined) {
  const navigate = useNavigate();
  const startScan = useStartScan();
  const rescan = () =>
    scan && startScan.mutate({ url: scan.url, maxPages: scan.maxPages }, { onSuccess: ({ id }) => navigate(`/scans/${id}/progress`) });
  return { rescan, isPending: startScan.isPending, error: startScan.error };
}

export default function ScanResultsPage() {
  const id = Number(useParams().id);
  const { data: scan, isPending, isError, error, refetch } = useScan(id);
  const { rescan, isPending: rescanning, error: rescanError } = useRescan(scan);
  const [tab, setTab] = useState('issues');
  const [pageFilter, setPageFilter] = useState<string | null>(null);
  usePageTitle(scan ? `Results for ${scan.domain}` : 'Scan results');

  if (isPending) return <ResultsSkeleton />;
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Scan not found' : 'Couldn’t load this scan'}
        message={notFound ? `There is no scan with id ${id}.` : error.message}
        onRetry={notFound ? undefined : () => refetch()}
        action={
          <Button asChild variant="outline">
            <Link to="/">Back to scans</Link>
          </Button>
        }
      />
    );
  }
  if (isActive(scan.status)) return <Navigate to={`/scans/${scan.id}/progress`} replace />;
  if (scan.status === 'failed') {
    return (
      <>
        <h1 className="sr-only">Scan of {scan.domain} failed</h1>
        <ErrorState
          title={`Scan of ${scan.domain} failed`}
          message={scan.error ?? 'The scan stopped unexpectedly.'}
          action={
            <Button onClick={rescan} disabled={rescanning}>
              <RotateCw aria-hidden /> Try again
            </Button>
          }
        />
      </>
    );
  }

  const impacts = countByImpact(scan.violations);
  const total = countElements(scan.violations);

  // Clicking a page in the Pages tab filters the Issues tab to that page.
  function showPageIssues(url: string) {
    setPageFilter(url);
    setTab('issues');
    // The clicked button disappears with its tab, so move focus somewhere useful.
    requestAnimationFrame(() => document.getElementById('clear-page-filter')?.focus());
  }

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-6">
      {/* Header: score, site info, actions */}
      <motion.header variants={fadeUp} className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <ScoreGauge score={scan.score} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-brand-text">Scan results</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words">{scan.domain}</h1>
            <a
              href={scan.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 rounded-sm font-mono text-sm break-all text-muted-foreground hover:text-foreground"
            >
              {shortUrl(scan.url)}
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Scanned</dt>
                <dd className="font-medium">
                  <time dateTime={scan.createdAt}>{formatDateTime(scan.createdAt)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pages scanned</dt>
                <dd className="font-medium tabular-nums">
                  {scan.pagesScanned} of {scan.maxPages} max
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Score</dt>
                <dd className="font-medium">Average of all pages</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-2 md:w-44 md:flex-col">
            <Button onClick={rescan} disabled={rescanning}>
              {rescanning ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCw aria-hidden />}
              Re-scan
            </Button>
            <Button variant="outline" onClick={() => downloadJson(scan)}>
              <Download aria-hidden /> Export report
            </Button>
            <Button variant="ghost" asChild>
              <Link to={`/sites/${encodeURIComponent(scan.domain)}`}>
                <ChartLine aria-hidden /> View history
              </Link>
            </Button>
          </div>
        </div>
        {rescanError && (
          <p role="alert" className="relative mt-4 flex items-center gap-1.5 text-sm text-critical">
            <TriangleAlert aria-hidden className="size-4" /> Couldn’t start a new scan: {rescanError.message}
          </p>
        )}
      </motion.header>

      {/* Stat cards */}
      <section aria-label="Violation counts">
        <motion.div variants={staggerList} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            className="col-span-2 sm:col-span-1"
            label="Total violations"
            value={total}
            hint={`${plural(scan.violations.length, 'rule')} failed`}
            icon={<ListChecks aria-hidden className="size-4 text-brand-text" />}
          />
          {IMPACTS.map((impact) => {
            const { label, icon: Icon, text } = SEVERITY[impact];
            return (
              <StatCard
                key={impact}
                label={label}
                value={impacts[impact]}
                hint="affected elements"
                icon={<Icon aria-hidden className={cn('size-4', text)} />}
              />
            );
          })}
        </motion.div>
      </section>

      {/* Charts */}
      {total > 0 && (
        <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-5">
          <RuleBarChart violations={scan.violations} className="lg:col-span-3" />
          <ImpactDonut counts={impacts} className="lg:col-span-2" />
        </motion.div>
      )}

      {/* Details */}
      <motion.section variants={fadeUp} aria-label="Scan details">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-10">
            <TabsTrigger value="issues" className="gap-1.5 px-3">
              <ListChecks aria-hidden /> Issues
              <span className="text-xs text-muted-foreground tabular-nums">{scan.violations.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5 px-3">
              <FileText aria-hidden /> Pages
              <span className="text-xs text-muted-foreground tabular-nums">{scan.pages.length}</span>
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="gap-1.5 px-3">
              <Keyboard aria-hidden /> Keyboard
              <span className="text-xs text-muted-foreground tabular-nums">{scan.keyboard.issues.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="issues" className="mt-4">
            <IssuesPanel violations={scan.violations} pageFilter={pageFilter} onClearPageFilter={() => setPageFilter(null)} />
          </TabsContent>
          <TabsContent value="pages" className="mt-4">
            <PagesTable pages={scan.pages} onSelectPage={showPageIssues} />
          </TabsContent>
          <TabsContent value="keyboard" className="mt-4">
            <KeyboardPanel keyboard={scan.keyboard} />
          </TabsContent>
        </Tabs>
      </motion.section>
    </motion.div>
  );
}
