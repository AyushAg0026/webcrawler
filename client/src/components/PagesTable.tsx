import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, CircleX } from 'lucide-react';
import type { PageResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { urlPath } from '@/lib/format';
import { ScoreBadge } from './ScoreBadge';

type SortKey = 'url' | 'score' | 'violationCount';
type SortDirection = 'ascending' | 'descending';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'url', label: 'Page' },
  { key: 'score', label: 'Score' },
  { key: 'violationCount', label: 'Violations', className: 'text-right' },
];

export function PagesTable({ pages, onSelectPage }: { pages: PageResult[]; onSelectPage: (url: string) => void }) {
  // Worst pages first by default: that's where to start fixing.
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'score', direction: 'ascending' });

  const sorted = useMemo(() => {
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...pages].sort((a, b) => {
      if (sort.key === 'url') return a.url.localeCompare(b.url) * factor;
      // Failed pages (no score) always go last.
      const av = a[sort.key] ?? Infinity;
      const bv = b[sort.key] ?? Infinity;
      return (av - bv) * factor;
    });
  }, [pages, sort]);

  function changeSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, direction: s.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: key === 'violationCount' ? 'descending' : 'ascending' }
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              const Icon = !active ? ArrowUpDown : sort.direction === 'ascending' ? ArrowUp : ArrowDown;
              return (
                // aria-sort tells screen readers which column is sorted and how.
                <TableHead key={col.key} aria-sort={active ? sort.direction : 'none'} className={col.className}>
                  <button
                    type="button"
                    onClick={() => changeSort(col.key)}
                    className="-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {col.label}
                    <Icon aria-hidden className="size-3.5" />
                  </button>
                </TableHead>
              );
            })}
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((page) => (
            <TableRow
              key={page.url}
              className={page.status === 'ok' ? 'cursor-pointer' : undefined}
              // Mouse users can click anywhere on the row; keyboard users use the button.
              onClick={page.status === 'ok' ? () => onSelectPage(page.url) : undefined}
            >
              <TableCell className="max-w-[16rem] sm:max-w-md">
                <p className="truncate font-mono text-[13px]">{urlPath(page.url)}</p>
                <p className="truncate text-xs text-muted-foreground">{page.status === 'ok' ? page.title : page.error}</p>
              </TableCell>
              <TableCell>
                {page.status === 'ok' ? (
                  <ScoreBadge score={page.score} size="sm" />
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-critical">
                    <CircleX aria-hidden className="size-3.5" /> Failed
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{page.status === 'ok' ? page.violationCount : '–'}</TableCell>
              <TableCell className="text-right">
                {page.status === 'ok' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPage(page.url);
                    }}
                  >
                    View issues<span className="sr-only"> on {urlPath(page.url)}</span>
                    <ChevronRight aria-hidden />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
