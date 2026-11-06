// cache.js: what it does is at the top of types.d.ts (kept out of the startup files).
import { createStore, get, set, del, clear } from '../vendor/idb-keyval/6.3.0/index.js';

/** @typedef {import('./types').BlobCache} BlobCache */

/** @param {string} name  the app's name (config.name) @returns {BlobCache} */
export function deviceCache(name) {
  let hasIdb = false;
  try { hasIdb = typeof indexedDB !== 'undefined' && !!indexedDB; } catch { /* blocked */ }
  if (!hasIdb) return memoryCache();
  /** @type {import('../vendor/idb-keyval/6.3.0/index.js').UseStore | null} */
  let store = null;
  const db = () => (store ??= createStore(`${name}-files`, 'blobs'));
  return {
    get: key => get(key, db()).then(v => v instanceof Blob ? v : null),
    set: (key, blob) => set(key, blob, db()),
    del: key => del(key, db()),
    clear: () => clear(db()),
  };
}

/** @returns {BlobCache} */
export function memoryCache() {
  /** @type {Map<string, Blob>} */
  const m = new Map();
  return {
    get: async key => m.get(key) ?? null,
    set: async (key, blob) => { m.set(key, blob); },
    del: async key => { m.delete(key); },
    clear: async () => { m.clear(); },
  };
}
