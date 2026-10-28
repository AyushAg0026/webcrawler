import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { api } from '../api.js';
import ScoreBadge from '../components/ScoreBadge.jsx';
import { baseOptions, themeColors } from '../components/charts.js';
import { usePageTitle } from '../usePageTitle.js';

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

// Adds up affected elements per impact level and per rule, across all pages.
function summarize(pages) {
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const rules = new Map();
  for (const page of pages) {
    for (const v of page.violations) {
      byImpact[v.impact] += v.elements.length;
      const rule = rules.get(v.ruleId) ?? { ruleId: v.ruleId, help: v.help, impact: v.impact, elements: 0, pages: 0 };
      rule.elements += v.elements.length;
      rule.pages += 1;
      rules.set(v.ruleId, rule);
    }
  }
  const byRule = [...rules.values()].sort((a, b) => b.elements - a.elements);
  return { byImpact, byRule };
}

function RuleChart({ rules }) {
  const top = rules.slice(0, 10);
  const colors = themeColors();
  const options = baseOptions(colors);
  options.indexAxis = 'y'; // horizontal bars: long rule names stay readable
  options.plugins.tooltip = {
    callbacks: { label: (ctx) => ` ${ctx.raw} affected element${ctx.raw === 1 ? '' : 's'}` },
  };
  options.scales.x.ticks.precision = 0;
  options.scales.y.grid = { display: false };

  const data = {
    labels: top.map((r) => r.ruleId),
    datasets: [
      {
        data: top.map((r) => r.elements),
        backgroundColor: colors.series,
        borderRadius: 4,
        barThickness: 16,
      },
    ],
  };

  return (
    <>
      <div className="chart" style={{ height: 40 + top.length * 32 }}>
        <Bar
          data={data}
          options={options}
          role="img"
          aria-label={`Bar chart of the ${top.length} most common rules by affected elements. Full data in the table below.`}
        />
      </div>
      <details className="table-toggle">
        <summary>Show chart data as a table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Impact</th>
                <th scope="col">Affected elements</th>
                <th scope="col">Pages</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.ruleId}>
                  <td>
                    <code>{r.ruleId}</code>
                    <div className="small muted">{r.help}</div>
                  </td>
                  <td><span className={`impact ${r.impact}`}>{r.impact}</span></td>
                  <td>{r.elements}</td>
                  <td>{r.pages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function ViolationDetails({ violation: v }) {
  return (
    <details className="violation">
      <summary>
        <span className={`impact ${v.impact}`}>{v.impact}</span> {v.help}{' '}
        <span className="muted small">
          ({v.elements.length} element{v.elements.length === 1 ? '' : 's'})
        </span>
      </summary>
      <p>{v.description}</p>
      <p className="small">
        Rule <code>{v.ruleId}</code> · WCAG {v.wcag.join(', ') || 'n/a'} ·{' '}
        {v.source === 'keyboard' ? 'Custom keyboard check' : 'axe-core'}
      </p>
      <ul className="elements">
        {v.elements.map((el, i) => (
          <li key={i}>
            <code>{el.selector}</code>
            {el.failureSummary && <pre>{el.failureSummary}</pre>}
          </li>
        ))}
      </ul>
      <a href={v.helpUrl} target="_blank" rel="noreferrer">
        How to fix {v.ruleId}<span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    </details>
  );
}

export default function ScanDetail() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  usePageTitle(scan ? `Scan of ${scan.domain}` : 'Scan');

  // Poll every 2 s until the scan is no longer running.
  useEffect(() => {
    let timer;
    async function load() {
      try {
        const data = await api.getScan(id);
        setScan(data);
        if (data.status === 'running') timer = setTimeout(load, 2000);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
    return () => clearTimeout(timer);
  }, [id]);

  const summary = useMemo(() => (scan?.status === 'done' ? summarize(scan.pages) : null), [scan]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!scan) return <p>Loading…</p>;

  return (
    <>
      <p className="breadcrumb"><Link to="/">← All scans</Link></p>
      <h1>Scan of {scan.domain}</h1>
      <p className="muted">
        {scan.startUrl} · started {new Date(scan.startedAt).toLocaleString()}
      </p>

      {/* role="status" makes screen readers announce progress changes politely. */}
      {scan.status === 'running' && (
        <div className="card" role="status">
          <p>Scanning… {scan.pageCount} of up to {scan.maxPages} pages done.</p>
          <progress max={scan.maxPages} value={scan.pageCount} aria-label="Scan progress" />
        </div>
      )}

      {scan.status === 'failed' && (
        <p className="error card" role="alert">This scan failed: {scan.error}</p>
      )}

      {summary && (
        <>
          <section className="card overview" aria-labelledby="overall-heading">
            <h2 id="overall-heading" className="visually-hidden">Overall score</h2>
            <ScoreBadge score={scan.score} large />
            <div>
              <p>Average across {scan.pageCount} scanned page{scan.pageCount === 1 ? '' : 's'}.</p>
              <p>
                <Link to={`/sites/${scan.domain}`}>Score history for {scan.domain}</Link>
                {' · '}
                <a href={`/api/scans/${scan.id}/report`} target="_blank" rel="noreferrer">
                  HTML report<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
          </section>

          <h2>Affected elements by impact</h2>
          <ul className="tiles">
            {IMPACTS.map((impact) => (
              <li key={impact} className="tile">
                <span className="tile-value">{summary.byImpact[impact]}</span>
                <span className={`impact ${impact}`}>{impact}</span>
              </li>
            ))}
          </ul>

          <h2>Most common problems</h2>
          {summary.byRule.length === 0 ? <p>No violations found. Nice work.</p> : <RuleChart rules={summary.byRule} />}

          <h2>Pages</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Score</th>
                  <th scope="col">Rules failed</th>
                  <th scope="col">Affected elements</th>
                </tr>
              </thead>
              <tbody>
                {[...scan.pages]
                  .sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
                  .map((page) => (
                    <tr key={page.id}>
                      <td>
                        <a href={`#page-${page.id}`}>{page.title || page.url}</a>
                        <div className="small muted">{page.url}</div>
                      </td>
                      <td>{page.status === 'ok' ? <ScoreBadge score={page.score} /> : <span className="error">Failed</span>}</td>
                      <td>{page.violations.length}</td>
                      <td>{page.violations.reduce((n, v) => n + v.elements.length, 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <h2>Violation details</h2>
          {scan.pages.map((page) => (
            <section key={page.id} id={`page-${page.id}`} className="card page-section">
              <h3>
                {page.title || page.url}{' '}
                {page.status === 'ok' && <ScoreBadge score={page.score} />}
              </h3>
              <p className="small muted">{page.url}</p>
              {page.status !== 'ok' && <p className="error">Could not scan: {page.error}</p>}
              {page.status === 'ok' && page.violations.length === 0 && <p>No violations on this page.</p>}
              {page.violations.map((v) => (
                <ViolationDetails key={v.ruleId} violation={v} />
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
