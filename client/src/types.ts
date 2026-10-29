// Shared data types. Both the mock API and the real-API adapter return exactly
// these shapes, so components never know (or care) which one is active.

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';
export type ScanStatus = 'queued' | 'running' | 'done' | 'failed';

export interface AffectedElement {
  selector: string;
  /** What to change, e.g. axe's "Fix any of the following: ..." summary. */
  fix: string;
  pageUrl: string;
  /** Short HTML snippet of the element (added: helps people find it). */
  html?: string;
}

/** One rule that failed, with every affected element across all pages. */
export interface Violation {
  /** The rule id, e.g. "image-alt". Unique within a scan. */
  id: string;
  impact: Impact;
  /** Short title, e.g. "Images must have alternative text" (added for the UI). */
  help: string;
  description: string;
  helpUrl: string;
  /** WCAG success criteria, e.g. ["1.1.1"]. */
  wcag: string[];
  /** 'keyboard' = our custom Tab check, 'axe' = axe-core (added). */
  source: 'axe' | 'keyboard';
  elements: AffectedElement[];
}

export interface PageResult {
  url: string;
  title: string;
  /** Pages can fail to load (timeouts, 404s); those have no score (added). */
  status: 'ok' | 'failed';
  score: number | null;
  /** Number of affected elements on this page. */
  violationCount: number;
  error?: string;
}

export interface FocusStop {
  selector: string;
  text: string;
  hasVisibleFocus: boolean;
}

export interface KeyboardIssue {
  type: 'possible-focus-trap' | 'no-visible-focus';
  pageUrl: string;
  element: { tag: string; text: string; selector: string };
}

export interface KeyboardResult {
  /** Total focus stops reached by pressing Tab, across all pages. */
  focusableReached: number;
  /** The recorded Tab order for each page (added: the Keyboard tab shows it). */
  pages: { pageUrl: string; focusOrder: FocusStop[] }[];
  issues: KeyboardIssue[];
}

/** Live numbers while a scan is queued or running (added for the Progress page). */
export interface ScanProgress {
  pagesDiscovered: number;
  pagesScanned: number;
  currentUrl: string | null;
}

export interface Scan {
  id: number;
  url: string;
  domain: string;
  status: ScanStatus;
  score: number | null;
  maxPages: number;
  pagesScanned: number;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  violations: Violation[];
  pages: PageResult[];
  keyboard: KeyboardResult;
  progress: ScanProgress | null;
}

/** A row in the "Recent scans" list. GET /api/scans doesn't send full violation data. */
export interface ScanSummary {
  id: number;
  url: string;
  domain: string;
  status: ScanStatus;
  score: number | null;
  pagesScanned: number;
  violationCount: number;
  createdAt: string;
}

export interface HistoryPoint {
  scanId: number;
  score: number;
  violationCount: number;
  pagesScanned: number;
  finishedAt: string;
}

export interface SiteHistory {
  domain: string;
  history: HistoryPoint[];
}

/** What both the mock and the real API implement. */
export interface ApiClient {
  startScan(url: string, maxPages: number): Promise<{ id: number }>;
  listScans(): Promise<ScanSummary[]>;
  getScan(id: number): Promise<Scan>;
  getSiteHistory(domain: string): Promise<SiteHistory>;
}
