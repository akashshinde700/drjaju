import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * useDebouncedSearch hook
 * Provides debounced search with request cancellation to avoid race conditions.
 *
 * @param {Function} searchFn - async function that performs the search (receives query)
 * @param {number} delay - debounce delay in ms (default 300)
 * @returns {Object} { query, setQuery, isSearching, error, clear }
 */
export function useDebouncedSearch(searchFn, delay = 300) {
  const queryRef = useRef('');
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQueryState] = useState('');

  const setQuery = useCallback((newQuery) => {
    setQueryState(newQuery);
    queryRef.current = newQuery;
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setQueryState('');
    setError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const q = queryRef.current.trim();
      if (!q) return;
      // Cancel previous request
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      try {
        setIsSearching(true);
        await searchFn(q, { signal: abortControllerRef.current.signal });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Search failed');
        }
      } finally {
        setIsSearching(false);
      }
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [searchFn, delay]);

  return { query, setQuery, isSearching, error, clear };
}
