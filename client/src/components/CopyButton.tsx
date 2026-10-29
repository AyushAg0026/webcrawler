import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Copies `text` and confirms both visually and to screen readers. */
export function CopyButton({ text, label = 'Copy selector' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. non-HTTPS). The text is still selectable.
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label={label} className="shrink-0">
        {copied ? <Check aria-hidden className="text-good" /> : <Copy aria-hidden />}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}
