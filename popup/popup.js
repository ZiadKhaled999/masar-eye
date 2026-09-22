async function loadData() {
  const result = await browser.storage.local.get('capturedData');
  return result.capturedData || {};
}

function flatten(obj, prefix, out) {
  out = out || {};
  prefix = prefix || '';
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const flat = rows.map(r => flatten(r));
  const cols = [...new Set(flat.flatMap(Object.keys))];
  const escape = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const header = cols.map(escape).join(',') + '\n';
  const body = flat.map(r => cols.map(c => escape(r[c])).join(',')).join('\n');
  return '\uFEFF' + header + body;
}

async function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({ url, filename, saveAs: false });
  URL.revokeObjectURL(url);
}

async function exportAll() {
  const data = await loadData();
  const entities = Object.keys(data);
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  for (const entity of entities) {
    const rows = data[entity].rows;
    const csv = toCSV(rows);
    if (!csv) continue;
    await downloadCSV('netrofit-' + entity + '-' + ts + '.csv', csv);
  }
}

async function resetAll() {
  await browser.runtime.sendMessage({ type: 'RESET' });
  refreshUI();
}

function refreshUI() {
  const status = document.getElementById('status');
  loadData().then((data) => {
    const entities = Object.keys(data);
    let totalRows = 0;
    for (const entity of entities) {
      totalRows += data[entity].rows.length;
    }
    if (entities.length === 0) {
      status.textContent = 'No data captured yet.';
    } else {
      status.textContent = 'Entities: ' + entities.length + ' | Rows: ' + totalRows;
    }
  });
}

document.getElementById('export').addEventListener('click', () => {
  exportAll();
});

document.getElementById('reset').addEventListener('click', () => {
  resetAll();
});

refreshUI();
