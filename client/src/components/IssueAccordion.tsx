import { useState } from 'react';
import { ExternalLink, Keyboard } from 'lucide-react';
import type { Violation } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { plural, urlPath } from '@/lib/format';
import { CopyButton } from './CopyButton';
import { SeverityBadge } from './SeverityBadge';

const INITIAL_ELEMENTS = 5;

function WcagBadges({ criteria }: { criteria: string[] }) {
  if (criteria.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {criteria.map((c) => (
        <span key={c} className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          WCAG {c}
        </span>
      ))}
    </span>
  );
}

function IssueDetails({ violation }: { violation: Violation }) {
  const [showAll, setShowAll] = useState(false);
  const elements = showAll ? violation.elements : violation.elements.slice(0, INITIAL_ELEMENTS);
  const hidden = violation.elements.length - elements.length;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{violation.description}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <WcagBadges criteria={violation.wcag} />
        <a
          href={violation.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-brand-text underline-offset-4 hover:underline"
        >
          Learn how to fix this
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">Affected elements ({violation.elements.length})</h4>
        <ul className="space-y-3">
          {elements.map((el, i) => (
            <li key={`${el.pageUrl}-${el.selector}-${i}`} className="rounded-lg border bg-background/60 p-3">
              <p className="mb-2 truncate font-mono text-xs text-muted-foreground" title={el.pageUrl}>
                {urlPath(el.pageUrl)}
              </p>
              <div className="flex items-start gap-2 rounded-md border bg-muted/60 py-1 pl-3 pr-1">
                <code className="flex-1 py-1 font-mono text-[13px] break-all">{el.selector}</code>
                <CopyButton text={el.selector} />
              </div>
              {el.html && (
                // Wraps instead of scrolling: a scrollable box would need to be
                // keyboard-focusable so keyboard users could scroll it (axe: scrollable-region-focusable).
                <pre className="mt-2 rounded-md bg-muted/40 px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground">
                  {el.html}
                </pre>
              )}
              {el.fix && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">How to fix: </span>
                  <span className="whitespace-pre-line text-muted-foreground">{el.fix.trim()}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAll(true)}>
            Show {hidden} more
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * One accordion row per rule. Radix renders each header as a real <button>
 * inside a heading, with aria-expanded, and supports arrow-key navigation.
 */
export function IssueAccordion({ violations }: { violations: Violation[] }) {
  return (
    <Accordion type="multiple" className="overflow-hidden rounded-xl border bg-card shadow-soft">
      {violations.map((v) => {
        const pageCount = new Set(v.elements.map((e) => e.pageUrl)).size;
        return (
          <AccordionItem key={v.id} value={v.id} className="px-4 last:border-b-0">
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <SeverityBadge impact={v.impact} className="self-start sm:self-auto" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{v.help}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-normal text-muted-foreground">
                    <span className="font-mono">{v.id}</span>
                    <span aria-hidden>·</span>
                    {plural(v.elements.length, 'element')}
                    <span aria-hidden>·</span>
                    {plural(pageCount, 'page')}
                    {v.source === 'keyboard' && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>·</span>
                        <Keyboard aria-hidden className="size-3" /> Keyboard check
                      </span>
                    )}
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm">
              <IssueDetails violation={v} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
