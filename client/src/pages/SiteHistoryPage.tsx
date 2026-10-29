import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, ChartLine, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { HistoryPoint } from '@/types';
import { useSiteHistory } from '@/api/hooks';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AXIS_TICK, ChartCard, ChartTooltipBox } from '@/components/charts/ChartCard';
import { Favicon } from '@/components/Favicon';
import { ScoreBadge } from '@/components/ScoreBadge';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDate, formatDateTime, plural } from '@/lib/format';
import { fadeUp, staggerList } from '@/lib/motion';
import { cn } from '@/lib/utils';

function TrendBadge({ history }: { history: HistoryPoint[] }) {
  const last = history.at(-1);
  const previous = history.at(-2);
  if (!last || !previous) {
    return <span className="rounded-full bg-muted px-2.5 py-1 text-sm text-muted-foreground">First scan</span>;
  }
  const diff = last.score - previous.score;
  const { label, icon: Icon, className } =
    diff > 0
      ? { label: `Improved +${diff}`, icon: TrendingUp, className: 'bg-good/12 text-good' }
      : diff < 0
        ? { label: `Declined ${diff}`, icon: TrendingDown, className: 'bg-critical/12 text-critical' }
        : { label: 'No change', icon: Minus, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium', className)}>
      <Icon aria-hidden className="size-4" />
      {label}
      <span className="font-normal opacity-90">since last scan</span>
    </span>
  );
}

function ScoreChart({ history }: { history: HistoryPoint[] }) {
  const reduceMotion = useReducedMotion();
  const data = history.map((h) => ({ ...h, label: formatDate(h.finishedAt) }));
  const first = history[0]!;
  const last = history.at(-1)!;

  return (
    <ChartCard
      title="Score over time"
      description="Site score after each finished scan"
      summary={`Line chart of ${history.length} scans. The score went from ${first.score} on ${formatDate(first.finishedAt)} to ${last.score} on ${formatDate(last.finishedAt)}.`}
      chart={
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-text)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--brand-text)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '4 4' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !point) return null;
                return (
                  <ChartTooltipBox>
                    <p className="text-xs text-muted-foreground">{formatDateTime(point.finishedAt)}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{point.score} / 100</p>
                    <p className="text-muted-foreground">{plural(point.violationCount, 'violation')}</p>
                  </ChartTooltipBox>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--brand-text)"
              strokeWidth={2}
              fill="url(#score-fill)"
              dot={{ r: 4, fill: 'var(--brand-text)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'var(--brand-text)', stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      }
      table={<HistoryTable history={history} />}
    />
  );
}

function HistoryTable({ history }: { history: HistoryPoint[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Score</TableHead>
          <TableHead className="text-right">Violations</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Pages</TableHead>
          <TableHead>
            <span className="sr-only">Results</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...history].reverse().map((h) => (
          <TableRow key={h.scanId}>
            <TableCell>
              <time dateTime={h.finishedAt}>{formatDateTime(h.finishedAt)}</time>
            </TableCell>
            <TableCell>
              <ScoreBadge score={h.score} size="sm" />
            </TableCell>
            <TableCell className="text-right tabular-nums">{h.violationCount}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{h.pagesScanned}</TableCell>
            <TableCell className="text-right">
              <Link
                to={`/scans/${h.scanId}`}
                className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-brand-text underline-offset-4 hover:underline"
              >
                Results<span className="sr-only"> of scan on {formatDateTime(h.finishedAt)}</span>
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function SiteHistoryPage() {
  const domain = useParams().domain ?? '';
  const { data, isPending, isError, error, refetch } = useSiteHistory(domain);
  usePageTitle(`History for ${domain}`);

  if (isPending) {
    return (
      <LoadingBlock label="Loading history" className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </LoadingBlock>
    );
  }
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <>
          <h1 className="sr-only">History for {domain}</h1>
          <EmptyState
            icon={ChartLine}
            title={`No history for ${domain} yet`}
            description="Once a scan of this site finishes, its score will show up here so you can track progress."
            action={
              <Button asChild>
                <Link to="/">Start a scan</Link>
              </Button>
            }
          />
        </>
      );
    }
    return <ErrorState title="Couldn’t load history" message={error.message} onRetry={() => refetch()} />;
  }

  const { history } = data;
  const latest = history.at(-1)!;

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-6">
      <motion.header variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Favicon url={`https://${domain}`} domain={domain} className="size-12 rounded-xl text-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-brand-text">Site history</p>
          <h1 className="text-3xl font-semibold tracking-tight break-words">{domain}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plural(history.length, 'scan')} since {formatDate(history[0]!.finishedAt)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight tabular-nums">{latest.score}</span>
            <span className="text-muted-foreground">/ 100 latest</span>
          </div>
          <TrendBadge history={history} />
        </div>
      </motion.header>

      <motion.div variants={fadeUp}>
        <ScoreChart history={history} />
      </motion.div>

      <motion.section variants={fadeUp} aria-labelledby="all-scans-title">
        <h2 id="all-scans-title" className="mb-3 font-semibold tracking-tight">
          All scans
        </h2>
        <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <HistoryTable history={history} />
        </div>
      </motion.section>
    </motion.div>
  );
}
