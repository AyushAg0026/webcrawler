import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { History, ScanSearch } from 'lucide-react';
import { USE_MOCK } from '@/api/client';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'New scan', icon: ScanSearch, end: true },
  { to: '/sites', label: 'History', icon: History, end: false },
];

export function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // A single-page app doesn't reload on navigation, so screen readers wouldn't
  // notice the page changed. Moving focus to <main> announces the new page.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-auto flex items-center gap-2 rounded-md font-semibold tracking-tight">
            <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary shadow-sm">
              <span className="size-3 rounded-full border-[2.5px] border-white" />
            </span>
            {/* On very narrow screens the name is visually hidden but still read out. */}
            <span className="sr-only min-[400px]:not-sr-only">A11y Scanner</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              // NavLink sets aria-current="page" on the active link automatically.
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <Icon aria-hidden className="hidden size-4 sm:block" />
                {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="content" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {/* key: a crash on one page is cleared when you navigate away. */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>Checks WCAG 2.1 Level A &amp; AA with axe-core and a custom keyboard test.</p>
          {USE_MOCK && (
            <p className="rounded-md border px-2 py-0.5 text-xs">Demo mode: showing mock data</p>
          )}
        </div>
      </footer>
    </div>
  );
}
