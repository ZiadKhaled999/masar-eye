masar-eye

Extract your data from third-party platforms — cleanly, locally, and on your terms.

https://img.shields.io/badge/license-Apache%202.0-blue.svg

https://img.shields.io/badge/Firefox-Manifest%20V2-orange.svg

https://img.shields.io/badge/status-active-brightgreen.svg

---

📖 Table of Contents

· What is Masar Eye?
· Why Does It Exist?
· How It Works
· Repository Structure
· Prerequisites
· Installation
· Usage Guide
· Deep Dive: How the Capture Engine Works
· Deep Dive: How the Export Works
· Data Flow Diagram
· Configuration Reference
· Troubleshooting
· FAQ
· Development Workflow
· Extending Masar Eye
· Privacy & Security
· Legal & Ethical Use
· Roadmap
· Contributing
· License

---

🎯 What is Masar Eye?

Masar Eye is a collection of browser extension tools designed to help users extract their own data from SaaS platforms they already have accounts on — and turn it into portable, human-readable formats like CSV.

The first and current module is netrofit-exporter, a Firefox extension that captures API responses from app.netrofit.com and exports them as CSV files, ready for import into spreadsheets, databases, or Masar's own platform.

The name "Masar Eye" reflects its purpose: an eye into your own data, watching what an app sends back to you and pulling it out for you to keep.

---

💡 Why Does It Exist?

Modern SaaS platforms lock your data in. You can see it, use it, but exporting it in a clean format is either:

· Not offered (no export button at all)
· Incomplete (only partial data, or in a format you can't reuse)
· Paywalled (a "Pro" feature)
· Awkward (a printed PDF instead of structured data)

For migration, backup, reporting, or switching vendors, users need their data back in a usable format. Masar Eye provides that — locally, transparently, and without asking the platform for permission.

Instead of scraping the DOM (fragile) or reverse-engineering the API blindly (fragile and slow), Masar Eye listens to the API calls your browser is already making and captures the JSON responses.

---

⚙️ How It Works

At a high level:

1. You install the extension in Firefox.
2. You log into the target platform (app.netrofit.com) as normal.
3. As you browse, the extension silently intercepts every XHR/fetch response the platform makes.
4. JSON responses are parsed, deduplicated, and stored locally in browser.storage.local.
5. When you click "Export", each detected entity type is converted to a CSV file and downloaded.
6. You get CSVs with all the data you browsed — flattened, deduplicated, ready to use.

Nothing is sent anywhere. No analytics, no backend, no telemetry. Everything stays on your machine.

---

🗂 Repository Structure

```
masar-eye/
├── .kilo/                          # Planning files (dev-time only, not shipped)
│   └── plans/
├── netrofit-exporter/              # The Firefox extension (this is what ships)
│   ├── manifest.json               # Extension manifest (MV2)
│   ├── background.js               # Capture engine + persistence
│   ├── popup/
│   │   ├── popup.html              # Extension popup UI
│   │   ├── popup.css               # Popup styling
│   │   └── popup.js                # Export logic + CSV builder
│   └── icons/
│       └── icon.svg                # Extension icon
├── LICENSE                         # Apache 2.0
└── README.md                       # You are here
```

Important: Only netrofit-exporter/ is the actual extension. The .kilo/ folder contains development plans and is not shipped or loaded by Firefox.

---

✅ Prerequisites

To run or modify Masar Eye, you need:

Tool Version Why
Firefox 91+ The extension targets Firefox only (Manifest V2)
Node.js 22+ Required by Mozilla's web-ext tool
web-ext Latest Official Mozilla tool for building, running, linting extensions
Git Any To clone the repo

Install web-ext globally:

```bash
npm install --global web-ext
```

Verify:

```bash
web-ext --version
```

---

🚀 Installation

Option 1 — Load temporarily (for development)

1. Clone the repo:
   ```bash
   git clone https://github.com/ZiadKhaled999/masar-eye.git
   cd masar-eye
   ```
2. Launch Firefox with the extension loaded:
   ```bash
   cd netrofit-exporter
   web-ext run
   ```
   This opens a fresh Firefox instance with the extension installed. Source changes reload automatically.

Option 2 — Load manually in your own Firefox

1. Open Firefox → about:debugging#/runtime/this-firefox
2. Click "Load Temporary Add-on…"
3. Navigate to masar-eye/netrofit-exporter/
4. Select manifest.json

The extension is now loaded. It will unload when you close Firefox (this is normal for temporary add-ons).

Option 3 — Install from a packaged .zip (permanent, unsigned)

1. Build the extension:
   ```bash
   cd netrofit-exporter
   web-ext build
   ```
   This creates web-ext-artifacts/netrofit_exporter-X.Y.Z.zip.
2. Set Firefox to allow unsigned extensions (for testing only):
   · Go to about:config
   · Set xpinstall.signatures.required to false
3. Install:
   · Go to about:addons
   · Click the gear icon → "Install Add-on From File…"
   · Select the .zip from web-ext-artifacts/

---

📘 Usage Guide

Step 1 — Load the extension

Use any of the three installation methods above. Confirm it's loaded at about:debugging — you should see "Netrofit Exporter" listed.

Step 2 — Open the target platform

Navigate to https://app.netrofit.com and log in as you normally would.

The extension only runs on app.netrofit.com. It has no access to any other site. You can verify this in manifest.json under permissions.

Step 3 — Browse the app

Browse every page whose data you want to export:

· Students list
· Courses list
· Groups / classes
· Attendance sessions
· Payments / subscriptions
· Assessments and grades
· Reports

Scroll through paginated lists — each page you view is captured.

Why do I have to browse manually? The extension captures data passively. It only sees what your browser fetches. Data you never open is data it never sees. See Roadmap for auto-pagination.

Step 4 — Verify capture

Open the background console to confirm data is being captured:

1. Go to about:debugging#/runtime/this-firefox
2. Find "Netrofit Exporter"
3. Click "Inspect"
4. In the Console tab, you should see logs like:
   ```
   Captured data for: students rows: 47
   Captured data for: courses rows: 12
   ```

If you see these, capture is working.

Step 5 — Export

1. Click the extension icon in the Firefox toolbar.
2. The popup shows:
   · Total API calls captured
   · Number of entities detected
   · A list of entities with row counts
3. Click "Export All" to download one CSV per entity.
4. Files land in your Downloads folder as:
   ```
   netrofit-students-2026-09-22T14-30-00.csv
   netrofit-courses-2026-09-22T14-30-00.csv
   netrofit-groups-2026-09-22T14-30-00.csv
   ```

Step 6 — Open in Excel / Sheets

CSVs are prefixed with a UTF-8 BOM (\uFEFF), so Arabic text renders correctly in Excel without manual encoding selection. Double-click any file to open.

Step 7 — Reset (optional)

To clear all captured data and start over:

1. Click the extension icon
2. Click "Reset"
3. Confirm

This clears browser.storage.local and the popup will show "0 entities."

---

🔬 Deep Dive: How the Capture Engine Works

The capture engine lives in background.js and uses Firefox's webRequest API with the filterResponseData method.

Why filterResponseData?

Most browser extension tutorials tell you to monkey-patch window.fetch and XMLHttpRequest from a content script. That approach is fragile:

· It breaks when the site reassigns fetch
· It runs in an isolated world (or requires world: "MAIN" gymnastics)
· It races with the page's own scripts

Firefox's filterResponseData is browser-level. It intercepts responses before they reach the page, works on every XHR automatically, and can't be defeated by the site's JavaScript.

The interception flow

```js
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // 1. Skip preflight requests
    if (details.method === 'OPTIONS') return {};

    // 2. Skip non-XHR (HTML, CSS, images, etc.)
    if (details.type !== 'xmlhttprequest') return {};

    // 3. Attach a stream filter to read the body
    const filter = browser.webRequest.filterResponseData(details.requestId);
    const chunks = [];

    filter.ondata = (event) => {
      chunks.push(event.data);
      filter.write(event.data);   // pass through untouched
    };

    filter.onstop = () => {
      // 4. Concatenate, decode, and attempt JSON parse
      const body = decoder.decode(mergeBuffers(chunks));

      // 5. Cheap JSON guard before parsing
      if (!(body.trimStart().startsWith('{') ||
            body.trimStart().startsWith('['))) return;

      const json = JSON.parse(body);
      const entity = guessEntity(details.url);
      if (entity) ingest(entity, json);
    };

    filter.onerror = () => { try { filter.close(); } catch {} };
    return {};
  },
  { urls: ['*://app.netrofit.com/*'] },
  ['blocking']
);
```

Key details:

· filter.write(event.data) is mandatory — the response must be passed through untouched, or the page breaks.
· filter.close() in a finally block is mandatory — otherwise filters leak and Firefox stops intercepting after a while.
· The startsWith('{') || startsWith('[') guard skips HTML fragments, error pages, and non-JSON XHRs without wasting CPU on JSON.parse.

Entity inference (guessEntity)

When a response arrives, the engine needs to know what kind of data it is. It guesses from the URL:

URL Inferred entity
/api/students students
/api/students?page=2 students
/api/students/abc-123 students
/api/students/abc-123/grades grades
/api/courses courses

It walks the URL path backwards, skipping ID-like segments (UUIDs, numeric IDs) until it finds a meaningful name. If it finds two meaningful segments, it joins them with - (e.g. students-grades).

Normalization (normalize)

APIs commonly wrap lists in envelopes. The engine unwraps the most common ones:

```js
function normalize(res) {
  if (Array.isArray(res)) return res;
  for (const k of ['data', 'items', 'results', 'rows', 'list', 'records']) {
    if (Array.isArray(res?.[k])) return res[k];
  }
  return res && typeof res === 'object' ? [res] : [];
}
```

So { data: [...] }, { items: [...] }, { results: [...] } all produce the same array.

Deduplication (ingest)

Browsing back and forth often triggers the same request multiple times. The engine deduplicates by primary key:

```js
const id = row?.id ?? row?._id ?? row?.uuid;
if (id != null && capturedData[entity].seen.has(id)) continue;
if (id != null) capturedData[entity].seen.add(id);
capturedData[entity].rows.push(row);
```

seen is a Set — O(1) dedupe.

Persistence

capturedData is written to browser.storage.local debounced at 250ms after each ingest. This means:

· Crash-proof: reloading Firefox doesn't lose your data.
· Race-condition-safe: the webRequest listener is only registered after hydration completes.

Set objects don't serialize to JSON, so seen is converted to an array on save and back to a Set on load.

---

📤 Deep Dive: How the Export Works

The export logic lives in popup/popup.js.

Reading captured data

The popup reads directly from browser.storage.local:

```js
const { capturedData } = await browser.storage.local.get('capturedData');
```

Why not message the background script? Because the background script can be suspended by Firefox at any time (MV2 background pages aren't truly persistent). Reading from storage is the source of truth and works even when the background is asleep.

Flattening nested JSON

Real API data is nested:

```json
{
  "id": 42,
  "name": "Ahmed",
  "course": { "id": 7, "name": "Math" },
  "tags": ["honor", "advanced"]
}
```

A CSV needs flat columns. The flatten function converts nested objects to dot-notation keys:

id name course.id course.name tags
42 Ahmed 7 Math ["honor","advanced"]

Arrays are JSON-stringified into a single cell rather than exploded into multiple rows — this keeps the row count and primary key stable.

Union of columns

Different rows may have different fields (optional data, partial responses). Instead of using only the first row's keys, the exporter computes the union of all keys across all rows:

```js
const cols = [...new Set(flat.flatMap(Object.keys))];
```

Missing values become empty cells.

CSV escaping

Every value is wrapped in double quotes, and internal quotes are escaped by doubling (" → ""). This handles:

· Commas inside values
· Newlines inside values
· Quote characters inside values

Example:

```
"id","name","parent.name"
"1","Ahmed, Sr.","Ali"
"2","Sara ""S""","Mona"
```

UTF-8 BOM

The final string is prefixed with \uFEFF:

```js
return '\uFEFF' + header + body;
```

Why? Excel on Windows defaults to ANSI encoding when opening CSVs. Without the BOM, Arabic text like أحمد appears as Ø£ØÙ…Ø¯. With the BOM, Excel detects UTF-8 automatically.

Download

Each entity triggers a separate download via browser.downloads.download:

```js
browser.downloads.download({
  url: URL.createObjectURL(blob),
  filename: `netrofit-${entity}-${timestamp}.csv`,
  saveAs: false
});
```

saveAs: false means files land silently in Downloads without a "Save As" dialog for each one.

---

🔄 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    app.netrofit.com                          │
│                                                              │
│   User browses → Angular app fires XHR → Server responds    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ XHR response (JSON)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Firefox webRequest API                          │
│                                                              │
│   filterResponseData(requestId) → StreamFilter               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ chunks (ArrayBuffer)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              background.js (capture engine)                  │
│                                                              │
│   1. Merge chunks → ArrayBuffer                              │
│   2. TextDecoder → String                                    │
│   3. JSON.parse (with guard)                                 │
│   4. guessEntity(url) → "students"                           │
│   5. normalize(json) → [row, row, ...]                       │
│   6. ingest() → dedupe by id, append to capturedData         │
│   7. persist() → debounced write to storage.local            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ capturedData
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              browser.storage.local                           │
│                                                              │
│   {                                                          │
│     "students": { rows: [...], seen: Set },                  │
│     "courses":  { rows: [...], seen: Set },                  │
│     ...                                                      │
│   }                                                          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ on popup open
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              popup/popup.js (exporter)                       │
│                                                              │
│   1. Read capturedData from storage.local                    │
│   2. For each entity:                                        │
│      a. flatten(rows) → flat rows                            │
│      b. union of all keys → columns                          │
│      c. escape + join → CSV string                           │
│      d. prepend BOM                                          │
│      e. download as netrofit-<entity>-<timestamp>.csv        │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
                    📁 Downloads
```

---

🔧 Configuration Reference

manifest.json

Key Value Why
manifest_version 2 MV2 is required for webRequestBlocking
permissions webRequest, webRequestBlocking, storage, downloads, unlimitedStorage, *://app.netrofit.com/* Host pattern must be in permissions for MV2
background.persistent true Prevents background suspension mid-capture
browser_specific_settings.gecko.strict_min_version 91.0 Minimum Firefox version that supports filterResponseData
data_collection_permissions.required ["none"] Declares no data leaves the user's machine

Tunable constants in background.js

Constant Default Effect
SAVE_DEBOUNCE_MS 250 How long to wait after last ingest before persisting
(implicit) — guessEntity skips segments matching /^[0-9a-f]{8}-...$/i (full UUIDs)
(implicit) — normalize unwraps data, items, results, rows, list, records

To adapt for a different platform, change the URL filter in manifest.json and the guessEntity logic in background.js.

---

🐛 Troubleshooting

"Extension didn't capture anything"

1. Check the URL filter. The extension only runs on app.netrofit.com. If you're on a different domain (staging, subdomain), it won't fire.
2. Check the background console. Open about:debugging → Inspect → Console. If you see nothing, the listener may not be firing.
3. Check request type. Only details.type === 'xmlhttprequest' is captured. If the platform uses WebSockets or sendBeacon, those are not intercepted (see Roadmap).
4. Check the JSON guard. If responses start with something other than { or [, they're skipped. Look for logs like Raw response: ... in the console.

"storage.local is empty"

1. Check for the hydration race. The listener must be registered after storage.local.get resolves. If a request arrives before hydration, capturedData gets overwritten.
2. Check permissions. storage must be listed in manifest.json permissions.

"CSV opens with garbled Arabic"

The BOM is missing. Ensure popup.js returns '\uFEFF' + header + body, not just header + body.

"CSV columns are [object Object]"

Nested objects weren't flattened. Ensure flatten() runs on every row before column extraction.

"web-ext lint complains about the icon"

Firefox requires square icons. Use SVG (icons/icon.svg) — it's square by definition and scales to any size.

"Background script could not be found"

manifest.json must sit in the same folder as background.js. Firefox resolves all paths relative to the manifest's own directory — it does not search subfolders.

"Package file must be a ZIP of the extension's files themselves"

When packaging, zip the contents of netrofit-exporter/, not the folder itself. manifest.json must be at the ZIP root.

"Icon must be square"

Regenerate the icon as a square (e.g. 48×48 or 96×96), or switch to SVG (recommended).

"data_collection_permissions property is missing"

Firefox requires this key for all new extensions since November 3, 2025. Add:

```json
"browser_specific_settings": {
  "gecko": {
    "data_collection_permissions": { "required": ["none"] }
  }
}
```

---

❓ FAQ

Q: Does this extension send my data anywhere?
No. Everything stays in browser.storage.local on your machine. There is no backend, no telemetry, no analytics.

Q: Can the extension see my password?
No. It only reads responses to XHR requests — not request bodies, not login forms. Passwords sent in a login POST are never read by the extension.

Q: What if the platform updates their API?
The extension will still capture what it can. If entity names change, they'll appear as new entity types in the popup. If the platform switches to GraphQL, guessEntity will return graphql for everything — see Roadmap.

Q: Can I use this on other platforms?
Not as-is. The URL filter is hard-coded to app.netrofit.com. To support another platform, add its URL pattern to manifest.json permissions and the listener filter.

Q: Does it work on Chrome?
No. Chrome's Manifest V3 removed webRequestBlocking, which this extension depends on. Firefox's MV2 is the only viable target for this architecture.

Q: Why Firefox specifically?
Because Firefox still supports webRequestBlocking + filterResponseData, which lets the extension read response bodies at the browser level without patching the page's JavaScript. This is dramatically more robust than DOM scraping or fetch monkey-patching.

Q: How much data can it hold?
browser.storage.local has a 5 MB default quota, but the extension declares unlimitedStorage, so Firefox will grant more as needed. If you're capturing millions of rows, see Roadmap for IndexedDB migration.

Q: Can I schedule exports automatically?
Not in v1. The popup is manual. Auto-export is on the roadmap.

Q: Will this break the target platform?
No. The extension only reads responses as they pass by. It never modifies requests or responses and never sends anything back.

Q: What about terms of service?
You are extracting your own data from your own account. Most jurisdictions consider this a data portability right (see GDPR Article 20). Check your local laws and the platform's ToS. See Legal & Ethical Use.

---

🛠 Development Workflow

Live-reloading development

```bash
cd netrofit-exporter
web-ext run
```

This launches Firefox with the extension loaded. Changes to background.js, popup/*, or manifest.json auto-reload the extension. No manual reloading.

Linting

```bash
cd netrofit-exporter
web-ext lint
```

Runs Firefox's static analyzer. Expect:

```
Validation Summary:
  errors: 0
  notices: 0
  warnings: 0
```

Building a package

```bash
cd netrofit-exporter
web-ext build
```

Output: web-ext-artifacts/netrofit_exporter-1.0.0.zip

Important: The ZIP must have manifest.json at its root. If you see the error "No manifest.json was found at the root of the extension", you zipped the containing folder instead of its contents.

Debugging

1. Background script: about:debugging → Inspect → Console
2. Popup: Right-click the extension icon → Inspect
3. Storage: about:debugging → Inspect → Storage → Extension Storage → capturedData
4. Network: DevTools → Network → filter by XHR → look for app.netrofit.com

Testing checklist

Before submitting a change:

☐ web-ext lint returns 0 errors
☐ Extension loads without errors in about:debugging
☐ Browsing app.netrofit.com logs at least one Captured data for: message
☐ storage.local contains capturedData with at least one entity
☐ Export downloads one CSV per entity
☐ CSV opens correctly in Excel with Arabic text intact
☐ Reset button clears storage.local
☐ No console errors during 10 minutes of use

---

🧩 Extending Masar Eye

Adding support for a new platform

1. Add the host pattern to manifest.json permissions and the webRequest filter:
   ```json
   "*://*.example.com/*"
   ```
2. Adjust guessEntity in background.js if the URL structure differs. You may need to look at request bodies or response shapes for GraphQL APIs.
3. Add the platform to the popup if you want separate export buttons per platform.

Adding a new entity type

Nothing needed — guessEntity picks up new URL segments automatically. If a new endpoint appears (/api/invoices), it becomes a new entity and exports as netrofit-invoices-*.csv.

Adding a custom export format

Modify popup/popup.js:

1. Replace toCSV with toJSON, toXLSX, etc.
2. Change the mime type in the Blob.
3. Change the file extension in browser.downloads.download.

---

🔒 Privacy & Security

Masar Eye is designed with privacy as a hard constraint:

Guarantee How it's enforced
No data leaves your machine No network requests in the extension code; no fetch calls anywhere
No telemetry No analytics SDKs, no error reporting services
Host-restricted Only runs on app.netrofit.com (see permissions in manifest)
No password capture Only response bodies are read, never request bodies
Open source Full source available; reviewers and users can audit it
Reproducible builds No minification, no bundling, no build step — source = shipped code

What the extension can see: Every XHR response from app.netrofit.com in your authenticated session. This includes student names, phone numbers, payment amounts, and grades — i.e. the same data you see on screen.

What the extension cannot see: Requests to any other domain, your Firefox password store, your cookies, or request payloads (including passwords).

Where data lives: In browser.storage.local, an isolated per-extension store on your machine. Uninstalling the extension removes it.

---

⚖️ Legal & Ethical Use

Masar Eye is designed for data portability — the right of users to access and export their own data from services they use.

✅ Intended uses

· A school owner exporting their own Netrofit center data for backup or migration.
· An admin pulling reports into their own BI tool.
· A client of Masar moving their data from a competitor's platform into Masar's.

❌ Unacceptable uses

· Extracting data from accounts you do not own or administer.
· Reselling extracted data.
· Circumventing access controls, rate limits, or paywalls.
· Scraping competitor platforms for competitive intelligence.

⚠️ Responsibilities

· You must have permission to access the data you extract.
· You must comply with the target platform's ToS — many platforms allow self-service export; some don't.
· You must comply with local privacy laws — GDPR (Article 20 grants data portability), CCPA, and similar regulations often protect this use case, but you are responsible for verifying.
· You must protect extracted data — CSVs contain PII. Store them securely.

Masar Eye's maintainers do not condone or support unauthorized data extraction.

---

🗺 Roadmap

v1.1 — Polish

☐ Auto-pagination — detect page/offset/cursor params and fetch all pages automatically
☐ Entity picker UI — checkboxes to export only selected entities
☐ Column picker UI — choose which columns to include in each CSV
☐ Auto-export on schedule — background alarm triggers periodic exports

v1.2 — Robustness

☐ GraphQL support — infer entity from response shape when the endpoint is /graphql
☐ WebSocket capture — intercept WS frames for live-updating platforms
☐ IndexedDB migration — move from storage.local to IndexedDB for large datasets
☐ Better guessEntity — regex config per platform

v1.3 — Multi-platform

☐ Platform config file — declare URL patterns, entity hints, and pagination rules per platform
☐ Support for Masar itself — export from Masar's own platform as CSV
☐ Additional targets — configurable for any XHR-based SaaS

v2.0 — Beyond Firefox

☐ Chrome support — requires MV3 migration + declarativeNetRequest (limitations to investigate)
☐ Standalone CLI — Playwright/Puppeteer-driven exporter for servers

---

🤝 Contributing

Contributions are welcome. Before opening a PR:

1. Fork and branch from main.
2. Follow the existing style — plain JS, no frameworks, no build step.
3. Run web-ext lint — 0 errors, 0 warnings.
4. Test manually — load into Firefox, browse a real platform, confirm capture + export.
5. Update this README if you change behavior, add permissions, or shift the architecture.

Commit conventions

· feat: — new feature
· fix: — bug fix
· docs: — documentation only
· refactor: — code change that neither fixes a bug nor adds a feature
· chore: — build, tooling, dependencies

Reporting issues

When filing a bug, include:

· Firefox version (about:support)
· Steps to reproduce
· Expected vs. actual behavior
· Background console output (about:debugging → Inspect → Console)
· A snippet from storage.local (redact PII)

Security disclosures

If you find a security issue (e.g. an unintended data leak), do not open a public issue. Contact the maintainers privately first.

---

📄 License

Apache License 2.0 — see LICENSE for the full text.

You are free to use, modify, and distribute this software, including commercially, provided you preserve the license and attribution. The license also provides an express grant of patent rights from contributors.

---

🙏 Credits

· Mozilla — for keeping webRequestBlocking and filterResponseData alive in Firefox.
· web-ext — for making extension development painless.
· The data portability movement — for the legal and ethical foundation this tool rests on.

---

Built with care by Ziad Khaled and contributors.

Extract your data. Own your data. Take it with you.
