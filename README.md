# Masar Eye 🕵️‍♂️

> **Data portability for platforms that don't offer it.**
> Masar Eye is a Firefox extension that captures your own data from [app.netrofit.com](https://app.netrofit.com) and exports it as clean CSV files — no lock-in, no server, no third party.

[![Manifest](https://img.shields.io/badge/manifest-v2-blue.svg)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)
[![Firefox](https://img.shields.io/badge/firefox-%E2%89%A5%2091-orange.svg)](https://www.mozilla.org/firefox/)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![No Telemetry](https://img.shields.io/badge/telemetry-none-success.svg)](#privacy--security)

---

## 📖 Table of Contents

- [What Is Masar Eye?](#-what-is-masar-eye)
- [Why Does It Exist?](#-why-does-it-exist)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [Deep Dive: The Capture Engine](#-deep-dive-the-capture-engine)
- [Deep Dive: The Export Pipeline](#-deep-dive-the-export-pipeline)
- [Data Flow](#-data-flow)
- [Configuration Reference](#-configuration-reference)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Development Workflow](#-development-workflow)
- [Extending Masar Eye](#-extending-masar-eye)
- [Privacy & Security](#-privacy--security)
- [Legal & Ethical Use](#-legal--ethical-use)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 What Is Masar Eye?

**Masar Eye** is a Firefox browser extension that lets users export their own data from the Netrofit platform as structured CSV files.

Netrofit (like many modern SaaS platforms) does not offer a built-in data export feature. Once a client's data is inside Netrofit, getting it out — for migration, backup, or integration with another system — is difficult. **Masar Eye solves that problem** by quietly capturing the API responses the Netrofit web app already fetches and turning them into files you own.

The extension runs entirely inside your browser. Nothing is uploaded to any server. Nothing is shared with the developer. Your data stays on your machine.

---

## 💡 Why Does It Exist?

Two reasons:

1. **Data ownership.** If you pay for a platform, you should be able to take your data with you. Most SaaS vendors don't provide an export button because it makes leaving harder. Masar Eye restores that balance.

2. **Integration.** Masar (the parent project) needs to onboard clients who already use Netrofit. Instead of asking them to manually re-enter hundreds of students, courses, and payment records, Masar Eye exports the raw data once and imports it into Masar's schema.

Masar Eye is deliberately **platform-specific** and **read-only**. It reads what Netrofit already sends to your browser. It does not modify, delete, or inject anything into Netrofit.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Zero-config capture** | Just browse the Netrofit app. Every XHR the app makes is intercepted automatically. |
| **Local-first storage** | Data lives in `browser.storage.local`. It survives tab reloads, browser restarts, and extension restarts. |
| **Automatic deduplication** | Rows are deduplicated by `id`, `_id`, or `uuid`. Paginated lists accumulate instead of overwriting each other. |
| **Nested JSON flattening** | Deep objects become dot-notation columns (`student.name`, `course.price`). |
| **Arabic-safe CSV** | All exports are UTF-8 with a BOM so Arabic text renders correctly in Excel. |
| **Per-entity export** | Export students, courses, groups, payments — separately or all at once. |
| **One-click reset** | Clear all captured data with a single button. |
| **No telemetry** | Zero analytics. Zero network calls to the developer. |
| **Auditable** | ~300 lines of plain JavaScript. No build step, no minification, no bundler. |

---

## ⚙️ How It Works

Masar Eye uses Firefox's **`webRequest.filterResponseData()`** API to read HTTP response bodies **before they reach the page**.

This is the key architectural decision. Instead of:

- ❌ Injecting a `<script>` into the page (fragile, breaks on CSP)
- ❌ Patching `window.fetch` (only works if the page uses fetch, not XHR)
- ❌ Scraping the DOM (misses data, breaks on every UI update)

…we hook into Firefox itself, one layer below the page. The site's JavaScript never knows we're there. If Netrofit rewrites their app tomorrow, the extension keeps working.

**The extension:**

1. Registers a blocking listener on every XHR to `app.netrofit.com`.
2. For each request, opens a `StreamFilter` on the response body.
3. Reads the bytes as they stream in, passes them through unchanged (so the app keeps working), and decodes them into a string.
4. When the response finishes, parses the JSON, infers an entity name from the URL, and appends the rows to local storage.
5. When you click Export, the popup reads storage, flattens the JSON, and downloads a CSV per entity.

---

## 📁 Repository Structure

```
masar-eye/
├── manifest.json          # Firefox MV2 manifest — declares permissions, scripts, icons
├── background.js          # Service worker — intercepts requests, stores data
├── popup/
│   ├── popup.html         # Popup UI markup
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic — reads storage, flattens JSON, exports CSV
├── icons/
│   └── icon.svg           # Extension icon (Firefox scales SVGs natively)
├── LICENSE                # Apache 2.0
└── README.md              # This file
```

Every runtime file lives **at the root of the extension folder** — that is, in the same directory as `manifest.json`. Firefox resolves all manifest paths relative to the manifest's own location, so moving `manifest.json` one level up or down breaks everything. This is the single most common setup mistake (see [Troubleshooting](#-troubleshooting)).

---

## 📦 Prerequisites

- **Firefox 91 or newer** — required for MV2's `webRequestBlocking` and modern `browser.*` promise APIs.
- **Node.js 22+** — only needed if you want to use Mozilla's official `web-ext` CLI for live reloading, linting, and packaging. Not required to just load the extension.
- **A Netrofit account** — you must be able to log into `app.netrofit.com` in your own browser.

Optional:

```bash
npm install --global web-ext
```

`web-ext` provides `web-ext run` (live reload during development), `web-ext lint` (catches manifest errors before Firefox does), and `web-ext build` (packages the extension as a `.zip`).

---

## 🚀 Installation

### Method 1 — Permanent install (recommended for daily use)

1. Download or clone this repository.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `manifest.json` from the repo root.
5. The extension appears in your toolbar.

⚠️ **Temporary add-ons are removed when Firefox closes.** For a permanent install, package the extension with `web-ext build` and sign it via [addons.mozilla.org](https://addons.mozilla.org/developers/) (free, self-distribution).

### Method 2 — Live development with `web-ext`

```bash
git clone https://github.com/ZiadKhaled999/masar-eye.git
cd masar-eye
web-ext run
```

This launches a fresh Firefox profile with the extension auto-loaded. Any file change triggers an automatic reload of the extension — no manual re-install needed. Ideal while iterating on `background.js` or the popup.

### Method 3 — Build a distributable `.zip`

```bash
cd masar-eye
web-ext build
```

Produces a `web-ext-artifacts/masar_eye-X.Y.Z.zip`. **Important:** the ZIP must have `manifest.json` at its top level, not inside a `masar-eye/` folder. `web-ext build` handles this correctly. If you zip the folder manually, you'll get an error (see [Troubleshooting](#-troubleshooting)).

---

## 📘 Usage Guide

### Step 1 — Install the extension

Follow [Method 1](#method-1--permanent-install-recommended-for-daily-use) above.

### Step 2 — Log into Netrofit

Open a new tab and log into `app.netrofit.com` as you normally would. The extension does **not** touch the login flow — it only observes requests that happen after you're authenticated, using your existing session cookies.

### Step 3 — Browse the app

Navigate to each page whose data you want to export:

- **Students** — the students list
- **Courses** — the courses list and each course detail page
- **Groups** — groups per course
- **Attendance** — attendance sessions
- **Payments** — subscriptions and payments
- **Assessments** — exams and grades

For **paginated lists**, scroll through every page. Masar Eye accumulates rows across pages rather than overwriting them, but it can only capture what the app actually fetches — if you don't scroll to page 3, page 3's data is never sent to your browser.

> 💡 **Tip:** open the background console via `about:debugging` → **Inspect** to watch the capture log in real time. You'll see lines like:
> ```
> Captured: students (rows: 25, total: 25)
> Captured: students (rows: 25, total: 50)
> Captured: courses (rows: 12, total: 12)
> ```

### Step 4 — Open the popup

Click the Masar Eye icon in the Firefox toolbar. You'll see:

- A **status line** showing how many entities and total rows have been captured.
- A **list of entities** with row counts.
- **Export All** and **Reset** buttons.

### Step 5 — Export

Click **Export All**. Firefox downloads one CSV per entity, named like:

```
netrofit-students-2026-09-22T14-30-00.csv
netrofit-courses-2026-09-22T14-30-00.csv
netrofit-groups-2026-09-22T14-30-00.csv
```

Each CSV is:
- UTF-8 encoded
- Prefixed with a BOM (`\uFEFF`) for Excel compatibility
- Fully quoted (every cell is wrapped in `"…"`, inner quotes doubled)
- Flat — nested objects become dot-notation columns

### Step 6 — Reset

Click **Reset** to clear all captured data. Useful when you want to capture a fresh snapshot or switch accounts. Confirmation is immediate; there's no undo.

---

## 🔬 Deep Dive: The Capture Engine

Everything below lives in `background.js`.

### 1. The hydration gate

```js
browser.storage.local.get('capturedData').then((result) => {
  if (result.capturedData) {
    capturedData = deserializeCapturedData(result.capturedData);
  }
  browser.webRequest.onBeforeRequest.addListener(/* ... */);
});
```

The `webRequest` listener is **registered only after** the storage read completes. This prevents a subtle race condition: if a request arrived during hydration, `ingest()` would write to an empty `capturedData`, and then hydration would overwrite it — silently losing the first page of data on every reload.

### 2. The blocking listener

```js
(details) => {
  if (details.type !== 'xmlhttprequest') return {};
  if (details.method === 'OPTIONS') return {};
  // ...
}
```

Only XHR/fetch requests are intercepted. Static assets, preflights, and document loads are ignored. The listener is **synchronous** — Firefox requires blocking listeners to return a `BlockingResponse` object, not a `Promise`.

### 3. `filterResponseData`

```js
const filter = browser.webRequest.filterResponseData(details.requestId);
```

This is the magic. Firefox hands us a stream filter attached to the response body. We receive chunks as they arrive, and we **must call `filter.write(chunk)`** to pass them through unchanged — otherwise the app hangs waiting for a response that never comes.

### 4. Decoding and parsing

```js
filter.ondata = (event) => {
  chunks.push(event.data);
  filter.write(event.data);
};

filter.onstop = () => {
  const body = decoder.decode(mergeBuffers(chunks));
  const trimmed = body.trimStart();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return;
  try {
    const json = JSON.parse(body);
    const entity = guessEntity(details.url);
    if (entity) ingest(entity, json);
  } catch {}
  finally { filter.close(); }
};
```

The `startsWith('{') || startsWith('[')` guard is a cheap pre-filter. Many XHRs return HTML fragments, plain text, or empty bodies — parsing those throws and spams the console. The guard skips them without a try/catch overhead.

`filter.close()` is the correct way to release the filter. `filter.disconnect()` (a common mistake) leaves the stream dangling and leaks filters over a long session.

### 5. Entity inference

```js
function guessEntity(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const segments = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) continue;
    if (!isNaN(Number(seg))) continue;
    segments.unshift(seg);
    if (segments.length === 2) break;
  }
  return segments.join('-') || null;
}
```

Walks the URL path **backwards**, skips ID-like segments (UUIDs and pure numbers), and collects up to two meaningful segments. Examples:

| URL | Entity |
|---|---|
| `/api/students` | `students` |
| `/api/students/550e8400-…` | `students` |
| `/api/students/550e8400-…/grades` | `students-grades` |
| `/api/courses/42/groups` | `courses-groups` |

### 6. Envelope normalization

```js
function normalize(res) {
  if (Array.isArray(res)) return res;
  for (const k of ['data', 'items', 'results', 'rows', 'list', 'records']) {
    if (Array.isArray(res?.[k])) return res[k];
  }
  return res && typeof res === 'object' ? [res] : [];
}
```

Most APIs wrap lists in an envelope (`{ data: [...] }`, `{ items: [...] }`). This function unwraps the common variants. Single-object responses (like a course detail page) are wrapped in a one-element array so downstream code always works with arrays.

### 7. Ingestion and deduplication

```js
function ingest(entity, json) {
  const rows = normalize(json);
  if (!capturedData[entity]) capturedData[entity] = { rows: [], seen: new Set() };
  for (const row of rows) {
    const id = row?.id ?? row?._id ?? row?.uuid ?? JSON.stringify(row);
    if (capturedData[entity].seen.has(id)) continue;
    capturedData[entity].seen.add(id);
    capturedData[entity].rows.push(row);
  }
  persist();
}
```

Rows are deduplicated by their first available identifier. If a record has no `id`, `_id`, or `uuid`, its full JSON string is used as the key — imperfect but avoids dropping anonymous rows.

### 8. Debounced persistence

```js
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    browser.storage.local.set({
      capturedData: serializeCapturedData(capturedData)
    });
  }, 250);
}
```

Writing to `storage.local` on every ingestion would thrash the disk. The 250 ms debounce coalesces bursts (e.g. a page that fires 10 XHRs at once) into a single write.

### 9. Serialization

`Set` objects don't survive `JSON.stringify`. The serializer converts `Set` → `Array` before storage and back on hydration. This is why we have explicit `serializeCapturedData` / `deserializeCapturedData` functions instead of just `JSON.parse(JSON.stringify(...))`.

---

## 📤 Deep Dive: The Export Pipeline

Everything below lives in `popup/popup.js`.

### 1. Reading from storage directly

The popup reads `capturedData` from `browser.storage.local` **directly**, rather than asking the background script via `runtime.sendMessage`. This avoids the message-size limit (~64 MB in practice, but with structured cloning overhead) and works even if the background script has been suspended by Firefox.

### 2. Flattening

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
```

Nested objects become dot-notation columns:

```json
{ "id": 1, "student": { "name": "Ahmed", "phone": "010…" } }
```

becomes:

| id | student.name | student.phone |
|---|---|---|
| 1 | Ahmed | 010… |

Arrays are serialized as JSON strings in a single cell. This is deliberate — flattening arrays into columns (`tags.0`, `tags.1`, …) produces sparse, unreadable CSVs.

### 3. CSV generation

```js
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

Key details:

- **Column union:** columns are the union of all keys across all rows, not just the first row's keys. If row 1 has `{a, b}` and row 2 has `{a, b, c}`, the CSV has columns `a, b, c`, with an empty cell for row 1's `c`.
- **Universal quoting:** every cell is wrapped in `"…"`, even numbers. Excel and Sheets parse this correctly, and it sidesteps comma/newline/quote issues entirely.
- **BOM prefix:** `\uFEFF` at the start tells Excel the file is UTF-8. Without it, Arabic names appear as `Ø£ØÙ…Ø¯`.

### 4. Download

```js
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
const url = URL.createObjectURL(blob);
browser.downloads.download({ url, filename, saveAs: false })
  .finally(() => setTimeout(() => URL.revokeObjectURL(url), 10000));
```

The `URL.revokeObjectURL` is delayed 10 seconds to give Firefox time to finish writing the file. Revoking too early results in a 0-byte download.

---

## 🔄 Data Flow

```
┌──────────────────┐
│  User browses    │
│  app.netrofit    │
└────────┬─────────┘
         │ XHR request
         ▼
┌──────────────────┐
│  Netrofit API    │
│  returns JSON    │
└────────┬─────────┘
         │ response stream
         ▼
┌──────────────────────────────────────────┐
│  background.js                            │
│  ┌──────────────────────────────────────┐ │
│  │ webRequest.onBeforeRequest           │ │
│  │  → filterResponseData()              │ │
│  │    → decode + JSON.parse             │ │
│  │      → guessEntity()                 │ │
│  │        → normalize()                 │ │
│  │          → ingest()  ──► dedupe      │ │
│  │            → persist() ──► storage   │ │
│  └──────────────────────────────────────┘ │
└────────┬──────────────────────────────────┘
         │ browser.storage.local
         ▼
┌──────────────────────────────────────────┐
│  popup.js                                 │
│  ┌──────────────────────────────────────┐ │
│  │ read capturedData                    │ │
│  │  → flatten() per row                 │ │
│  │    → toCSV()  (union cols + BOM)     │ │
│  │      → Blob → downloads.download()   │ │
│  └──────────────────────────────────────┘ │
└────────┬──────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  CSV files in    │
│  Downloads/      │
└──────────────────┘
```

---

## ⚙️ Configuration Reference

### `manifest.json` keys that matter

| Key | Value | Why |
|---|---|---|
| `manifest_version` | `2` | MV3 removed `webRequestBlocking`. We need it. |
| `permissions` | `webRequest`, `webRequestBlocking`, `storage`, `downloads`, `unlimitedStorage`, `*://app.netrofit.com/*` | Host pattern must be **inside** `permissions` in MV2. |
| `background.persistent` | `true` | Prevents Firefox from suspending the background page mid-capture. |
| `browser_specific_settings.gecko.id` | `netrofit-exporter@local` | Required for `web-ext run` and AMO signing. |
| `browser_specific_settings.gecko.data_collection_permissions.required` | `["none"]` | Mandatory since Nov 2025. This extension transmits nothing. |

### `browser.storage.local`

One key is used:

| Key | Shape |
|---|---|
| `capturedData` | `{ [entity: string]: { rows: object[], seen: string[] } }` |

The `seen` array is a serialized `Set` of record identifiers used for deduplication.

### Runtime message types

The popup can send these messages to the background script:

| Message | Response | Purpose |
|---|---|---|
| `{ type: 'GET_ENTITY_LIST' }` | `string[]` | List of captured entity names |
| `{ type: 'GET_ENTITY', entity: 'students' }` | `{ rows, seen }` | Full data for one entity |
| `{ type: 'RESET' }` | `{ ok: true }` | Clear all captured data |

The popup mostly reads `storage.local` directly and only messages the background for RESET.

---

## 🛠 Troubleshooting

### "Background script could not be found at `background.js`"

`background.js` is not in the same folder as `manifest.json`. Firefox resolves manifest paths relative to the manifest's own directory. Move `background.js` (or the manifest) so both live together.

### "Icon must be square"

Firefox rejects non-square PNG icons. Either resize the PNG to a 1:1 ratio, or switch to SVG. This project uses `icon.svg` for that reason.

### "`manifest.json` was not found" when running `web-ext`

You're running `web-ext` from a directory that doesn't contain the manifest. `cd` into the folder that has `manifest.json` first.

### "The package file must be a ZIP of the extension's files themselves, not of the containing directory"

You zipped the folder instead of its contents. The ZIP must have `manifest.json` at its top level. Use `web-ext build`, which handles this correctly.

### "This add-on could not be installed because it appears to be corrupt"

Usually caused by a manifest syntax error (trailing comma, missing brace). Run `web-ext lint` — it reports the exact line.

### Extension loads, but nothing is captured

Check, in order:

1. **Open the background console** (`about:debugging` → Inspect). Do you see any log lines?
2. **Are there any XHRs at all?** Open DevTools → Network tab, filter by `XHR`. If every request is `document`, `script`, or `img`, the site isn't making JSON XHRs — it might be SSR, WebSocket, or a different transport.
3. **Is the URL pattern matching?** Look at the request URL in DevTools. If it's not under `app.netrofit.com` — for example if the API lives on `api.netrofit.com` — add that host to `permissions` and to the listener's `urls` filter.
4. **Is the response JSON?** Some responses are HTML error pages. The `startsWith('{')` guard skips those silently.

### Export produces empty CSVs

Storage has entities but no rows — likely because `normalize()` didn't unwrap the response envelope. Open the background console, look at the raw response, and check what key holds the array. If it's not in `['data','items','results','rows','list','records']`, add it to `normalize()`.

### Arabic text shows as `Ø£ØÙ…Ø¯`

The BOM prefix is missing or was stripped. Verify `toCSV` returns a string starting with `\uFEFF`. If your editor auto-strips BOMs, save the file as UTF-8 without normalization.

---

## ❓ FAQ

**Does this work with Chrome / Edge / Brave?**
Not currently. Chrome's MV3 removed blocking `webRequest`. Porting would require rewriting the capture layer using `chrome.debugger` or a content-script-based `fetch` patch — both are less reliable.

**Does it capture HTTPS traffic?**
Yes — the extension runs inside Firefox and observes the decrypted response before it's handed to the page. This is not a MITM proxy; it's the browser's own API.

**Will Netrofit notice?**
No. The extension runs entirely on the client side. No extra requests are made. Netrofit's servers see exactly the same traffic they'd see without the extension.

**Does it work with GraphQL?**
Partially. `guessEntity` infers names from URL paths. If Netrofit uses a single `/graphql` endpoint, every request maps to the entity `graphql` — collapsing all data into one. This is a known limitation. See [Roadmap](#-roadmap).

**What if Netrofit changes their API?**
The extension does not hard-code endpoints. It captures whatever the app fetches. If Netrofit adds or renames endpoints, the extension adapts automatically — the entity name will change but the data will still be captured.

**Is my data sent anywhere?**
No. Zero network calls leave your browser. See [Privacy & Security](#-privacy--security).

**Can I export data for a client on my machine?**
Yes — that's the intended use case. Log in as the client (with their permission), capture, export, log out, hand them the CSVs. The extension itself stores no credentials.

**How large can the export get?**
Limited by `storage.local` quota (~10 MB per extension without `unlimitedStorage`, more with it). We request `unlimitedStorage`. If you hit real limits, migration to IndexedDB is on the roadmap.

---

## 🧑‍💻 Development Workflow

```bash
# Clone
git clone https://github.com/ZiadKhaled999/masar-eye.git
cd masar-eye

# Lint — catches manifest and JS syntax errors
web-ext lint

# Run with live reload
web-ext run

# In another terminal, tail the background console via about:debugging
```

**Editing workflow:**

1. Make a change in `background.js` or `popup/*`.
2. `web-ext run` automatically reloads the extension.
3. Reload the Netrofit tab (the content script injection is not needed — this extension has none).
4. Open the background console and verify.

**Debugging tips:**

- `browser.storage.local.get('capturedData')` in the background console prints the full captured state.
- The Network tab in DevTools shows the raw API shape — this is what `normalize()` is designed against.
- If `guessEntity` returns a weird name, log `details.url` temporarily to see which segment was picked.

---

## 🧩 Extending Masar Eye

### Adding support for a new Netrofit page

If the page's data comes from a new URL pattern, `guessEntity` will handle it automatically. Test by browsing the page and checking the background console for the entity name. If it's wrong (e.g. `courses-42` instead of `courses`), adjust the ID-skipping regex.

### Adding a new CSV format

Modify `toCSV` in `popup/popup.js`. The current implementation is deliberately minimal. If you need typed cells (numbers unquoted, dates formatted), replace the universal-quoting logic with a per-cell type check.

### Supporting another platform

`guessEntity` and the URL filter in `manifest.json` are the only platform-specific pieces. To target another SaaS:

1. Add its host to `permissions` and the listener's `urls` filter.
2. Adjust `guessEntity` if the URL structure differs.
3. Optionally, add a per-platform `normalize()` if its envelope keys differ.

Everything else (capture, dedupe, persist, flatten, export) is platform-agnostic.

---

## 🔒 Privacy & Security

**What the extension reads:**
HTTP responses from `app.netrofit.com` made by your own authenticated session.

**What the extension stores:**
Response bodies in `browser.storage.local`, keyed by inferred entity name. Nothing else. No cookies. No auth tokens. No headers.

**What the extension transmits:**
Nothing. There are no fetch calls to any external server, no analytics, no error reporting. The developer has no visibility into your data.

**Permissions explained:**

| Permission | Why |
|---|---|
| `webRequest` | Observe requests |
| `webRequestBlocking` | Read response bodies synchronously |
| `storage` | Persist captured data locally |
| `downloads` | Save CSV files |
| `unlimitedStorage` | Avoid the 10 MB default quota |
| `*://app.netrofit.com/*` | Scope all of the above to one host |

**Threat model:**
This extension trusts the browser's HTTPS handling. If your traffic to `app.netrofit.com` is intercepted (corporate proxy with a custom CA, malicious extension, etc.), the extension will happily capture whatever the browser decodes. This is inherent to any client-side capture tool and is not a design flaw.

**Auditing:**
Every line of code that runs is in this repository. There is no build step, no bundler, no minified file. Open `background.js` and `popup/popup.js` in your editor and read them — that's the entire extension.

---

## ⚖️ Legal & Ethical Use

Masar Eye is designed for **data portability** — a right recognized under GDPR Article 20 and comparable laws. It only exports data that:

1. You are authorized to access (you're logged in as the account owner or with their permission), **and**
2. Is already being sent to your browser by the platform.

**Do not use this extension to:**

- Access data you don't have permission to view.
- Redistribute another person's data without their consent.
- Bypass authentication or authorization mechanisms.
- Extract data at scale in violation of Netrofit's terms of service.

The extension is a tool. Using it on data you don't own may violate contracts, terms of service, or local law. The authors take no responsibility for misuse.

---

## 🗺 Roadmap

### v1.1 — Better schema inference

- Full `analyzer.js` module: type detection (dates, emails, phones), nullable-field tracking, primary-key inference.
- Entity picker UI: checkboxes per entity, per-entity column selection.
- CSV column ordering controls.

### v1.2 — Pagination and streaming

- Auto-pagination: detect `page`, `offset`, `cursor`, `limit`, `per_page` params and replay requests until exhausted.
- Streaming CSV writer for very large exports (avoid holding the full file in memory).

### v2.0 — Multi-platform

- GraphQL-aware entity inference (parse `query` body or inspect response shape).
- Adapters for other SaaS platforms with a common export pipeline.
- Direct import into Masar with schema mapping.

### Not planned

- MV3 port. Chrome's API cannot support the capture mechanism used here.
- Server-side storage. This is a local-first tool by design.
- Telemetry. Ever.

---

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/my-thing`).
3. Make your change. Run `web-ext lint` — it must pass with 0 errors.
4. Test in Firefox against a real Netrofit session.
5. Open a pull request describing the change and how you tested it.

**Style guide:**

- Plain JavaScript, no framework, no bundler.
- 2-space indentation.
- Prefer `browser.*` promise APIs over callback `chrome.*` APIs.
- No comments that restate the code. Comment the *why*, not the *what*.
- Keep `background.js` under 300 lines. If it grows, split into `lib/`.

**Reporting bugs:**

Include:
- Firefox version
- The background console output (`about:debugging` → Inspect → Console)
- One sample API response (redact personal data)
- Steps to reproduce

---

## 📄 License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.

You are free to use, modify, and distribute this software, including for commercial purposes, provided you preserve the copyright notice and license text.

---

## 🙏 Credits

- Built as part of the **Masar** project.
- Uses Mozilla's `webRequest.filterResponseData()` API — the only clean way to read response bodies from a Firefox extension.
- Thanks to every SaaS vendor who *does* ship a data export button. You make tools like this unnecessary, which is the highest compliment.

---

<p align="center">
  <strong>Your data. Your machine. Your files.</strong><br>
  <sub>Masar Eye — built because lock-in is a choice, not a requirement.</sub>
</p>
