// Mock API: realistic fake data so the whole UI works without the backend.
// A new scan is simulated in the browser and "finishes" after about 10 seconds.
//
// Demo tip: scanning a domain that starts with "fail" (e.g. fail.example.com)
// simulates a site that can't be loaded, so you can see the error states.
import type {
  ApiClient,
  FocusStop,
  Impact,
  KeyboardIssue,
  PageResult,
  Scan,
  ScanSummary,
  Violation,
} from '@/types';
import { countElements, isActive, scorePenalty, sortViolations, validateUrl } from '@/lib/scan-utils';
import { ApiError } from './errors';

const QUEUED_MS = 800;
const SCAN_DURATION_MS = 10_000;
const FAIL_AFTER_MS = 3_000;

// ---------------------------------------------------------------------------
// Seeded random numbers: the same seed always gives the same fake data, so
// the demo looks identical on every reload (Math.random() would not).
// ---------------------------------------------------------------------------
type Random = () => number;

function createRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random: Random, min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T,>(random: Random, list: readonly T[]): T => list[Math.floor(random() * list.length)]!;

function shuffle<T>(random: Random, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Rule catalog (illustrative, modeled on real axe-core rules)
// ---------------------------------------------------------------------------
interface RuleTemplate {
  id: string;
  impact: Impact;
  help: string;
  description: string;
  wcag: string[];
  selectors: string[];
  html: string[];
  fix: string;
}

const AXE_DOCS = 'https://dequeuniversity.com/rules/axe/4.10/';

const RULES: RuleTemplate[] = [
  {
    id: 'image-alt',
    impact: 'critical',
    help: 'Images must have alternative text',
    description: 'Ensures <img> elements have alternate text or a role of none or presentation.',
    wcag: ['1.1.1'],
    selectors: ['.hero > img', 'img.product-thumb', '.team-grid > li:nth-child(3) img', '.blog-card:nth-child(2) img', '.partners img:nth-child(4)'],
    html: ['<img src="/images/hero.webp" class="hero-img">', '<img src="/cdn/p/2231.jpg" class="product-thumb">', '<img src="/team/maya.jpg">'],
    fix: 'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  Element has no title attribute',
  },
  {
    id: 'button-name',
    impact: 'critical',
    help: 'Buttons must have discernible text',
    description: 'Ensures buttons have discernible text that screen readers can announce.',
    wcag: ['4.1.2'],
    selectors: ['.navbar .menu-toggle', 'button.icon-close', '.carousel > button.next', '.cart-widget > button'],
    html: ['<button class="menu-toggle"><svg>…</svg></button>', '<button class="icon-close"></button>'],
    fix: 'Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  Element has no title attribute',
  },
  {
    id: 'label',
    impact: 'critical',
    help: 'Form elements must have labels',
    description: 'Ensures every form element has a programmatically associated label.',
    wcag: ['4.1.2', '1.3.1'],
    selectors: ['#newsletter-email', 'input[name="q"]', '#contact-phone', 'select#country'],
    html: ['<input id="newsletter-email" type="email" placeholder="Email">', '<input name="q" type="search">'],
    fix: 'Fix any of the following:\n  Form element does not have an implicit (wrapped) <label>\n  Form element does not have an explicit <label>\n  aria-label attribute does not exist or is empty',
  },
  {
    id: 'color-contrast',
    impact: 'serious',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    description: 'Ensures the contrast between foreground and background colors meets the WCAG 2 AA minimum ratio of 4.5:1.',
    wcag: ['1.4.3'],
    selectors: ['.hero .subtitle', '.pricing-card .muted', 'footer p', '.badge-new', '.btn-ghost', '.post-meta time', '.cookie-banner a'],
    html: ['<p class="subtitle">Ship faster with less code</p>', '<span class="badge-new">New</span>', '<time datetime="2026-09-02">Sep 2</time>'],
    fix: 'Fix any of the following:\n  Element has insufficient color contrast of 2.85 (foreground color: #9ca3af, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
  },
  {
    id: 'link-name',
    impact: 'serious',
    help: 'Links must have discernible text',
    description: 'Ensures links have text that describes where they go.',
    wcag: ['2.4.4', '4.1.2'],
    selectors: ['.social a[href*="x.com"]', '.card > a:first-child', '.footer-icons a:nth-child(2)'],
    html: ['<a href="https://x.com/acme"><i class="icon-x"></i></a>', '<a href="/blog/launch" class="card-link"></a>'],
    fix: 'Fix all of the following:\n  Element is in tab order and does not have accessible text',
  },
  {
    id: 'html-has-lang',
    impact: 'serious',
    help: '<html> element must have a lang attribute',
    description: 'Ensures every HTML document declares its language, so screen readers use the right pronunciation.',
    wcag: ['3.1.1'],
    selectors: ['html'],
    html: ['<html>'],
    fix: 'Fix any of the following:\n  The <html> element does not have a lang attribute',
  },
  {
    id: 'aria-hidden-focus',
    impact: 'serious',
    help: 'ARIA hidden element must not be focusable or contain focusable elements',
    description: 'Ensures aria-hidden elements are not focusable, so keyboard users don’t land on invisible content.',
    wcag: ['4.1.2'],
    selectors: ['.offcanvas[aria-hidden="true"]', '.modal[aria-hidden="true"] a'],
    html: ['<nav class="offcanvas" aria-hidden="true">…</nav>'],
    fix: 'Fix all of the following:\n  Focusable content should have tabindex="-1" or be removed from the DOM',
  },
  {
    id: 'list',
    impact: 'serious',
    help: '<ul> and <ol> must only directly contain <li>, <script> or <template> elements',
    description: 'Ensures lists are structured correctly so screen readers can announce the number of items.',
    wcag: ['1.3.1'],
    selectors: ['ul.nav-list', 'ul.feature-list'],
    html: ['<ul class="nav-list"><div>…</div></ul>'],
    fix: 'Fix all of the following:\n  List element has direct children that are not allowed: div',
  },
  {
    id: 'region',
    impact: 'moderate',
    help: 'All page content should be contained by landmarks',
    description: 'Ensures all content is inside landmarks (header, nav, main, footer) so screen-reader users can jump between sections.',
    wcag: ['1.3.1'],
    selectors: ['.promo-strip', 'body > .announcement', '.chat-widget'],
    html: ['<div class="promo-strip">Free shipping over $50</div>'],
    fix: 'Fix any of the following:\n  Some page content is not contained by landmarks',
  },
  {
    id: 'empty-heading',
    impact: 'minor',
    help: 'Headings should not be empty',
    description: 'Ensures headings have text, since screen-reader users navigate by headings.',
    wcag: ['1.3.1'],
    selectors: ['.card h3:empty', 'section.stats > h2'],
    html: ['<h3 class="card-title"></h3>'],
    fix: 'Fix any of the following:\n  Element does not have text that is visible to screen readers',
  },
];

const PATHS = [
  '/', '/pricing', '/about', '/blog', '/docs', '/contact', '/careers', '/login', '/blog/accessible-forms',
  '/docs/getting-started', '/changelog', '/customers', '/security', '/blog/dark-mode-done-right', '/docs/api',
  '/integrations', '/privacy', '/terms', '/team', '/status',
];

const TITLES: Record<string, string> = {
  '/': 'Home', '/pricing': 'Pricing', '/about': 'About us', '/blog': 'Blog', '/docs': 'Documentation',
  '/contact': 'Contact', '/careers': 'Careers', '/login': 'Sign in', '/changelog': 'Changelog',
  '/customers': 'Customers', '/security': 'Security', '/integrations': 'Integrations', '/privacy': 'Privacy policy',
  '/terms': 'Terms of service', '/team': 'Our team', '/status': 'System status',
};

const FOCUS_STOPS: { tag: string; text: string; selector: string }[] = [
  { tag: 'a', text: 'Skip to content', selector: 'a.skip-link' },
  { tag: 'a', text: 'Home', selector: 'header > a.logo' },
  { tag: 'a', text: 'Product', selector: 'nav > a:nth-of-type(1)' },
  { tag: 'a', text: 'Pricing', selector: 'nav > a:nth-of-type(2)' },
  { tag: 'a', text: 'Docs', selector: 'nav > a:nth-of-type(3)' },
  { tag: 'button', text: 'Search', selector: 'header button.search' },
  { tag: 'a', text: 'Sign in', selector: 'header a.sign-in' },
  { tag: 'a', text: 'Get started', selector: '.hero a.btn-primary' },
  { tag: 'a', text: 'Watch demo', selector: '.hero a.btn-ghost' },
  { tag: 'button', text: 'Next slide', selector: '.carousel > button.next' },
  { tag: 'input', text: 'Email address', selector: '#newsletter-email' },
  { tag: 'button', text: 'Subscribe', selector: 'form.newsletter > button' },
  { tag: 'a', text: 'GitHub', selector: '.footer-icons a:nth-child(1)' },
  { tag: 'a', text: 'Privacy', selector: 'footer a[href="/privacy"]' },
  { tag: 'a', text: 'Terms', selector: 'footer a[href="/terms"]' },
];

// ---------------------------------------------------------------------------
// Fake scan generation
// ---------------------------------------------------------------------------
interface GeneratedPage {
  result: PageResult;
  violations: Violation[];
  focusOrder: FocusStop[];
  keyboardIssues: KeyboardIssue[];
}

// `badness` goes from 0 (clean site) to 1 (very inaccessible).
function generatePage(random: Random, origin: string, path: string, badness: number): GeneratedPage {
  const url = origin + path;
  const title = TITLES[path] ?? path.split('/').pop()!.replace(/-/g, ' ');

  if (random() < 0.04) {
    return {
      result: { url, title, status: 'failed', score: null, violationCount: 0, error: `Timed out after 30s while loading ${url}` },
      violations: [],
      focusOrder: [],
      keyboardIssues: [],
    };
  }

  const violations: Violation[] = [];
  const ruleCount = between(random, 0, Math.round(1 + 5 * badness));
  for (const rule of shuffle(random, RULES).slice(0, ruleCount)) {
    const count = rule.id === 'html-has-lang' ? 1 : between(random, 1, Math.ceil(1 + 4 * badness));
    violations.push({
      id: rule.id,
      impact: rule.impact,
      help: rule.help,
      description: rule.description,
      helpUrl: `${AXE_DOCS}${rule.id}`,
      wcag: rule.wcag,
      source: 'axe',
      elements: shuffle(random, rule.selectors)
        .slice(0, count)
        .map((selector) => ({ selector, html: pick(random, rule.html), fix: rule.fix, pageUrl: url })),
    });
  }

  // Keyboard check: walk a fake Tab order, some stops without a focus ring, rarely a trap.
  const stopCount = between(random, 6, FOCUS_STOPS.length);
  const focusOrder: FocusStop[] = [];
  const keyboardIssues: KeyboardIssue[] = [];
  for (const stop of FOCUS_STOPS.slice(0, stopCount)) {
    const hasVisibleFocus = random() > 0.3 * badness;
    focusOrder.push({ selector: stop.selector, text: stop.text, hasVisibleFocus });
    if (!hasVisibleFocus) keyboardIssues.push({ type: 'no-visible-focus', pageUrl: url, element: stop });
  }
  if (random() < 0.15 * badness) {
    const trapped = focusOrder.at(-1)!;
    const stop = FOCUS_STOPS.find((s) => s.selector === trapped.selector)!;
    keyboardIssues.push({ type: 'possible-focus-trap', pageUrl: url, element: stop });
  }

  // Keyboard problems count toward the score too, exactly like the real scanner.
  const invisible = keyboardIssues.filter((i) => i.type === 'no-visible-focus');
  if (invisible.length) {
    violations.push({
      id: 'keyboard-focus-visible',
      impact: 'serious',
      help: 'Focused element has no visible focus indicator',
      description: 'When an element has keyboard focus, users must be able to see where focus is.',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html',
      wcag: ['2.4.7'],
      source: 'keyboard',
      elements: invisible.map((i) => ({
        selector: i.element.selector,
        fix: 'No outline or box-shadow when focused. Add a :focus-visible style.',
        pageUrl: url,
      })),
    });
  }
  const trap = keyboardIssues.find((i) => i.type === 'possible-focus-trap');
  if (trap) {
    violations.push({
      id: 'keyboard-focus-trap',
      impact: 'critical',
      help: 'Possible keyboard focus trap',
      description: 'Keyboard users must be able to move focus away from every element using Tab.',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html',
      wcag: ['2.1.2'],
      source: 'keyboard',
      elements: [{ selector: trap.element.selector, fix: 'Pressing Tab did not move focus away from this element.', pageUrl: url }],
    });
  }

  const penalty = violations.reduce((sum, v) => sum + scorePenalty(v.impact, v.elements.length), 0);
  return {
    result: { url, title, status: 'ok', score: Math.max(0, 100 - penalty), violationCount: countElements(violations) },
    violations,
    focusOrder,
    keyboardIssues,
  };
}

function buildFinishedScan(id: number, startUrl: string, maxPages: number, createdAt: number, badness: number, seed: number): Scan {
  const random = createRandom(seed);
  const { origin, hostname, pathname } = new URL(startUrl);
  const pageCount = Math.min(maxPages, between(random, Math.ceil(maxPages * 0.7), maxPages));
  const startPath = pathname.replace(/\/$/, '') || '/';
  const paths = [startPath, ...shuffle(random, PATHS.filter((p) => p !== startPath))].slice(0, pageCount);
  const pages = paths.map((path) => generatePage(random, origin, path, badness));

  // Merge each rule's elements from every page into one Violation per rule.
  const byRule = new Map<string, Violation>();
  for (const page of pages) {
    for (const v of page.violations) {
      const existing = byRule.get(v.id);
      if (existing) existing.elements.push(...v.elements);
      else byRule.set(v.id, { ...v, elements: [...v.elements] });
    }
  }

  const scored = pages.filter((p) => p.result.status === 'ok');
  const score = scored.length
    ? Math.round(scored.reduce((sum, p) => sum + (p.result.score ?? 0), 0) / scored.length)
    : null;

  return {
    id,
    url: startUrl,
    domain: hostname,
    status: 'done',
    score,
    maxPages,
    pagesScanned: pages.length,
    createdAt: new Date(createdAt).toISOString(),
    finishedAt: new Date(createdAt + SCAN_DURATION_MS + pages.length * 900).toISOString(),
    error: null,
    violations: sortViolations([...byRule.values()]),
    pages: pages.map((p) => p.result),
    keyboard: {
      focusableReached: pages.reduce((sum, p) => sum + p.focusOrder.length, 0),
      pages: pages.filter((p) => p.result.status === 'ok').map((p) => ({ pageUrl: p.result.url, focusOrder: p.focusOrder })),
      issues: pages.flatMap((p) => p.keyboardIssues),
    },
    progress: null,
  };
}

// ---------------------------------------------------------------------------
// In-memory "database"
// ---------------------------------------------------------------------------
interface MockRecord {
  startedAtMs: number;
  finished: Scan;
  /** Set for simulated failures: the error the scan ends with. */
  failure?: string;
}

const records = new Map<number, MockRecord>();
let nextId = 1;

const DAY = 24 * 60 * 60 * 1000;

// Past scans, oldest first. Badness going down = the site is getting better.
const SEED_SITES = [
  { url: 'https://shop.acme.example/', maxPages: 20, badness: [0.95, 0.85, 0.7, 0.55, 0.4, 0.3] },
  { url: 'https://docs.northwind.example/', maxPages: 10, badness: [0.25, 0.15, 0.1, 0.35] },
  { url: 'https://blog.lumen.example/', maxPages: 5, badness: [0.6, 0.45] },
];

function seed() {
  const now = Date.now();
  const all: { url: string; maxPages: number; badness: number; at: number }[] = [];
  for (const site of SEED_SITES) {
    site.badness.forEach((badness, i) => {
      const daysAgo = (site.badness.length - i) * 6 - 4 + site.url.length % 3;
      all.push({ url: site.url, maxPages: site.maxPages, badness, at: now - daysAgo * DAY - i * 3_600_000 });
    });
  }
  all.sort((a, b) => a.at - b.at);
  for (const s of all) {
    const id = nextId++;
    records.set(id, { startedAtMs: s.at, finished: buildFinishedScan(id, s.url, s.maxPages, s.at, s.badness, id * 7919) });
  }
  // One failed scan, so the "failed" state appears in the recent list.
  const id = nextId++;
  const at = now - 9 * DAY;
  records.set(id, {
    startedAtMs: at,
    finished: buildFinishedScan(id, 'https://staging.acme.example/', 10, at, 0.5, id),
    failure: 'Could not load https://staging.acme.example/ (ERR_CONNECTION_REFUSED)',
  });
}
seed();

/** What a scan looks like `elapsed` ms after it started: queued, running, then done or failed. */
function viewAt(record: MockRecord, now: number): Scan {
  const { finished, failure } = record;
  const elapsed = now - record.startedAtMs;
  const empty = { violations: [], pages: [], keyboard: { focusableReached: 0, pages: [], issues: [] } };

  if (failure && elapsed >= FAIL_AFTER_MS) {
    return { ...finished, ...empty, status: 'failed', score: null, pagesScanned: 0, error: failure, progress: null };
  }
  if (!failure && elapsed >= SCAN_DURATION_MS) return finished;

  if (elapsed < QUEUED_MS) {
    return {
      ...finished, ...empty, status: 'queued', score: null, pagesScanned: 0, finishedAt: null,
      progress: { pagesDiscovered: 0, pagesScanned: 0, currentUrl: null },
    };
  }

  const total = finished.pages.length;
  const fraction = (elapsed - QUEUED_MS) / (SCAN_DURATION_MS - QUEUED_MS);
  const scanned = failure ? 0 : Math.min(total - 1, Math.floor(fraction * total));
  return {
    ...finished,
    ...empty,
    status: 'running',
    score: null,
    finishedAt: null,
    pagesScanned: scanned,
    pages: finished.pages.slice(0, scanned),
    progress: {
      // BFS finds links faster than it scans them, so "discovered" runs ahead.
      pagesDiscovered: Math.min(total, 1 + scanned * 3),
      pagesScanned: scanned,
      currentUrl: finished.pages[scanned]?.url ?? null,
    },
  };
}

function toSummary(scan: Scan): ScanSummary {
  return {
    id: scan.id,
    url: scan.url,
    domain: scan.domain,
    status: scan.status,
    score: scan.score,
    pagesScanned: scan.pagesScanned,
    violationCount: countElements(scan.violations),
    createdAt: scan.createdAt,
  };
}

// Fake network delay, so loading skeletons are visible like with a real server.
const delay = () => new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 300));

// Return copies, like a real network response would.
const copy = <T,>(value: T): T => structuredClone(value);

export const mockApi: ApiClient = {
  async startScan(url, maxPages) {
    await delay();
    const result = validateUrl(url);
    if ('error' in result) throw new ApiError(result.error, 400);
    const id = nextId++;
    const now = Date.now();
    const hostname = new URL(result.url).hostname;
    records.set(id, {
      startedAtMs: now,
      finished: buildFinishedScan(id, result.url, maxPages, now, createRandom(id)() * 0.8, id * 104729),
      failure: hostname.startsWith('fail') ? `Could not load ${result.url} (ERR_NAME_NOT_RESOLVED)` : undefined,
    });
    return { id };
  },

  async listScans() {
    await delay();
    const now = Date.now();
    return [...records.values()]
      .map((r) => toSummary(viewAt(r, now)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getScan(id) {
    await delay();
    const record = records.get(id);
    if (!record) throw new ApiError('Scan not found.', 404);
    return copy(viewAt(record, Date.now()));
  },

  async getSiteHistory(domain) {
    await delay();
    const now = Date.now();
    const history = [...records.values()]
      .map((r) => viewAt(r, now))
      .filter((s) => s.domain === domain && s.status === 'done' && !isActive(s.status))
      .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))
      .map((s) => ({
        scanId: s.id,
        score: s.score ?? 0,
        violationCount: countElements(s.violations),
        pagesScanned: s.pagesScanned,
        finishedAt: s.finishedAt!,
      }));
    if (history.length === 0) throw new ApiError('No finished scans for this site yet.', 404);
    return { domain, history };
  },
};
