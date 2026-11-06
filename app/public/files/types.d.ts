// @core/files: files(options) -> a module for createApp({ config, modules }) (app-sync's runner), needs auth and sync
// (app-sync SHAPES.md row 6). A file's metadata is a sync record in a collection the app names (so it syncs, conflicts
// and counts like any save); its bytes go to the app's own Worker (/api/files/, worker/files.js, an R2 bucket) through
// an upload queue of this module's own.
//
// files({ collection, scope, maxBytes, image, exif, url, fetch, cache, token, now, win })
//   collection  the sync collection of the metadata records (the app lists it in sync's colls and its rules)
//   scope(user) the scope a file goes to when add() names none (default: the account's own uid, a personal file)
//   maxBytes    per-file cap (default 100 MB, the Worker's request limit); bigger files are refused at add()
//   image       { maxDim (2048), thumbDim (320), type ('image/webp'), quality (0.85) }: pictures are stored upright,
//               resized and re-encoded (EXIF and GPS dropped), with a thumbnail (image.js); other files as they are
//   exif        false (default) | true: read the date taken before the re-encode | { place: true }: and the GPS place
//   url         the Worker route (default '/api/files'); fetch, cache, token, now, win: stand-ins for tests
//
// -> api
//   add(file, { scope, extra }) -> { id, record }: at once, offline too. The record { id, name, type, size, w?, h?,
//     thumb?, taken?, place?, state: 'local', ...extra } is saved through sync.save; the bytes (and thumbnail) wait in
//     the device cache (IndexedDB `<name>-files`) and an upload job (ctx.storage: `<name>:files/queue`). Uploads run
//     when online and signed in, retry with back-off, and count as unsent in ctx.status (so sign-out says so, a switch
//     to another account waits, and the update's reload waits). Once sent, the record's state becomes 'stored'.
//   url(id, { scope, thumb }) -> an object URL: from the device cache, else fetched from the Worker and kept.
//     blob(id, { scope, thumb }) -> the Blob. A file not uploaded yet from another device: an error with status 404.
//   remove(idOrRecord, { scope }) -> the record's delete through sync (a tombstone), and the Worker delete queued.
//   jobs() -> the waiting jobs (stuck: refused, with why); retry(id?) tries stuck ones again; discard(id) drops one.
//   kick() -> sends what is due now (the module does this itself on sign-in, coming online and after add).
// Sign-out keeps the cache and the queue (they send at the same account's next sign-in); a switch to another account
// or forget() wipes both, like sync's device copy.
//
// index.js:
// @core/files (incubating here; it moves into app-sync once a second kind of app uses it): photos and files for an
// app, offline first. Named exports only and nothing runs on import, so a build keeps only what a page uses.
//   files(options)  the module for createApp (module.js: the api, the formats, sign-out and switch)
//   prepareImage    the resize + thumbnail on its own (image.js), fit (its size rule)
// The Worker side is worker/files.js (/api/files/, an R2 bucket bound as FILES).
//
// queue.js:
// The upload queue: the uploads and deletes this device still owes the Worker, one account's at a time, kept as JSON
// in the module's storage (ctx.storage(): `<name>:files/queue`, NOTES "Files formats"):
//   { v: 1, uid, jobs: Job[] }
//   Job { id, scope, op: 'put' | 'delete', parts: ['file', 'thumb'?] (put: the parts still to send), tries,
//         at (ms: not before), stuck?: why (refused: waits for retry or discard), rec? (put: the metadata record) }
// Pure: no network or timers here (module.js runs it), so the unit tests drive it with their own store and clock.
//
// cache.js:
// The device copy of the files' bytes: IndexedDB database `<name>-files`, store `blobs`, one Blob per key
// `<scope>/<id>` and `<scope>/<id>.thumb` (NOTES "Files formats"), through vendored idb-keyval. Files added here wait
// in it for their upload; files fetched from the Worker are kept for next time. A switch to another account wipes it.
// Without IndexedDB (some private windows) it keeps them in memory for the page.
//
// image.js:
// Pictures, before they are stored: upright (the camera's orientation applied), at most maxDim on the long side, plus a
// thumbnail at most thumbDim, re-encoded as webp (jpeg where the browser can't write webp). Re-encoding drops the
// photo's EXIF, GPS included, so no place leaves the device by accident (exif.js reads what the app asked for first).
// Anything that is not a picture the browser can draw comes back null and is stored as it is.

export interface FileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  w?: number;
  h?: number;
  thumb?: boolean;
  taken?: number;
  place?: { lat: number; lng: number };
  state: 'local' | 'stored';
  _deleted?: boolean;
  [extra: string]: unknown;
}

export interface Job {
  id: string;
  scope: string;
  op: 'put' | 'delete';
  parts?: ('file' | 'thumb')[];
  tries: number;
  at: number;
  stuck?: string;
  rec?: FileRecord;
}

export interface BlobCache {
  get(key: string): Promise<Blob | null>;
  set(key: string, blob: Blob): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ImageOptions {
  maxDim?: number;
  thumbDim?: number;
  type?: string;
  quality?: number;
}

export interface FilesOptions {
  collection: string;
  scope?: (user: { uid: string }) => string;
  maxBytes?: number;
  image?: ImageOptions;
  exif?: boolean | { place?: boolean };
  url?: string;
  fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  cache?: BlobCache;
  token?: (force: boolean) => Promise<string>;
  now?: () => number;
  win?: Window | null;
}

export interface FilesApi {
  add(file: Blob, o?: { scope?: string; extra?: Record<string, unknown> }): Promise<{ id: string; record: FileRecord }>;
  url(id: string, o?: { scope?: string; thumb?: boolean }): Promise<string>;
  blob(id: string, o?: { scope?: string; thumb?: boolean }): Promise<Blob>;
  remove(idOrRecord: string | FileRecord, o?: { scope?: string }): Promise<void>;
  jobs(): Job[];
  retry(id?: string): void;
  discard(id: string): void;
  kick(): Promise<void>;
}
