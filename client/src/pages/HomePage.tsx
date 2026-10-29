import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radar, ShieldCheck } from 'lucide-react';
import { useScans } from '@/api/hooks';
import { ScanCard } from '@/components/ScanCard';
import { ScanForm } from '@/components/ScanForm';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fadeUp, staggerList } from '@/lib/motion';

const RECENT_LIMIT = 9;

function RecentScans() {
  const { data, isPending, isError, error, refetch } = useScans();

  if (isPending) {
    return (
      <LoadingBlock label="Loading recent scans" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </LoadingBlock>
    );
  }
  if (isError) return <ErrorState title="Couldn’t load recent scans" message={error.message} onRetry={() => refetch()} />;
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="No scans yet"
        description="Enter a website above to run your first accessibility audit. It takes about a minute."
        action={
          <Button variant="outline" onClick={() => document.getElementById('scan-url')?.focus()}>
            Scan your first site
          </Button>
        }
      />
    );
  }

  return (
    <>
      <motion.ul
        variants={staggerList}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {data.slice(0, RECENT_LIMIT).map((scan) => (
          <motion.li key={scan.id} variants={fadeUp}>
            <ScanCard scan={scan} />
          </motion.li>
        ))}
      </motion.ul>
      {data.length > RECENT_LIMIT && (
        <p className="mt-4 text-center">
          <Link to="/sites" className="rounded-sm text-sm font-medium text-brand-text underline-offset-4 hover:underline">
            See all {data.length} scans by site
          </Link>
        </p>
      )}
    </>
  );
}

export default function HomePage() {
  usePageTitle('New scan');

  return (
    <>
      <section aria-labelledby="hero-title" className="mx-auto max-w-2xl pt-2 text-center sm:pt-8">
        <p className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 text-brand-text" />
          WCAG 2.1 · Level A &amp; AA
        </p>
        <h1 id="hero-title" className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Find accessibility issues before your users do
        </h1>
        <p className="mt-4 text-lg text-balance text-muted-foreground">
          Crawl a website, test every page against WCAG 2.1, and track your score over time.
        </p>
      </section>

      <ScanForm />

      <section aria-labelledby="recent-title" className="mt-16">
        <h2 id="recent-title" className="mb-4 text-lg font-semibold tracking-tight">
          Recent scans
        </h2>
        <RecentScans />
      </section>
    </>
  );
}
