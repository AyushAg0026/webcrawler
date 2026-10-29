import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, CircleX, Compass, FileSearch, Globe, LoaderCircle, RotateCw, Timer } from 'lucide-react';
import { useScan, useStartScan } from '@/api/hooks';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScoreBadge } from '@/components/ScoreBadge';
import { ErrorState, LoadingBlock, Skeleton } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';
import { shortUrl, urlPath } from '@/lib/format';

/** Seconds since `iso`, updated every second. */
function useElapsed(iso: string | undefined, running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)) : 0;
}

export default function ScanProgressPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: scan, isPending, isError, error, refetch } = useScan(id);
  const startScan = useStartScan();
  const status = scan?.status;
  const elapsed = useElapsed(scan?.createdAt, status === 'queued' || status === 'running');
  usePageTitle(scan ? `Scanning ${scan.domain}` : 'Scanning');

  // When the scan finishes, go to the results. `replace` keeps the progress
  // page out of the back-button history.
  useEffect(() => {
    if (status !== 'done') return;
    const timer = setTimeout(() => navigate(`/scans/${id}`, { replace: true }), 700);
    return () => clearTimeout(timer);
  }, [status, id, navigate]);

  if (isPending) {
    return (
      <LoadingBlock label="Loading scan" className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </LoadingBlock>
    );
  }
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Scan not found' : 'Couldn’t load this scan'}
        message={error.message}
        onRetry={notFound ? undefined : () => refetch()}
        action={
          <Button asChild variant="outline">
            <Link to="/">Back to scans</Link>
          </Button>
        }
      />
    );
  }
  if (scan.status === 'failed') {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="sr-only">Scan of {scan.domain} failed</h1>
        <ErrorState
          title={`We couldn’t scan ${scan.domain}`}
          message={scan.error ?? 'The scan stopped unexpectedly.'}
          action={
            <>
              <Button
                disabled={startScan.isPending}
                onClick={() =>
                  startScan.mutate({ url: scan.url, maxPages: scan.maxPages }, { onSuccess: (r) => navigate(`/scans/${r.id}/progress`) })
                }
              >
                <RotateCw aria-hidden /> Try again
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Scan a different site</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const done = scan.status === 'done';
  const progress = scan.progress ?? { pagesDiscovered: scan.pagesScanned, pagesScanned: scan.pagesScanned, currentUrl: null };
  const percent = done ? 100 : Math.round((progress.pagesScanned / scan.maxPages) * 100);
  const finishedPages = [...scan.pages].reverse(); // newest first

  const stats = [
    { label: 'Pages discovered', value: progress.pagesDiscovered, icon: Compass },
    { label: 'Pages scanned', value: `${progress.pagesScanned} / ${scan.maxPages}`, icon: FileSearch },
    { label: 'Elapsed', value: `${elapsed}s`, icon: Timer },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Screen readers hear page counts as they change, not every visual detail. */}
      <p role="status" className="sr-only">
        {done
          ? 'Scan complete. Opening the results.'
          : scan.status === 'queued'
            ? 'Scan queued.'
            : `Scanned ${progress.pagesScanned} of up to ${scan.maxPages} pages.`}
      </p>

      <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-text">
            {done ? (
              <CircleCheck aria-hidden className="size-4 text-good" />
            ) : (
              <span aria-hidden className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
            )}
            {done ? 'Scan complete' : scan.status === 'queued' ? 'Queued' : 'Scanning'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight break-words">
            {done ? 'Done! Opening results…' : `Scanning ${scan.domain}`}
          </h1>
          <p className="mt-1 font-mono text-sm break-all text-muted-foreground">{shortUrl(scan.url)}</p>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{percent}%</span>
            </div>
            <Progress value={percent} aria-label="Scan progress" className="h-2" />
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-background/50 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon aria-hidden className="hidden size-3.5 sm:block" /> {label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {!done && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
              <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-brand-text" />
              {progress.currentUrl ? (
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">Now scanning </span>
                  <span className="font-mono">{urlPath(progress.currentUrl)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Starting a headless browser…</span>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="finished-title">
        <h2 id="finished-title" className="mb-3 font-semibold tracking-tight">
          Finished pages
        </h2>
        {finishedPages.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <Globe aria-hidden className="size-4" /> Pages will appear here as each one is checked.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
            <AnimatePresence initial={false}>
              {finishedPages.map((page) => (
                <motion.li
                  key={page.url}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px]">{urlPath(page.url)}</p>
                    <p className="truncate text-xs text-muted-foreground">{page.status === 'ok' ? page.title : page.error}</p>
                  </div>
                  {page.status === 'ok' ? (
                    <>
                      <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">{page.violationCount} issues</span>
                      <ScoreBadge score={page.score} size="sm" />
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-critical">
                      <CircleX aria-hidden className="size-3.5" /> Failed
                    </span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
