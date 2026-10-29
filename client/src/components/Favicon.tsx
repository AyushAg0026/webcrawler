import { useState } from 'react';
import { USE_MOCK } from '@/api/client';
import { cn } from '@/lib/utils';

/** Site icon loaded from the site itself; falls back to the domain's first letter. */
export function Favicon({ url, domain, className }: { url: string; domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  let origin = '';
  try {
    // Mock domains don't exist, so don't request their icons.
    if (!USE_MOCK) origin = new URL(url).origin;
  } catch {
    // Invalid URL: the letter fallback is used.
  }

  return (
    <span
      aria-hidden
      className={cn('grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-sm font-semibold uppercase', className)}
    >
      {failed || !origin ? (
        domain.replace(/^www\./, '').charAt(0)
      ) : (
        <img src={`${origin}/favicon.ico`} alt="" width={18} height={18} loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
