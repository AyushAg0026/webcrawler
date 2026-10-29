// TanStack Query hooks. Query handles caching, loading/error states, retries
// and polling, so components just call useScan(id) and render what they get.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isActive } from '@/lib/scan-utils';
import { api } from './client';
import { ApiError } from './errors';

export const queryKeys = {
  scans: ['scans'] as const,
  scan: (id: number) => ['scans', id] as const,
  siteHistory: (domain: string) => ['sites', domain, 'history'] as const,
};

// A 404 or 400 won't fix itself, so only retry network/server errors.
const retry = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2;

export function useScans() {
  return useQuery({
    queryKey: queryKeys.scans,
    queryFn: api.listScans,
    retry,
    // Keep refreshing while any scan in the list is still running.
    refetchInterval: (query) => (query.state.data?.some((s) => isActive(s.status)) ? 3000 : false),
  });
}

export function useScan(id: number) {
  return useQuery({
    queryKey: queryKeys.scan(id),
    queryFn: () => api.getScan(id),
    enabled: Number.isInteger(id),
    retry,
    // Poll every 2 s until the scan is done or failed, then stop.
    refetchInterval: (query) => (isActive(query.state.data?.status) ? 2000 : false),
  });
}

export function useSiteHistory(domain: string) {
  return useQuery({
    queryKey: queryKeys.siteHistory(domain),
    queryFn: () => api.getSiteHistory(domain),
    retry,
  });
}

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ url, maxPages }: { url: string; maxPages: number }) => api.startScan(url, maxPages),
    // The recent-scans list is now out of date.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.scans }),
  });
}
