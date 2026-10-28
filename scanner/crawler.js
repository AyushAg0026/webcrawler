// Phase 3: crawls a site breadth-first and scans every page it finds.
import { chromium } from 'playwright';
import robotsParser from 'robots-parser';
import { scanPage, validateUrl } from './scanPage.js';
import { scoreSite } from './score.js';

const USER_AGENT = 'A11yScanner';
const SKIPPED_EXTENSIONS = /\.(pdf|zip|rar|gz|tar|jpe?g|png|gif|svg|webp|ico|mp3|mp4|webm|docx?|xlsx?|pptx?|exe|dmg)$/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns a canonical form of a link so the same page isn't scanned twice,
 * or null if the link should not be crawled at all.
 *   https://site.com/about/#team  ->  https://site.com/about
 */
export function normalizeUrl(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  // Skips mailto:, tel:, javascript: and anything else that isn't a web page.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (SKIPPED_EXTENSIONS.test(url.pathname)) return null;

  url.hash = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.href;
}

// Downloads and parses robots.txt once per origin. If it's missing or
// unreachable, everything is allowed (that's what the standard says).
async function getRobots(origin, cache) {
  if (!cache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    let text = '';
    try {
      const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) text = await res.text();
    } catch {
      // No reachable robots.txt: nothing is disallowed.
    }
    cache.set(origin, robotsParser(robotsUrl, text));
  }
  return cache.get(origin);
}

/**
 * Crawls from startUrl and returns the full scan: every page's results plus
 * the site-level score and the worst pages.
 */
export async function scanSite(startUrl, { maxPages = 20, delayMs = 500, onProgress } = {}) {
  const start = normalizeUrl(validateUrl(startUrl));
  const startedAt = new Date().toISOString();

  // "Same domain" = same hostname. If the start page redirects (example.com
  // -> www.example.com), the redirect target counts as the same site too.
  const allowedHosts = new Set([new URL(start).hostname]);

  // BFS: the queue holds pages still to visit, oldest first. A URL goes into
  // `visited` when it is queued, so it can never be queued twice.
  const queue = [start];
  const visited = new Set([start]);
  const robotsCache = new Map();
  const pages = [];
  const skipped = [];

  const browser = await chromium.launch();
  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift();
      const robots = await getRobots(new URL(url).origin, robotsCache);
      if (robots.isAllowed(url, USER_AGENT) === false) {
        skipped.push({ url, reason: 'Disallowed by robots.txt' });
        continue;
      }

      // Be polite: wait between requests (longer if robots.txt asks for it).
      if (pages.length > 0) {
        const crawlDelay = (robots.getCrawlDelay(USER_AGENT) ?? 0) * 1000;
        await sleep(Math.max(delayMs, crawlDelay));
      }

      let links = [];
      try {
        const { links: found, ...result } = await scanPage(url, { browser });
        links = found;
        pages.push(result);
        if (pages.length === 1) allowedHosts.add(new URL(result.finalUrl).hostname);
        visited.add(normalizeUrl(result.finalUrl));
      } catch (err) {
        // One broken page shouldn't stop the whole crawl.
        pages.push({ url, status: 'failed', error: err.message, score: null, violations: [] });
      }
      onProgress?.({ scanned: pages.length, maxPages, url });

      for (const link of links) {
        const next = normalizeUrl(link);
        if (next && allowedHosts.has(new URL(next).hostname) && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const score = scoreSite(pages);
  if (score === null) {
    const reason = pages[0]?.error ?? skipped[0]?.reason ?? 'no pages found';
    throw new Error(`Could not scan ${start}: ${reason}`);
  }

  const worstPages = pages
    .filter((p) => p.status === 'ok')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((p) => ({ url: p.url, title: p.title, score: p.score }));

  return {
    startUrl: start,
    domain: new URL(start).hostname,
    maxPages,
    startedAt,
    finishedAt: new Date().toISOString(),
    score,
    pageCount: pages.length,
    worstPages,
    skipped,
    pages,
  };
}
