import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { fetchBusinessMetrics, fetchDailySeries, fetchProfitByProduct, fetchProfitByVendor, fetchProfitByCustomer } from './metricsService';
import type { BusinessMetrics, DailyMetric, ProductProfit, VendorProfit, CustomerProfit } from './metricsService';
import { rangeKey, type DateRange } from '../../utils/dateRange';

// There's no react-query/swr (or any caching library) in this codebase — see
// ThemeContext.tsx for the established "small typed context + useX() hook"
// convention this follows. Without this, every widget on a screen that
// needs "this month's metrics" (Health Score, Profit Analytics, Daily
// Closing, Opportunity Center...) would independently re-fetch and re-sum
// the same rows. This caches each RPC's result per date-range key for the
// session; call invalidate() after a sale/expense is added/edited/deleted
// so stale numbers don't linger.

interface CacheEntry<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface MetricsContextValue {
  getMetrics: (range: DateRange) => CacheEntry<BusinessMetrics | null>;
  loadMetrics: (range: DateRange) => Promise<BusinessMetrics>;
  getDailySeries: (range: DateRange) => CacheEntry<DailyMetric[] | null>;
  loadDailySeries: (range: DateRange) => Promise<DailyMetric[]>;
  getProfitByProduct: (range: DateRange, limit?: number) => CacheEntry<ProductProfit[] | null>;
  loadProfitByProduct: (range: DateRange, limit?: number) => Promise<ProductProfit[]>;
  getProfitByVendor: (range: DateRange, limit?: number) => CacheEntry<VendorProfit[] | null>;
  loadProfitByVendor: (range: DateRange, limit?: number) => Promise<VendorProfit[]>;
  getProfitByCustomer: (range: DateRange, limit?: number) => CacheEntry<CustomerProfit[] | null>;
  loadProfitByCustomer: (range: DateRange, limit?: number) => Promise<CustomerProfit[]>;
  /** Clears every cached result — call after any sale/expense/vendor mutation. */
  invalidate: () => void;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

function useCachedResource<T>() {
  const [, forceRender] = useState(0);
  const store = useRef(new Map<string, CacheEntry<T | null>>());
  const inFlight = useRef(new Map<string, Promise<T>>());

  const get = useCallback((key: string): CacheEntry<T | null> => {
    return store.current.get(key) ?? { data: null, loading: false, error: null };
  }, []);

  const load = useCallback(
    (key: string, fetcher: () => Promise<T>): Promise<T> => {
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      const cached = store.current.get(key);
      if (cached && !cached.loading && !cached.error && cached.data !== null) {
        return Promise.resolve(cached.data);
      }

      store.current.set(key, { data: cached?.data ?? null, loading: true, error: null });
      forceRender(n => n + 1);

      const promise = fetcher()
        .then(data => {
          store.current.set(key, { data, loading: false, error: null });
          forceRender(n => n + 1);
          inFlight.current.delete(key);
          return data;
        })
        .catch((err: Error) => {
          store.current.set(key, { data: null, loading: false, error: err.message });
          forceRender(n => n + 1);
          inFlight.current.delete(key);
          throw err;
        });

      inFlight.current.set(key, promise);
      return promise;
    },
    []
  );

  const clear = useCallback(() => {
    store.current.clear();
    inFlight.current.clear();
    forceRender(n => n + 1);
  }, []);

  return { get, load, clear };
}

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const metrics = useCachedResource<BusinessMetrics>();
  const daily = useCachedResource<DailyMetric[]>();
  const byProduct = useCachedResource<ProductProfit[]>();
  const byVendor = useCachedResource<VendorProfit[]>();
  const byCustomer = useCachedResource<CustomerProfit[]>();

  const invalidate = useCallback(() => {
    metrics.clear();
    daily.clear();
    byProduct.clear();
    byVendor.clear();
    byCustomer.clear();
  }, [metrics, daily, byProduct, byVendor, byCustomer]);

  const value: MetricsContextValue = {
    getMetrics: range => metrics.get(rangeKey(range)),
    loadMetrics: range => metrics.load(rangeKey(range), () => fetchBusinessMetrics(range)),
    getDailySeries: range => daily.get(rangeKey(range)),
    loadDailySeries: range => daily.load(rangeKey(range), () => fetchDailySeries(range)),
    getProfitByProduct: (range, limit) => byProduct.get(`${rangeKey(range)}:${limit ?? ''}`),
    loadProfitByProduct: (range, limit) => byProduct.load(`${rangeKey(range)}:${limit ?? ''}`, () => fetchProfitByProduct(range, limit)),
    getProfitByVendor: (range, limit) => byVendor.get(`${rangeKey(range)}:${limit ?? ''}`),
    loadProfitByVendor: (range, limit) => byVendor.load(`${rangeKey(range)}:${limit ?? ''}`, () => fetchProfitByVendor(range, limit)),
    getProfitByCustomer: (range, limit) => byCustomer.get(`${rangeKey(range)}:${limit ?? ''}`),
    loadProfitByCustomer: (range, limit) => byCustomer.load(`${rangeKey(range)}:${limit ?? ''}`, () => fetchProfitByCustomer(range, limit)),
    invalidate,
  };

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
};

export function useMetricsContext(): MetricsContextValue {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetricsContext must be used within a MetricsProvider');
  return ctx;
}

/**
 * Fetch business metrics for a date range, cached across the whole app for
 * the session. Triggers a load on mount/range-change; returns the cached
 * value immediately on subsequent calls with the same range.
 */
export function useBusinessMetrics(range: DateRange) {
  const ctx = useMetricsContext();
  const entry = ctx.getMetrics(range);

  React.useEffect(() => {
    ctx.loadMetrics(range).catch(() => {
      /* surfaced via entry.error */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  return entry;
}
