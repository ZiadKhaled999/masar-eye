# Netrofit Firefox Extension — Implementation Plan

## Goal
Deliver a working Manifest V2 Firefox extension that captures API responses from `app.netrofit.com` and exports them as CSV files.

## Prerequisites
- Node.js 22+
- `npm install --global web-ext`
- Firefox browser

## Project Structure
```
netrofit-exporter/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/
    └── icon.svg
```

## Implementation Steps

### Step 1: manifest.json
Create Manifest V2 config with:
- `browser_specific_settings.gecko.id`
- Permissions: `webRequest`, `webRequestBlocking`, `storage`, `downloads`, `unlimitedStorage`
- Host pattern in permissions: `"*://app.netrofit.com/*"` (required for webRequest to fire)
- Background script: `background.js` (`"persistent": true`)
- Browser action popup: `popup/popup.html`

### Step 2: background.js
Module-level state and helpers:
```js
let capturedData = {};
let saveTimer = null;
```

Implement request interception:
- Register `browser.webRequest.onBeforeRequest.addListener` with `["blocking"]`
- Filter URLs with broad host pattern `*://app.netrofit.com/*`
- Skip `OPTIONS` preflight requests and non-XHR requests (`details.type !== 'xmlhttprequest'`)
- Use `browser.webRequest.filterResponseData(details.requestId)` to read response streams
- Decode chunks with `TextDecoder`, accumulate in `responseBody`
- Add `filter.onerror` handler to close filter safely
- On `filter.onstop`, cheap `startsWith('{') || startsWith('[')` guard before `JSON.parse`; skip non-JSON bodies
- On successful parse, call `guessEntity(url)`, then `ingest(entity, json)`

Persistence and hydration:
- `persist()`: debounced write of `capturedData` to `browser.storage.local` (serialize `seen` Sets as arrays)
- On startup, hydrate `capturedData` from `browser.storage.local` and restore `seen` Sets
- Add `RESET` message handler: clear `capturedData`, remove `capturedData` from storage, return `{ ok: true }`

Entity inference and ingestion:
- `guessEntity(url)`: walk pathname backwards, skip UUID-ish and numeric segments
- `normalize(res)`: unwrap common envelope keys (`data`, `items`, `results`, `rows`, `list`, `records`)
- `ingest(entity, json)`: normalize, dedupe by `id`/`_id`/`uuid`, append rows, call `persist()`

Message handlers:
- `GET_ENTITY_LIST` → `Object.keys(capturedData)`
- `GET_ENTITY` → `capturedData[msg.entity]`
- `RESET` → clear state and storage

### Step 3: popup UI
- **popup.html**: Status div + Export button + Reset button, link to popup.css and popup.js
- **popup.css**: Minimal styling
- **popup.js**:
  - Read `capturedData` directly from `browser.storage.local.get('capturedData')` instead of messaging the background
  - `flatten(obj, prefix, out)` — recursively flatten nested objects into dot-notation keys
  - `toCSV(rows)` — flatten all rows, compute union of all keys as columns, emit BOM-prefixed CSV with proper quoting
  - On Export click, for each entity download a CSV named `netrofit-<entity>-<timestamp>.csv`
  - On Reset click, send `RESET` message to background and update UI
  - Show entity count / row count in status

```js
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (Array.isArray(v)) out[key] = JSON.stringify(v);
    else out[key] = v;
  }
  return out;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const flat = rows.map(r => flatten(r));
  const cols = [...new Set(flat.flatMap(Object.keys))];
  const escape = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = cols.map(escape).join(',') + '\n';
  const body = flat.map(r => cols.map(c => escape(r[c])).join(',')).join('\n');
  return '\uFEFF' + header + body;
}
```

### Step 4: icons
- Add placeholder `icons/icon.svg`

### Step 5: validation (in strict order)
1. Extension loads → `about:debugging` shows it
2. Background console open, load `app.netrofit.com` → confirm `onBeforeRequest` fires
3. Navigate one page → confirm **`storage.local` has `capturedData` with one entity** ← primary checkpoint
4. Confirm `Captured data for: <entity>` logs
5. Test pagination → confirm row count in storage grows, not resets
6. Test persistence → reload tab, confirm data still there
7. Test Reset → confirm `storage.local` cleared
8. Test Export → confirm CSV downloads with BOM and flattened columns

## Deferred to v1.1
- `lib/analyzer.js` full schema inference (type detection, nullable fields, PK detection)
- `lib/exporter.js` advanced CSV engine
- Entity picker UI with checkboxes
- Auto-pagination / infinite scroll following
- CSV column ordering / user-selected columns

## Moved into v1 scope (previously deferred)
- Persistent storage via `browser.storage.local` + `persist()` + hydration
- Nested/flatten JSON via `flatten()`
- Non-array API unwrapping via `normalize()`
- Deduplication by `id` / `_id` / `uuid` via `ingest()`

## Risks & Edge Cases
- `storage.local` quota (~5MB) — `"unlimitedStorage"` added preemptively; migrate to IndexedDB if needed
- Pagination currently only captures what the user scrolls past; full export requires auto-paginator in v1.1
- Entity name inference depends on URL structure; may need tuning once Netrofit's real API is observed
- `filterResponseData` requires `"blocking"` extraInfoSpec
- Very large responses may hit storage quota; warn user or implement chunked export in v1.1
- WebSocket live updates and `sendBeacon` are not captured; add only if real data gaps are observed
