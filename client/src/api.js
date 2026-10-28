// Small wrapper around fetch that turns failures into readable Error messages.
async function request(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new Error('Cannot reach the server. Is it running? (npm run server)');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (HTTP ${res.status})`);
  return data;
}

export const api = {
  startScan: (url, maxPages) =>
    request('/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, maxPages }),
    }),
  listScans: () => request('/scans'),
  getScan: (id) => request(`/scans/${id}`),
  getHistory: (domain) => request(`/sites/${encodeURIComponent(domain)}/history`),
};
