// Command-line entry point: npm run scan -- <url> [--max-pages 20] [--json]
import { scanSite } from './crawler.js';
import { saveReport, countByImpact } from './report.js';
import { scoreLabel } from './score.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const maxPagesIndex = args.indexOf('--max-pages');
const maxPages = maxPagesIndex === -1 ? 20 : Number(args[maxPagesIndex + 1]);
const url = args.find((arg, i) => !arg.startsWith('--') && i !== maxPagesIndex + 1);

if (!url || !Number.isInteger(maxPages) || maxPages < 1) {
  console.error('Usage: npm run scan -- <url> [--max-pages 20] [--json]');
  process.exit(1);
}

// Adds up each rule across all pages so the CLI can show the most common problems.
function topRules(pages, limit = 10) {
  const rules = new Map();
  for (const page of pages) {
    for (const v of page.violations) {
      const entry = rules.get(v.ruleId) ?? { ruleId: v.ruleId, impact: v.impact, help: v.help, elements: 0, pages: 0 };
      entry.elements += v.elements.length;
      entry.pages += 1;
      rules.set(v.ruleId, entry);
    }
  }
  return [...rules.values()].sort((a, b) => b.elements - a.elements).slice(0, limit);
}

function printSummary(scan) {
  console.log(`\nSite: ${scan.startUrl}`);
  console.log(`Score: ${scan.score}/100 (${scoreLabel(scan.score)}) across ${scan.pageCount} page(s)\n`);

  console.log('Pages:');
  for (const page of scan.pages) {
    const score = page.status === 'ok' ? String(page.score).padStart(3) : 'ERR';
    console.log(`  ${score}  ${page.url}${page.error ? `  (${page.error})` : ''}`);
  }
  for (const s of scan.skipped) console.log(`  skip ${s.url}  (${s.reason})`);

  const impacts = countByImpact(scan.pages);
  console.log(
    `\nAffected elements: ${impacts.critical} critical, ${impacts.serious} serious, ` +
      `${impacts.moderate} moderate, ${impacts.minor} minor`
  );

  console.log('\nMost common problems:');
  for (const rule of topRules(scan.pages)) {
    console.log(`  [${rule.impact}] ${rule.ruleId}: ${rule.elements} element(s) on ${rule.pages} page(s)`);
  }
}

try {
  const scan = await scanSite(url, {
    maxPages,
    // Progress goes to stderr so that --json output on stdout stays valid JSON.
    onProgress: ({ scanned, url: pageUrl }) => console.error(`[${scanned}/${maxPages}] ${pageUrl}`),
  });
  const files = await saveReport(scan);
  if (asJson) {
    console.log(JSON.stringify(scan, null, 2));
  } else {
    printSummary(scan);
    console.log(`\nReport saved: ${files.html}\nJSON saved:   ${files.json}`);
  }
} catch (err) {
  console.error(`Scan failed: ${err.message}`);
  process.exitCode = 1;
}
