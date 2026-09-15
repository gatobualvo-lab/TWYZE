import { useEffect, useRef, useState } from 'react';
import { runUniversalSearch, SearchResult } from '../services/search/searchService';

const DEBOUNCE_MS = 300;

export function useUniversalSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const thisRequest = ++requestId.current;
    const timer = setTimeout(() => {
      runUniversalSearch(trimmed)
        .then(data => {
          // Ignore stale responses if a newer keystroke has already superseded this one
          if (requestId.current === thisRequest) setResults(data);
        })
        .catch(() => {
          if (requestId.current === thisRequest) setResults([]);
        })
        .finally(() => {
          if (requestId.current === thisRequest) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}
