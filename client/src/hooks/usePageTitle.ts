import { useEffect } from 'react';

// Each route gets its own <title>: it's the first thing a screen reader
// announces, and what shows in browser tabs and history.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · A11y Scanner`;
  }, [title]);
}
