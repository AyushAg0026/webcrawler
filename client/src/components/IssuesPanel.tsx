import { useMemo, useState } from 'react';
import { FileText, SearchX, Search, X } from 'lucide-react';
import type { Impact, Violation } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IMPACTS } from '@/lib/scan-utils';
import { urlPath } from '@/lib/format';
import { cn } from '@/lib/utils';
import { IssueAccordion } from './IssueAccordion';
import { SEVERITY } from './SeverityBadge';
import { EmptyState } from './states';

interface IssuesPanelProps {
  violations: Violation[];
  pageFilter: string | null;
  onClearPageFilter: () => void;
}

export function IssuesPanel({ violations, pageFilter, onClearPageFilter }: IssuesPanelProps) {
  const [search, setSearch] = useState('');
  const [impacts, setImpacts] = useState<Set<Impact>>(new Set());

  // 1. Limit elements to the selected page.  2. Filter by impact.  3. Text search.
  const byPage = useMemo(
    () =>
      pageFilter
        ? violations
            .map((v) => ({ ...v, elements: v.elements.filter((e) => e.pageUrl === pageFilter) }))
            .filter((v) => v.elements.length > 0)
        : violations,
    [violations, pageFilter]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return byPage.filter((v) => {
      if (impacts.size > 0 && !impacts.has(v.impact)) return false;
      if (!query) return true;
      const haystack = [v.id, v.help, v.description, ...v.wcag, ...v.elements.map((e) => e.selector)].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [byPage, impacts, search]);

  const countFor = (impact: Impact) => byPage.filter((v) => v.impact === impact).length;

  function toggleImpact(impact: Impact) {
    setImpacts((current) => {
      const next = new Set(current);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <label htmlFor="issue-search" className="sr-only">
            Search issues
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="issue-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules, selectors, WCAG…"
            className="pl-9"
          />
        </div>

        {/* Toggle buttons: aria-pressed tells screen readers whether each filter is on. */}
        <div role="group" aria-label="Filter by impact" className="flex flex-wrap gap-2">
          {IMPACTS.map((impact) => {
            const { label, icon: Icon, text, tint, border } = SEVERITY[impact];
            const active = impacts.has(impact);
            return (
              <button
                key={impact}
                type="button"
                aria-pressed={active}
                onClick={() => toggleImpact(impact)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  active ? cn(text, tint, border) : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon aria-hidden className={cn('size-3.5', text)} />
                {label}
                <span className="tabular-nums opacity-80">{countFor(impact)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pageFilter && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            Showing issues on <span className="font-mono">{urlPath(pageFilter)}</span>
          </span>
          <Button id="clear-page-filter" variant="ghost" size="sm" onClick={onClearPageFilter}>
            <X aria-hidden /> Show all pages
          </Button>
        </div>
      )}

      {/* Announces the result count after each filter change. */}
      <p role="status" className="text-sm text-muted-foreground">
        Showing {visible.length} of {byPage.length} rules
      </p>

      {visible.length > 0 ? (
        <IssueAccordion violations={visible} />
      ) : (
        <EmptyState
          icon={SearchX}
          title={byPage.length === 0 ? 'No issues found' : 'No issues match your filters'}
          description={
            byPage.length === 0
              ? 'Nothing was flagged here. Remember that automated tools catch roughly a third of issues, so manual testing still matters.'
              : 'Try a different search term or turn off some impact filters.'
          }
          action={
            byPage.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setImpacts(new Set());
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
