let capturedData = {};
let saveTimer = null;

function deserializeCapturedData(raw) {
  const out = {};
  for (const entity of Object.keys(raw)) {
    const rows = raw[entity];
    out[entity] = {
      rows: rows.rows,
      seen: new Set(rows.seen || [])
    };
  }
  return out;
}

function serializeCapturedData(data) {
  const out = {};
  for (const entity of Object.keys(data)) {
    out[entity] = {
      rows: data[entity].rows,
      seen: Array.from(data[entity].seen)
    };
  }
  return out;
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    browser.storage.local.set({ capturedData: serializeCapturedData(capturedData) });
  }, 250);
}

function guessEntity(url) {
  const u = new URL(url);
  const segments = u.pathname.split('/').filter(Boolean);
  const picked = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (!seg) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) continue;
    if (/^[0-9]+$/.test(seg)) continue;
    picked.push(seg);
    if (picked.length >= 2) break;
  }
  return picked.reverse().join('-') || 'unknown';
}

function normalize(res) {
  if (!res || typeof res !== 'object') return [res];
  if (Array.isArray(res)) return res;
  const envelopeKeys = ['data', 'items', 'results', 'rows', 'list', 'records'];
  for (const key of envelopeKeys) {
    if (res[key] && Array.isArray(res[key])) return res[key];
  }
  return [res];
}

function ingest(entity, json) {
  if (!capturedData[entity]) {
    capturedData[entity] = { rows: [], seen: new Set() };
  }
  const bucket = capturedData[entity];
  const entries = normalize(json);
  const idKeys = ['id', '_id', 'uuid'];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = idKeys.map(k => entry[k]).find(v => v !== undefined);
    const key = id !== undefined ? String(id) : JSON.stringify(entry);
    if (bucket.seen.has(key)) continue;
    bucket.seen.add(key);
    bucket.rows.push(entry);
  }
  console.log('Captured data for:', entity, 'rows:', bucket.rows.length);
  persist();
}

function mergeBuffers(buffers) {
  let totalLength = 0;
  for (const b of buffers) totalLength += b.byteLength;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    merged.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return merged.buffer;
}

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.type !== 'xmlhttprequest') return {};
    if (details.method === 'OPTIONS') return {};
    if (!details.url.startsWith('https://app.netrofit.com/')) return {};
    try {
      const filter = browser.webRequest.filterResponseData(details.requestId);
      const decoder = new TextDecoder();
      const chunks = [];
      filter.ondata = (event) => chunks.push(event.data);
      filter.onerror = (event) => filter.disconnect();
      filter.onstop = () => {
        try {
          const body = decoder.decode(mergeBuffers(chunks));
          const trimmed = body.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const json = JSON.parse(trimmed);
            const entity = guessEntity(details.url);
            ingest(entity, json);
          }
        } catch (e) {
          console.error('Failed to parse response', e);
        } finally {
          filter.disconnect();
        }
      };
    } catch (e) {
      console.error('filterResponseData failed', e);
    }
    return {};
  },
  { urls: ['*://app.netrofit.com/*'] },
  ['blocking']
);

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'GET_ENTITY_LIST') {
    return Object.keys(capturedData);
  }
  if (msg.type === 'GET_ENTITY') {
    const bucket = capturedData[msg.entity];
    return bucket ? bucket.rows : [];
  }
  if (msg.type === 'RESET') {
    capturedData = {};
    browser.storage.local.remove('capturedData');
    return { ok: true };
  }
  return;
});

browser.storage.local.get('capturedData').then((result) => {
  if (result.capturedData) {
    capturedData = deserializeCapturedData(result.capturedData);
  }
});
