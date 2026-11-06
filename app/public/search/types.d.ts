// createSearch: an in-memory index over MiniSearch (vendored) for the records an app already holds. Nothing runs on
// import; the index lives only as long as the object, so build it at start and keep it current from sync's watch.
// MiniSearch (~78 KB) loads on first need, not with the page: prepare() (call it when the search box gets focus) or
// the first search. Until it is in, words match as plain text (no ranking, no typo tolerance) and onReady runs once it
// is, so the page can search again. loadSearch() loads it ahead (tests, or an app that searches at start).
//
// The search box's text -> terms (pure, no dependencies). Ported from a working logbook parser.
//   field:value   one field, or an app-defined filter (is:, has:, after:); the app names them
//   "a phrase"    an exact phrase       -word / -field:value   leave out
//   a OR b, a | b either (a group); a space or AND means both
// A near miss of a field name ("tga:16") is searched as plain text and reported, so the box can say "did you mean tag:?".
//
// index.js:
// @core/search (incubating here; it moves into app-sync once a second kind of app uses it): full-text search over the
// records an app holds, with operators. Named exports only and nothing runs on import, so a build keeps only what a
// page uses.
//   createSearch(options)  the index: feed, update, remove, search, prepare (search.js)
//   loadSearch()           loads MiniSearch ahead (it otherwise loads on first need)
//   parseQuery             the box's text -> terms, on its own (query.js, pure)
//   insertOperator, usesOperators   for a "?" operator list: add one at the cursor; whether a query uses any
/** a record to index: it needs a string `id`; the rest is the app's */
export type Record_ = Record<string, unknown>;

export type Hit = { id: string; score: number; fields: string[] } & Record<string, unknown>;

export type Options = {
  /** the record fields that are indexed (text, or arrays of text) */
  fields: string[];
  /** a weight per field; a hit in a heavier field ranks higher */
  boost?: Record<string, number>;
  /** fields copied onto each hit, so a result list needs no second lookup */
  store?: string[];
  /** app-defined filters: `is:`, `has:`, `after:`. They run on the record, not the index */
  operators?: Record<string, (record: Record_, value: string) => boolean>;
  /** a record's sort key for lists with no words in the query (largest first); default `updatedAt` */
  newest?: (record: Record_) => number;
  /** runs once MiniSearch is in, when a search ran before it was (with plain-text matching): search again */
  onReady?: () => void;
};

export type Search = {
  /** add or replace each record */
  feed(records: Record_[]): void;
  update(record: Record_): void;
  remove(id: string): void;
  clear(): void;
  readonly size: number;
  /** loads MiniSearch and builds the index (call it when the search box gets focus) */
  prepare(): Promise<void>;
  /** ranked hits; `unknown` lists misspelt operators with a suggestion */
  search(q: string, opts?: { limit?: number }): { hits: Hit[]; unknown: { op: string; suggest: string }[] };
};

export type CreateSearch = (options: Options) => Search;
