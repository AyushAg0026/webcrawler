// Scans a single web page for WCAG 2.1 A/AA violations using axe-core.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { scorePage } from './score.js';
import { checkKeyboard } from './keyboard.js';

// axe-core labels every rule with tags. These four select the rules for
// WCAG 2.0 and 2.1 at conformance levels A and AA.
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/**
 * Makes sure the input is an http(s) URL and returns it in normalized form.
 * "example.com" is accepted and treated as "https://example.com".
 */
export function validateUrl(input) {
  let text = String(input ?? '').trim();
  if (!text.includes('://')) text = `https://${text}`;

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`Invalid URL: "${input}". Example of a valid URL: https://example.com`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${url.protocol}". Only http and https are allowed.`);
  }
  return url.href;
}

// axe tags success criteria as "wcag" + digits: "wcag143" means 1.4.3 and
// "wcag1412" means 1.4.12. The first two digits are always single-digit.
function toWcagCriteria(tags) {
  return tags
    .filter((tag) => /^wcag\d{3,}$/.test(tag))
    .map((tag) => {
      const digits = tag.slice(4);
      return `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
    });
}

// node.target is a list of CSS selectors, one per frame or shadow-DOM level.
// Most of the time it holds exactly one selector.
function formatTarget(target) {
  return target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part)).join(' >>> ');
}

function formatViolation(violation) {
  return {
    ruleId: violation.id,
    source: 'axe',
    impact: violation.impact ?? 'minor',
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    wcag: toWcagCriteria(violation.tags),
    elements: violation.nodes.map((node) => ({
      selector: formatTarget(node.target),
      html: node.html.length > 200 ? `${node.html.slice(0, 200)}…` : node.html,
      failureSummary: node.failureSummary,
    })),
  };
}

// Turns Playwright's long error messages into one readable line.
function describeLoadError(url, err, timeout) {
  if (err.name === 'TimeoutError') {
    return `Timed out after ${timeout / 1000}s while loading ${url}`;
  }
  const netError = err.message.match(/net::(ERR_[A-Z_]+)/);
  if (netError) return `Could not load ${url} (${netError[1]})`;
  return `Could not load ${url}: ${err.message.split('\n')[0]}`;
}

/**
 * Loads one page in headless Chromium and runs axe-core on it.
 *
 * Pass an already-open `browser` to reuse it across many pages (the crawler
 * does this). Without it, a browser is launched and closed here.
 */
export async function scanPage(inputUrl, { browser, timeout = 30000 } = {}) {
  const url = validateUrl(inputUrl);

  const ownsBrowser = !browser;
  if (ownsBrowser) browser = await chromium.launch();

  // A fresh context is like a new incognito window: no cookies shared between scans.
  // bypassCSP lets axe inject its script on sites with a strict Content-Security-Policy.
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout });
    } catch (err) {
      throw new Error(describeLoadError(url, err, timeout));
    }
    if (response) {
      if (response.status() >= 400) {
        throw new Error(`${url} responded with HTTP ${response.status()}`);
      }
      const contentType = response.headers()['content-type'] ?? '';
      if (contentType && !contentType.includes('html')) {
        throw new Error(`${url} is not an HTML page (${contentType})`);
      }
    }

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    // a.href is already an absolute URL, resolved by the browser. The crawler uses these.
    const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => a.href));

    // Runs after axe and link collection, because pressing Tab can change the page (e.g. open menus).
    const keyboard = await checkKeyboard(page);

    // Keyboard issues use the same shape as axe violations, so scoring and reports treat them alike.
    const violations = [...results.violations.map(formatViolation), ...keyboard.issues].sort(
      (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]
    );

    return {
      url,
      finalUrl: page.url(), // differs from url when the site redirected
      title: await page.title(),
      status: 'ok',
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      score: scorePage(violations),
      violations,
      passedRules: results.passes.length,
      needsReview: results.incomplete.length, // axe couldn't decide automatically
      focusOrder: keyboard.focusOrder,
      links,
    };
  } finally {
    // Always clean up, even when the scan throws.
    await context.close();
    if (ownsBrowser) await browser.close();
  }
}
