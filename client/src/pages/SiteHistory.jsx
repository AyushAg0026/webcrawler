import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { api } from '../api.js';
import ScoreBadge from '../components/ScoreBadge.jsx';
import { baseOptions, themeColors } from '../components/charts.js';
import { usePageTitle } from '../usePageTitle.js';

function HistoryChart({ history }) {
  const colors = themeColors();
  const options = baseOptions(colors);
  options.scales.y.min = 0;
  options.scales.y.max = 100;
  // Hovering anywhere over a date shows its tooltip, no need to hit the exact dot.
  options.interaction = { mode: 'index', intersect: false };
  options.plugins.tooltip = { callbacks: { label: (ctx) => ` Score: ${ctx.raw}/100` } };

  const data = {
    labels: history.map((h) =>
      new Date(h.finishedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    ),
    datasets: [
      {
        data: history.map((h) => h.score),
        borderColor: colors.series,
        backgroundColor: colors.series,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: colors.surface,
        pointBorderWidth: 2,
        tension: 0,
      },
    ],
  };

  return (
    <div className="chart" style={{ height: 300 }}>
      <Line
        data={data}
        options={options}
        role="img"
        aria-label={`Line chart of score over ${history.length} scans, from ${history[0].score} to ${history.at(-1).score}. Data in the table below.`}
      />
    </div>
  );
}

export default function SiteHistory() {
  const { domain } = useParams();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  usePageTitle(`History for ${domain}`);

  useEffect(() => {
    api
      .getHistory(domain)
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err.message));
  }, [domain]);

  return (
    <>
      <p className="breadcrumb"><Link to="/">← All scans</Link></p>
      <h1>Score history for {domain}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!history && !error && <p>Loading…</p>}
      {history?.length === 0 && <p>No finished scans for this site yet.</p>}
      {history?.length > 0 && (
        <>
          <section className="card">
            <h2>Score over time</h2>
            {history.length === 1 && <p className="muted">Only one scan so far. Run another to see a trend.</p>}
            <HistoryChart history={history} />
          </section>
          <h2>All scans</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Finished</th>
                  <th scope="col">Score</th>
                  <th scope="col">Pages</th>
                  <th scope="col"><span className="visually-hidden">Link</span></th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.scanId}>
                    <td>{new Date(h.finishedAt).toLocaleString()}</td>
                    <td><ScoreBadge score={h.score} /></td>
                    <td>{h.pageCount}</td>
                    <td><Link to={`/scans/${h.scanId}`}>View scan #{h.scanId}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
