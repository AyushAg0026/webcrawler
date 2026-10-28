// Phase 2: saves a scan as JSON and renders a standalone HTML report.
import fs from 'node:fs/promises';
import path from 'node:path';
import { scoreLabel } from './score.js';

// Anything that came from a scanned page (titles, HTML snippets) must be
// escaped, otherwise a page could inject its own markup into our report.
function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

export function countByImpact(pages) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const page of pages) {
    for (const v of page.violations ?? []) counts[v.impact] += v.elements.length;
  }
  return counts;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function renderViolation(v) {
  const elements = v.elements
    .map(
      (el) => `<li><code>${escapeHtml(el.selector)}</code>${
        el.failureSummary ? `<pre>${escapeHtml(el.failureSummary)}</pre>` : ''
      }</li>`
    )
    .join('');
  return `
    <details>
      <summary><span class="impact ${v.impact}">${v.impact}</span>
        ${escapeHtml(v.help)} <span class="muted">(${escapeHtml(v.ruleId)}, ${plural(v.elements.length, 'element')})</span></summary>
      <p>${escapeHtml(v.description)}</p>
      <p>WCAG: ${escapeHtml(v.wcag.join(', ') || 'n/a')} · <a href="${escapeHtml(v.helpUrl)}">How to fix</a></p>
      <ul class="elements">${elements}</ul>
    </details>`;
}

function renderPage(page) {
  if (page.status !== 'ok') {
    return `
    <section class="page">
      <h3>${escapeHtml(page.url)}</h3>
      <p class="error">Could not scan: ${escapeHtml(page.error)}</p>
    </section>`;
  }
  const focusOrder = (page.focusOrder ?? [])
    .map(
      (f) => `<li><code>${escapeHtml(f.selector)}</code> ${escapeHtml(f.text)}${
        f.hasVisibleFocus ? '' : ' <strong>(no visible focus)</strong>'
      }</li>`
    )
    .join('');
  return `
    <section class="page">
      <h3>${escapeHtml(page.title || page.url)} <span class="score-small">${page.score}/100</span></h3>
      <p class="muted"><a href="${escapeHtml(page.url)}">${escapeHtml(page.url)}</a></p>
      ${page.violations.length ? page.violations.map(renderViolation).join('') : '<p>No violations found.</p>'}
      ${focusOrder ? `<details><summary>Keyboard focus order (${plural(page.focusOrder.length, 'stop')})</summary><ol>${focusOrder}</ol></details>` : ''}
    </section>`;
}

export function renderReportHtml(scan) {
  const impacts = countByImpact(scan.pages);
  const worstRows = (scan.worstPages ?? [])
    .map((p) => `<tr><td>${escapeHtml(p.url)}</td><td>${p.score}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility report: ${escapeHtml(scan.domain)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #1f2937; background: #fff; max-width: 960px; margin: 0 auto; padding: 24px 16px; line-height: 1.5; }
  h1 { margin-bottom: 4px; }
  .muted { color: #4b5563; }
  .score { font-size: 3rem; font-weight: 700; margin: 16px 0 0; }
  .score-small { font-size: 0.9rem; font-weight: 600; color: #374151; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }
  .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
  .card b { display: block; font-size: 1.5rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; word-break: break-all; }
  .page { border-top: 2px solid #e5e7eb; margin-top: 24px; padding-top: 8px; }
  details { margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
  summary { cursor: pointer; }
  .impact { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
  .critical { background: #fde2e2; color: #8a1020; }
  .serious { background: #ffedd5; color: #9a3412; }
  .moderate { background: #fef3c7; color: #78350f; }
  .minor { background: #e5e7eb; color: #374151; }
  .elements code, pre { white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; }
  pre { background: #f3f4f6; padding: 8px; border-radius: 4px; }
  .error { color: #8a1020; }
  a { color: #1d4ed8; }
  a:focus-visible, summary:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
</style>
</head>
<body>
<header>
  <h1>Accessibility report</h1>
  <p class="muted">${escapeHtml(scan.startUrl)} · scanned ${escapeHtml(new Date(scan.startedAt).toLocaleString())}</p>
  <p class="score">${scan.score ?? '–'}<span class="score-small"> / 100 · ${scoreLabel(scan.score)}</span></p>
</header>
<main>
  <h2>Summary</h2>
  <div class="cards">
    <div class="card"><b>${scan.pages.length}</b>pages scanned</div>
    <div class="card"><b>${impacts.critical}</b>critical elements</div>
    <div class="card"><b>${impacts.serious}</b>serious elements</div>
    <div class="card"><b>${impacts.moderate}</b>moderate elements</div>
    <div class="card"><b>${impacts.minor}</b>minor elements</div>
  </div>
  ${worstRows ? `<h2>Worst pages</h2><table><thead><tr><th scope="col">Page</th><th scope="col">Score</th></tr></thead><tbody>${worstRows}</tbody></table>` : ''}
  <h2>Pages</h2>
  ${scan.pages.map(renderPage).join('')}
</main>
</body>
</html>`;
}

export async function saveReport(scan, dir = 'reports') {
  await fs.mkdir(dir, { recursive: true });
  const stamp = scan.startedAt.replace(/[:.]/g, '-');
  const base = path.join(dir, `${scan.domain}-${stamp}`);
  await fs.writeFile(`${base}.json`, JSON.stringify(scan, null, 2));
  await fs.writeFile(`${base}.html`, renderReportHtml(scan));
  return { json: `${base}.json`, html: `${base}.html` };
}
