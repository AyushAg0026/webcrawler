import { useEffect } from 'react';

// Each page gets its own <title>, which is the first thing a screen reader announces.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} · A11y Scanner`;
  }, [title]);
}
