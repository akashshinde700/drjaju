import { lazy } from 'react';

// Every deploy replaces all JS chunk files with newly content-hashed names
// (dist/assets/PatientOverview-<hash>.js) and deletes the old ones. A
// browser tab left open — or one with a cached index.html — still holds
// references to the OLD hashes, so a route-level React.lazy() import for a
// chunk that's since been deleted 404s. This server (nginx, no .htaccess
// support) doesn't 404 it cleanly — it falls back to serving index.html's
// HTML content for the missing .js request, which the browser then rejects
// with "Expected a JavaScript-or-Wasm module script but the server
// responded with a MIME type of text/html", crashing to the error boundary.
//
// The fix: on the FIRST such failure, force a full reload — that fetches
// the current index.html, which references the current (existing) chunk
// hashes, so the retry succeeds. Guarded by sessionStorage so a genuinely
// broken chunk (bad deploy, real network failure) doesn't reload-loop
// forever — it reloads once, then lets the error surface normally.
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const storageKey = 'chunk-reload-attempted';
    try {
      const module = await componentImport();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      const alreadyReloaded = sessionStorage.getItem(storageKey) === 'true';
      const isChunkError =
        /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|MIME type of "text\/html"/i.test(
          error?.message || ''
        );

      if (isChunkError && !alreadyReloaded) {
        sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
        // Never resolves — the reload navigates away before this matters.
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
