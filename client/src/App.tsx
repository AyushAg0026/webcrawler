import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LoadingBlock, Skeleton } from '@/components/states';
import HomePage from '@/pages/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Code splitting: these pages (and the chart library they use) are only
// downloaded when someone visits them, so the home page loads faster.
const ScanProgressPage = lazy(() => import('@/pages/ScanProgressPage'));
const ScanResultsPage = lazy(() => import('@/pages/ScanResultsPage'));
const SitesPage = lazy(() => import('@/pages/SitesPage'));
const SiteHistoryPage = lazy(() => import('@/pages/SiteHistoryPage'));

function PageFallback() {
  return (
    <LoadingBlock label="Loading page" className="space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-xl" />
    </LoadingBlock>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="scans/:id/progress" element={<Suspense fallback={<PageFallback />}><ScanProgressPage /></Suspense>} />
        <Route path="scans/:id" element={<Suspense fallback={<PageFallback />}><ScanResultsPage /></Suspense>} />
        <Route path="sites" element={<Suspense fallback={<PageFallback />}><SitesPage /></Suspense>} />
        <Route path="sites/:domain" element={<Suspense fallback={<PageFallback />}><SiteHistoryPage /></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
