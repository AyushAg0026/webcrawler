// Phase 5: SQLite storage for sites, scans, pages and violations.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dbPath = process.env.DB_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'a11y.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // lets reads happen while a scan is being written
db.pragma('foreign_keys = ON'); // SQLite doesn't enforce REFERENCES unless asked

// One site has many scans, one scan has many pages, one page has many violations.
// Lists that are only ever read whole (wcag, elements, focus order) are stored as JSON text.
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id         INTEGER PRIMARY KEY,
    domain     TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY,
    site_id     INTEGER NOT NULL REFERENCES sites(id),
    start_url   TEXT NOT NULL,
    status      TEXT NOT NULL,          -- running | done | failed
    score       INTEGER,
    max_pages   INTEGER NOT NULL,
    page_count  INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    started_at  TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY,
    scan_id      INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    title        TEXT,
    status       TEXT NOT NULL,         -- ok | failed
    error        TEXT,
    score        INTEGER,
    duration_ms  INTEGER,
    focus_order  TEXT                   -- JSON
  );
  CREATE TABLE IF NOT EXISTS violations (
    id            INTEGER PRIMARY KEY,
    page_id       INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    rule_id       TEXT NOT NULL,
    source        TEXT NOT NULL,        -- axe | keyboard
    impact        TEXT NOT NULL,
    description   TEXT,
    help          TEXT,
    help_url      TEXT,
    wcag          TEXT,                 -- JSON
    element_count INTEGER NOT NULL,
    elements      TEXT                  -- JSON
  );
  CREATE INDEX IF NOT EXISTS idx_scans_site ON scans(site_id);
  CREATE INDEX IF NOT EXISTS idx_pages_scan ON pages(scan_id);
  CREATE INDEX IF NOT EXISTS idx_violations_page ON violations(page_id);
`);

// A scan still marked "running" at startup was cut off by a server restart.
db.prepare(`UPDATE scans SET status = 'failed', error = 'Server restarted during the scan' WHERE status = 'running'`).run();

export function createScan({ domain, startUrl, maxPages }) {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO sites (domain, created_at) VALUES (?, ?) ON CONFLICT(domain) DO NOTHING').run(domain, now);
  const site = db.prepare('SELECT id FROM sites WHERE domain = ?').get(domain);
  const result = db
    .prepare(`INSERT INTO scans (site_id, start_url, status, max_pages, started_at) VALUES (?, ?, 'running', ?, ?)`)
    .run(site.id, startUrl, maxPages, now);
  return Number(result.lastInsertRowid);
}

export function updateProgress(scanId, pageCount) {
  db.prepare('UPDATE scans SET page_count = ? WHERE id = ?').run(pageCount, scanId);
}

export function failScan(scanId, message) {
  db.prepare(`UPDATE scans SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`)
    .run(message, new Date().toISOString(), scanId);
}

const insertPage = db.prepare(`
  INSERT INTO pages (scan_id, url, title, status, error, score, duration_ms, focus_order)
  VALUES (@scanId, @url, @title, @status, @error, @score, @durationMs, @focusOrder)`);
const insertViolation = db.prepare(`
  INSERT INTO violations (page_id, rule_id, source, impact, description, help, help_url, wcag, element_count, elements)
  VALUES (@pageId, @ruleId, @source, @impact, @description, @help, @helpUrl, @wcag, @elementCount, @elements)`);

// A transaction makes all these inserts succeed or fail together, and is
// much faster than committing hundreds of rows one at a time.
export const completeScan = db.transaction((scanId, scan) => {
  for (const page of scan.pages) {
    const { lastInsertRowid: pageId } = insertPage.run({
      scanId,
      url: page.url,
      title: page.title ?? null,
      status: page.status,
      error: page.error ?? null,
      score: page.score,
      durationMs: page.durationMs ?? null,
      focusOrder: JSON.stringify(page.focusOrder ?? []),
    });
    for (const v of page.violations) {
      insertViolation.run({
        pageId,
        ruleId: v.ruleId,
        source: v.source,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        wcag: JSON.stringify(v.wcag),
        elementCount: v.elements.length,
        elements: JSON.stringify(v.elements),
      });
    }
  }
  db.prepare(`UPDATE scans SET status = 'done', score = ?, page_count = ?, finished_at = ? WHERE id = ?`)
    .run(scan.score, scan.pageCount, scan.finishedAt, scanId);
});

// Total affected elements in a scan, used by the list and history views.
const VIOLATION_COUNT = `(
  SELECT COALESCE(SUM(v.element_count), 0) FROM violations v
  JOIN pages p ON p.id = v.page_id WHERE p.scan_id = scans.id
) AS violationCount`;

const SCAN_COLUMNS = `
  scans.id, sites.domain, scans.start_url AS startUrl, scans.status, scans.score,
  scans.max_pages AS maxPages, scans.page_count AS pageCount, scans.error,
  scans.started_at AS startedAt, scans.finished_at AS finishedAt, ${VIOLATION_COUNT}`;

export function listScans(limit = 50) {
  return db
    .prepare(`SELECT ${SCAN_COLUMNS} FROM scans JOIN sites ON sites.id = scans.site_id ORDER BY scans.id DESC LIMIT ?`)
    .all(limit);
}

// Rebuilds the same shape the scanner produces, so the HTML report and the
// dashboard can work with either.
export function getScan(id) {
  const scan = db.prepare(`SELECT ${SCAN_COLUMNS} FROM scans JOIN sites ON sites.id = scans.site_id WHERE scans.id = ?`).get(id);
  if (!scan) return null;

  const pages = db
    .prepare(`SELECT id, url, title, status, error, score, duration_ms AS durationMs, focus_order AS focusOrder
              FROM pages WHERE scan_id = ? ORDER BY id`)
    .all(id);
  const violationsFor = db.prepare(`
    SELECT rule_id AS ruleId, source, impact, description, help, help_url AS helpUrl, wcag, elements
    FROM violations WHERE page_id = ?
    ORDER BY CASE impact WHEN 'critical' THEN 0 WHEN 'serious' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END`);

  for (const page of pages) {
    page.focusOrder = JSON.parse(page.focusOrder ?? '[]');
    page.violations = violationsFor.all(page.id).map((v) => ({
      ...v,
      wcag: JSON.parse(v.wcag),
      elements: JSON.parse(v.elements),
    }));
  }
  scan.pages = pages;
  scan.worstPages = pages
    .filter((p) => p.status === 'ok')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((p) => ({ url: p.url, title: p.title, score: p.score }));
  return scan;
}

export function getSiteHistory(domain) {
  const site = db.prepare('SELECT id FROM sites WHERE domain = ?').get(domain);
  if (!site) return null;
  return db
    .prepare(`SELECT id AS scanId, score, page_count AS pagesScanned, finished_at AS finishedAt, ${VIOLATION_COUNT}
              FROM scans WHERE site_id = ? AND status = 'done' ORDER BY finished_at`)
    .all(site.id);
}
