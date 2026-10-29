import { CircleCheck, EyeOff, Keyboard, Lock } from 'lucide-react';
import type { KeyboardIssue, KeyboardResult } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { plural, urlPath } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from './states';

const ISSUE_INFO: Record<KeyboardIssue['type'], { label: string; icon: typeof Lock; text: string; tint: string; wcag: string }> = {
  'possible-focus-trap': { label: 'Possible focus trap', icon: Lock, text: 'text-critical', tint: 'bg-critical/12', wcag: '2.1.2' },
  'no-visible-focus': { label: 'No visible focus indicator', icon: EyeOff, text: 'text-serious', tint: 'bg-serious/12', wcag: '2.4.7' },
};

// "nav > a:nth-of-type(2)" -> "a"
const tagOf = (selector: string) => selector.split(/[\s>]+/).pop()?.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? 'element';

function Summary({ keyboard }: { keyboard: KeyboardResult }) {
  const traps = keyboard.issues.filter((i) => i.type === 'possible-focus-trap').length;
  const invisible = keyboard.issues.filter((i) => i.type === 'no-visible-focus').length;
  const items = [
    { label: 'Focus stops reached', value: keyboard.focusableReached, icon: Keyboard, text: 'text-brand-text' },
    { label: 'Possible focus traps', value: traps, icon: Lock, text: 'text-critical' },
    { label: 'Missing focus indicators', value: invisible, icon: EyeOff, text: 'text-serious' },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, text }) => (
        <div key={label} className="rounded-xl border bg-card p-4 shadow-soft">
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon aria-hidden className={cn('size-4', text)} /> {label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KeyboardPanel({ keyboard }: { keyboard: KeyboardResult }) {
  if (keyboard.pages.length === 0) {
    return (
      <EmptyState icon={Keyboard} title="No keyboard data" description="None of the pages could be loaded, so the Tab test didn’t run." />
    );
  }

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Our custom test presses <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Tab</kbd> up to 50
        times on each page, records where focus lands, and flags elements where focus gets stuck or can’t be seen.
      </p>

      <Summary keyboard={keyboard} />

      <section aria-labelledby="kb-issues-title">
        <h3 id="kb-issues-title" className="mb-3 font-semibold tracking-tight">
          Flagged elements
        </h3>
        {keyboard.issues.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm">
            <CircleCheck aria-hidden className="size-4 text-good" /> No keyboard problems found.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
            {keyboard.issues.map((issue, i) => {
              const info = ISSUE_INFO[issue.type];
              return (
                <li key={`${issue.pageUrl}-${issue.element.selector}-${i}`} className="flex items-start gap-3 p-4">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', info.tint)}>
                    <info.icon aria-hidden className={cn('size-4', info.text)} />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {info.label}
                      <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">WCAG {info.wcag}</span>
                    </p>
                    <p className="mt-0.5">
                      <span className="font-mono text-xs">&lt;{issue.element.tag}&gt;</span> {issue.element.text || 'No text'}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {urlPath(issue.pageUrl)} · {issue.element.selector}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="kb-order-title">
        <h3 id="kb-order-title" className="mb-3 font-semibold tracking-tight">
          Focus order per page
        </h3>
        <Accordion type="multiple" className="overflow-hidden rounded-xl border bg-card shadow-soft">
          {keyboard.pages.map(({ pageUrl, focusOrder }) => {
            const pageIssues = keyboard.issues.filter((i) => i.pageUrl === pageUrl);
            const trapSelector = pageIssues.find((i) => i.type === 'possible-focus-trap')?.element.selector;
            return (
              <AccordionItem key={pageUrl} value={pageUrl} className="px-4 last:border-b-0">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="truncate font-mono text-[13px]">{urlPath(pageUrl)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {plural(focusOrder.length, 'stop')}
                      {pageIssues.length > 0 && ` · ${plural(pageIssues.length, 'flag')}`}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-1">
                    {focusOrder.map((stop, i) => {
                      const trapped = stop.selector === trapSelector;
                      return (
                        <li key={`${stop.selector}-${i}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="shrink-0 rounded border px-1.5 font-mono text-xs">{tagOf(stop.selector)}</span>
                          <span className="min-w-0 flex-1 truncate">{stop.text || <span className="italic text-muted-foreground">No text</span>}</span>
                          {trapped ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-critical">
                              <Lock aria-hidden className="size-3.5" /> Possible trap
                            </span>
                          ) : stop.hasVisibleFocus ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-good">
                              <CircleCheck aria-hidden className="size-3.5" />
                              <span className="hidden sm:inline">Visible focus</span>
                              <span className="sr-only sm:hidden">Visible focus</span>
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-serious">
                              <EyeOff aria-hidden className="size-3.5" /> No focus ring
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </div>
  );
}
