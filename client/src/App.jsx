import { useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ScanDetail from './pages/ScanDetail.jsx';
import SiteHistory from './pages/SiteHistory.jsx';

export default function App() {
  const location = useLocation();
  const mainRef = useRef(null);
  const isFirstRender = useRef(true);

  // In a single-page app the browser doesn't reload on navigation, so screen
  // readers wouldn't notice the page changed. Moving focus to <main> fixes that.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">A11y Scanner</Link>
          <nav aria-label="Main">
            <Link to="/">New scan</Link>
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scans/:id" element={<ScanDetail />} />
          <Route path="/sites/:domain" element={<SiteHistory />} />
          <Route path="*" element={<h1>Page not found</h1>} />
        </Routes>
      </main>
    </>
  );
}
