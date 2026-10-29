// Phase 5: REST API for running scans and reading scan history.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSite } from '../scanner/crawler.js';
import { validateUrl } from '../scanner/scanPage.js';
import { renderReportHtml } from '../scanner/report.js';
import * as store from './db.js';

const PORT = process.env.PORT ?? 3001;
const MAX_PAGES_LIMIT = 50;

const app = express();
app.use(express.json());

// Live progress of running scans (current URL, finished pages). It's only
// needed while a scan runs, so it lives in memory instead of the database.
const liveProgress = new Map();

function summarizePage(page) {
  return {
    url: page.url,
    title: page.title ?? null,
    status: page.status,
    error: page.error ?? null,
    score: page.score,
    violationCount: page.violations.reduce((sum, v) => sum + v.elements.length, 0),
  };
}

// Scanning takes seconds to minutes, too long to keep an HTTP request open.
// So we save a "running" scan, reply right away with 202 Accepted, and the
// client polls GET /api/scans/:id until the status is "done" or "failed".
async function runScanInBackground(scanId, startUrl, maxPages) {
  const live = { pagesDiscovered: 1, currentUrl: startUrl, pages: [] };
  liveProgress.set(scanId, live);
  try {
    const scan = await scanSite(startUrl, {
      maxPages,
      onPageStart: (url) => {
        live.currentUrl = url;
      },
      onProgress: ({ scanned, discovered, page }) => {
        store.updateProgress(scanId, scanned);
        live.pagesDiscovered = discovered;
        live.pages.push(summarizePage(page));
      },
    });
    store.completeScan(scanId, scan);
    console.log(`Scan ${scanId} done: ${scan.score}/100`);
  } catch (err) {
    store.failScan(scanId, err.message);
    console.error(`Scan ${scanId} failed: ${err.message}`);
  } finally {
    liveProgress.delete(scanId);
  }
}

app.post('/api/scans', (req, res) => {
  const { url, maxPages = 20 } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'Please enter a URL to scan.' });

  let startUrl;
  try {
    startUrl = validateUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const pages = Number(maxPages);
  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES_LIMIT) {
    return res.status(400).json({ error: `maxPages must be a whole number from 1 to ${MAX_PAGES_LIMIT}.` });
  }

  const domain = new URL(startUrl).hostname;
  const id = store.createScan({ domain, startUrl, maxPages: pages });
  runScanInBackground(id, startUrl, pages); // not awaited on purpose
  res.status(202).json({ id, status: 'running' });
});

app.get('/api/scans', (req, res) => {
  res.json(store.listScans());
});

app.get('/api/scans/:id', (req, res) => {
  const scan = store.getScan(Number(req.params.id));
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });
  if (scan.status === 'running') scan.progress = liveProgress.get(scan.id) ?? null;
  res.json(scan);
});

// Same HTML report as the CLI, built from the database.
app.get('/api/scans/:id/report', (req, res) => {
  const scan = store.getScan(Number(req.params.id));
  if (!scan || scan.status !== 'done') return res.status(404).send('Report not available.');
  res.type('html').send(renderReportHtml(scan));
});

app.get('/api/sites/:domain/history', (req, res) => {
  const history = store.getSiteHistory(req.params.domain.toLowerCase());
  if (!history) return res.status(404).json({ error: 'No scans found for this site.' });
  res.json({ domain: req.params.domain, history });
});

// In production, the same server also serves the built React dashboard.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any other GET is a dashboard route (e.g. /scans/3); React Router handles it.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Last resort: anything that threw. Bad JSON bodies arrive here with status 400.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

app.listen(PORT, () => console.log(`A11y Scanner API running on http://localhost:${PORT}`));
