import { useState, useEffect } from "react";
import { PRODUCTS_JSON_URL } from "./constants";

/**
 * Module-level cache — products-all.json is fetched once per session.
 * Subsequent calls to useProducts() resolve immediately from this cache.
 */
let _productsCache = null;
let _productsFetchPromise = null;

export function fetchProductsCached() {
  if (_productsCache) return Promise.resolve(_productsCache);
  if (_productsFetchPromise) return _productsFetchPromise;
  // Per-minute cache-buster so admin edits become visible within ~60s. The
  // matching data/.htaccess sets Cache-Control max-age=60 must-revalidate,
  // so this query stamp + the server header bound staleness at ~1 minute.
  // (The earlier daily granularity made admin edits invisible for up to 24h
  // because both browser and Apache caches keyed by URL stayed warm all day.)
  const cacheBuster = Math.floor(Date.now() / 60000);
  const url = `${PRODUCTS_JSON_URL}?v=${cacheBuster}`;
  _productsFetchPromise = fetch(url)
    .then((res) => {
      if (!res.ok)
        throw new Error(`HTTP ${res.status} fetching product catalog`);
      return res.json();
    })
    .then((data) => {
      const arr = Array.isArray(data) ? data : (data.products ?? []);
      _productsCache = arr;
      _productsFetchPromise = null;
      return arr;
    })
    .catch((err) => {
      _productsFetchPromise = null; // allow retry on next call
      throw err;
    });
  return _productsFetchPromise;
}

/**
 * Hook that fetches the live product catalog from OverAI storage.
 * Returns { products, loading, error }.
 * Cached after first fetch — subsequent calls are instant.
 */
export function useProducts() {
  // Fix 13: if cache is empty array, treat as unloaded (allow retry)
  // A legitimately empty catalog shouldn't cache — there's always at least 1 product.
  const cacheIsValid = _productsCache !== null && _productsCache.length > 0;
  const [products, setProducts] = useState(() =>
    cacheIsValid ? _productsCache : [],
  );
  const [loading, setLoading] = useState(() => !cacheIsValid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cacheIsValid) return; // already loaded with valid data — nothing to do
    let cancelled = false;
    fetchProductsCached()
      .then((arr) => {
        if (!cancelled) {
          setProducts(arr);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load products-all.json:", err);
          setError("Failed to load product catalog. Please try refreshing.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error };
}
