import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { ArrowRight, CircleAlert, Globe, LoaderCircle } from 'lucide-react';
import { useStartScan } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateUrl } from '@/lib/scan-utils';

const PAGE_OPTIONS = ['5', '10', '20'];

export function ScanForm() {
  const navigate = useNavigate();
  const startScan = useStartScan();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('10');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateUrl(url);
    if ('error' in result) {
      setError(result.error);
      inputRef.current?.focus(); // put the user right where the problem is
      return;
    }
    setError(null);
    startScan.mutate(
      { url: result.url, maxPages: Number(maxPages) },
      {
        onSuccess: ({ id }) => navigate(`/scans/${id}/progress`),
        onError: (err) => setError(err.message),
      }
    );
  }

  return (
    // noValidate: we show our own, friendlier messages instead of the browser's bubbles.
    <form noValidate onSubmit={handleSubmit} className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <Label htmlFor="scan-url">Website URL</Label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Globe aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="scan-url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="example.com"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'scan-url-error' : 'scan-url-hint'}
            className="h-12 pl-10 font-mono text-[15px]"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-6" disabled={startScan.isPending}>
          {startScan.isPending ? (
            <>
              <LoaderCircle aria-hidden className="animate-spin" /> Starting…
            </>
          ) : (
            <>
              Start scan <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </div>

      {error ? (
        <p id="scan-url-error" role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-critical">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : (
        <p id="scan-url-hint" className="mt-2 text-sm text-muted-foreground">
          https:// is added for you if you leave it out.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span id="max-pages-label" className="text-sm font-medium">
          Max pages to crawl
        </span>
        {/* A radio group (not buttons): it's one choice out of several, and arrow keys move between options. */}
        <RadioGroupPrimitive.Root
          aria-labelledby="max-pages-label"
          value={maxPages}
          onValueChange={setMaxPages}
          orientation="horizontal"
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          {PAGE_OPTIONS.map((option) => (
            <RadioGroupPrimitive.Item
              key={option}
              value={option}
              className="rounded-md px-3.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm"
            >
              {option} pages
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      </div>
    </form>
  );
}
