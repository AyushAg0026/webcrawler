// Small pure helpers shared by the API layer and the UI.
import type { Impact, ScanStatus, Violation } from '@/types';

export const IMPACTS: Impact[] = ['critical', 'serious', 'moderate', 'minor'];

// Same weights as the backend (scanner/score.js).
export const IMPACT_WEIGHTS: Record<Impact, number> = { critical: 10, serious: 5, moderate: 2, minor: 1 };

export function scorePenalty(impact: Impact, elementCount: number) {
  return IMPACT_WEIGHTS[impact] * elementCount;
}

export function isActive(status: ScanStatus | undefined) {
  return status === 'queued' || status === 'running';
}

/**
 * Same rules as the backend's validateUrl: "example.com" becomes
 * "https://example.com", and only http(s) is allowed.
 * Returns the normalized URL, or an error message.
 */
export function validateUrl(input: string): { url: string } | { error: string } {
  let text = input.trim();
  if (!text) return { error: 'Enter a website URL to scan.' };
  if (!text.includes('://')) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { error: 'Only http:// and https:// addresses can be scanned.' };
    }
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
      return { error: 'That doesn’t look like a full domain. Try something like example.com.' };
    }
    return { url: url.href };
  } catch {
    return { error: 'That isn’t a valid URL. Try something like https://example.com.' };
  }
}

export function countElements(violations: Violation[]) {
  return violations.reduce((sum, v) => sum + v.elements.length, 0);
}

export function countByImpact(violations: Violation[]): Record<Impact, number> {
  const counts: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) counts[v.impact] += v.elements.length;
  return counts;
}

export function sortViolations(violations: Violation[]) {
  return [...violations].sort(
    (a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) || b.elements.length - a.elements.length
  );
}
