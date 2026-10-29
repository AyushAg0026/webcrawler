// Picks the mock or the real API with one flag, and adapts the real backend's
// responses to the shapes in types.ts.
import type {
  ApiClient,
  Impact,
  KeyboardIssue,
  PageResult,
  Scan,
  ScanStatus,
  ScanSummary,
  SiteHistory,
  Violation,
} from '@/types';
import { sortViolations } from '@/lib/scan-utils';
import { ApiError } from './errors';
import { mockApi } from './mock';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Can’t reach the server. Is the backend running? (npm run server)', 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (HTTP ${res.status})`, res.status);
  return body as T;
}

// ---------------------------------------------------------------------------
// What the Express backend actually sends (see server/db.js)
// ---------------------------------------------------------------------------
interface RawViolation {
  ruleId: string;
  source: 'axe' | 'keyboard';
  impact: Impact;
  description: string;
  help: string;
  helpUrl: string;
  wcag: string[];
  elements: { selector: string; html?: string; failureSummary?: string }[];
}

interface RawPage {
  url: string;
  title: string | null;
  status: 'ok' | 'failed';
  error: string | null;
  score: number | null;
  focusOrder?: { selector: string; text: string; hasVisibleFocus: boolean }[];
  violations?: RawViolation[];
  violationCount?: number;
}

interface RawScan {
  id: number;
  domain: string;
  startUrl: string;
  status: 'running' | 'done' | 'failed';
  score: number | null;
  maxPages: number;
  pageCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  violationCount?: number;
  pages?: RawPage[];
  progress?: { pagesDiscovered: number; currentUrl: string | null; pages: RawPage[] } | null;
}

// "header > nav > a:nth-of-type(2)" -> "a"
const tagFromSelector = (selector: string) =>
  selector.split(/[\s>]+/).pop()?.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? 'element';

function toPageResult(page: RawPage): PageResult {
  return {
    url: page.url,
    title: page.title ?? page.url,
    status: page.status,
    score: page.score,
    violationCount:
      page.violationCount ?? (page.violations ?? []).reduce((sum, v) => sum + v.elements.length, 0),
    error: page.error ?? undefined,
  };
}

function toScan(raw: RawScan): Scan {
  const running = raw.status === 'running';
  const rawPages = running ? (raw.progress?.pages ?? []) : (raw.pages ?? []);

  // The backend stores violations per page; the UI groups them per rule across pages.
  const byRule = new Map<string, Violation>();
  const keyboardIssues: KeyboardIssue[] = [];
  for (const page of rawPages) {
    for (const v of page.violations ?? []) {
      const elements = v.elements.map((el) => ({
        selector: el.selector,
        html: el.html,
        fix: el.failureSummary ?? '',
        pageUrl: page.url,
      }));
      const existing = byRule.get(v.ruleId);
      if (existing) existing.elements.push(...elements);
      else {
        byRule.set(v.ruleId, {
          id: v.ruleId,
          impact: v.impact,
          help: v.help,
          description: v.description,
          helpUrl: v.helpUrl,
          wcag: v.wcag,
          source: v.source,
          elements,
        });
      }
      if (v.source === 'keyboard') {
        const type = v.ruleId === 'keyboard-focus-trap' ? 'possible-focus-trap' : 'no-visible-focus';
        for (const el of v.elements) {
          const stop = page.focusOrder?.find((f) => f.selector === el.selector);
          keyboardIssues.push({
            type,
            pageUrl: page.url,
            element: { tag: tagFromSelector(el.selector), text: stop?.text ?? '', selector: el.selector },
          });
        }
      }
    }
  }

  const okPages = rawPages.filter((p) => p.status === 'ok');
  return {
    id: raw.id,
    url: raw.startUrl,
    domain: raw.domain,
    status: raw.status as ScanStatus,
    score: raw.score,
    maxPages: raw.maxPages,
    pagesScanned: raw.pageCount,
    createdAt: raw.startedAt,
    finishedAt: raw.finishedAt,
    error: raw.error,
    violations: sortViolations([...byRule.values()]),
    pages: rawPages.map(toPageResult),
    keyboard: {
      focusableReached: okPages.reduce((sum, p) => sum + (p.focusOrder?.length ?? 0), 0),
      pages: okPages.map((p) => ({ pageUrl: p.url, focusOrder: p.focusOrder ?? [] })),
      issues: keyboardIssues,
    },
    progress: running
      ? {
          pagesDiscovered: raw.progress?.pagesDiscovered ?? 0,
          pagesScanned: raw.pageCount,
          currentUrl: raw.progress?.currentUrl ?? null,
        }
      : null,
  };
}

const realApi: ApiClient = {
  startScan: (url, maxPages) =>
    request<{ id: number }>('/scans', { method: 'POST', body: JSON.stringify({ url, maxPages }) }),

  listScans: async () => {
    const rows = await request<RawScan[]>('/scans');
    return rows.map(
      (r): ScanSummary => ({
        id: r.id,
        url: r.startUrl,
        domain: r.domain,
        status: r.status,
        score: r.score,
        pagesScanned: r.pageCount,
        violationCount: r.violationCount ?? 0,
        createdAt: r.startedAt,
      })
    );
  },

  getScan: async (id) => toScan(await request<RawScan>(`/scans/${id}`)),

  getSiteHistory: (domain) => request<SiteHistory>(`/sites/${encodeURIComponent(domain)}/history`),
};

export const api: ApiClient = USE_MOCK ? mockApi : realApi;
