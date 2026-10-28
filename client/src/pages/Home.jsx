import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import ScoreBadge from '../components/ScoreBadge.jsx';
import { usePageTitle } from '../usePageTitle.js';

export default function Home() {
  usePageTitle('New scan');
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scans, setScans] = useState(null);
  const [listError, setListError] = useState('');

  // Load recent scans, and refresh every 5 s while any of them is still running.
  useEffect(() => {
    let timer;
    async function load() {
      try {
        const list = await api.listScans();
        setScans(list);
        setListError('');
        if (list.some((s) => s.status === 'running')) timer = setTimeout(load, 5000);
      } catch (err) {
        setListError(err.message);
      }
    }
    load();
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!url.trim()) {
      setFormError('Please enter a URL to scan.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const { id } = await api.startScan(url.trim(), Number(maxPages));
      navigate(`/scans/${id}`);
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Scan a website for accessibility issues</h1>
      <p className="muted">
        Crawls up to 50 pages on the same site and checks them against WCAG 2.1 A and AA.
      </p>

      <form className="card scan-form" onSubmit={handleSubmit} noValidate>
        <div className="field grow">
          <label htmlFor="url">Website URL</label>
          <input
            id="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={formError ? 'true' : undefined}
            aria-describedby={formError ? 'url-error' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="max-pages">Max pages</label>
          <input
            id="max-pages"
            type="number"
            min="1"
            max="50"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Starting…' : 'Scan'}
        </button>
        {formError && (
          <p id="url-error" className="error" role="alert">
            {formError}
          </p>
        )}
      </form>

      <h2>Recent scans</h2>
      {listError && <p className="error" role="alert">{listError}</p>}
      {!scans && !listError && <p>Loading…</p>}
      {scans?.length === 0 && <p>No scans yet. Enter a URL above to run your first one.</p>}
      {scans?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Score</th>
                <th scope="col">Pages</th>
                <th scope="col">Status</th>
                <th scope="col">Started</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td>
                    <Link to={`/scans/${scan.id}`}>{scan.domain}</Link>
                    <div className="muted small">{scan.startUrl}</div>
                  </td>
                  <td>{scan.status === 'done' ? <ScoreBadge score={scan.score} /> : '–'}</td>
                  <td>{scan.pageCount}</td>
                  <td>
                    <span className={`status ${scan.status}`}>{scan.status}</span>
                  </td>
                  <td>{new Date(scan.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
