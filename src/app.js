// src/app.js
// Orquestra: recebe imagens, chama provider, formata TXT, permite download.

import { extractFromImage, fileToDataURL, providerStatus } from './ocr.js';
import { formatReport, toTxtName, joinReports } from './formatter.js';

// --- state ---
const items = []; // { id, file, dataUrl, status, result, txt, error }
let uid = 0;

// --- elementos ---
const input = document.getElementById('imageInput');
const dropzone = document.getElementById('dropzone');
const processBtn = document.getElementById('processBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearBtn = document.getElementById('clearBtn');
const filesList = document.getElementById('filesList');
const summary = document.getElementById('summary');
const providerBadge = document.getElementById('providerBadge');
const fabBadge = document.getElementById('fabBadge');
const themeToggle = document.getElementById('themeToggle');

// --- ícones SVG inline reutilizáveis ---
const ICON_DOWNLOAD = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`;
const ICON_COPY = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;
const ICON_REFRESH = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>`;
const ICON_TRASH = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>`;
const ICON_PLAY = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`;
const ICON_SUN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>`;
const ICON_MOON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

// ==========================================================
// PROVIDER badge — só ícone com tooltip
// ==========================================================
(function checkProvider() {
  const s = providerStatus();
  providerBadge.dataset.tooltip = `${s.label} — ${s.detail}`;
  providerBadge.dataset.state = s.ok ? 'ok' : 'err';
})();

// ==========================================================
// THEME toggle
// ==========================================================
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeToggle.innerHTML = (t === 'dark' ? ICON_SUN : ICON_MOON).trim();
  themeToggle.dataset.tooltip = t === 'dark' ? 'Tema claro' : 'Tema escuro';
  try { localStorage.setItem('ultrasson.theme', t); } catch {}
}
function initTheme() {
  let saved = 'dark';
  try { saved = localStorage.getItem('ultrasson.theme') || 'dark'; } catch {}
  applyTheme(saved);
}
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});
initTheme();

// ==========================================================
// DRAG & DROP
// ==========================================================
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
  })
);
dropzone.addEventListener('drop', (e) => {
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) addFiles(files);
});

input.addEventListener('change', ({ target: { files } }) => {
  if (files?.length) addFiles([...files]);
  input.value = '';
});

// ==========================================================
// FILE QUEUE
// ==========================================================
async function addFiles(files) {
  for (const file of files) {
    const id = ++uid;
    const dataUrl = await fileToDataURL(file);
    items.push({
      id, file, dataUrl,
      status: 'pending', result: null, txt: '', error: '',
    });
  }
  render();
}

// ==========================================================
// RENDER
// ==========================================================
function render() {
  filesList.innerHTML = '';
  for (const it of items) filesList.appendChild(renderCard(it));

  const total = items.length;
  const done = items.filter((i) => i.status === 'done').length;
  const err = items.filter((i) => i.status === 'error').length;
  summary.innerHTML =
    total === 0
      ? ''
      : `<span><strong>${total}</strong> arquivo(s)</span>
         <span><strong>${done}</strong> processado(s)</span>
         ${err ? `<span style="color:var(--err)"><strong>${err}</strong> com erro</span>` : ''}`;

  processBtn.disabled =
    total === 0 || items.every((i) => i.status === 'done' || i.status === 'running');
  downloadAllBtn.disabled = done < 1;
  clearBtn.disabled = total === 0;
  fabBadge.textContent = String(done);
}

function renderCard(it) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.dataset.id = it.id;

  const statusClass =
    it.status === 'pending' ? 'pending'
    : it.status === 'running' ? 'running'
    : it.status === 'done' ? 'done'
    : 'error';
  const statusLabel =
    it.status === 'pending' ? 'Pendente'
    : it.status === 'running' ? 'Processando…'
    : it.status === 'done' ? 'Pronto'
    : 'Erro';

  // Botões: todos com 32px de altura. "Processar" tem ícone + texto;
  // demais (download/copy/refresh/trash) são só ícone.
  const actionsHtml = [];
  if (it.status === 'pending' || it.status === 'error') {
    actionsHtml.push(
      `<button class="btn-sm" data-act="run" data-tooltip="Processar">${ICON_PLAY}<span>Processar</span></button>`
    );
  }
  if (it.status === 'done') {
    actionsHtml.push(
      `<button class="icon-btn-sm" data-act="download" data-tooltip="Baixar .txt" aria-label="Baixar">${ICON_DOWNLOAD}</button>`,
      `<button class="icon-btn-sm" data-act="copy"     data-tooltip="Copiar"      aria-label="Copiar">${ICON_COPY}</button>`,
      `<button class="icon-btn-sm" data-act="reprocess"data-tooltip="Reprocessar" aria-label="Reprocessar">${ICON_REFRESH}</button>`
    );
  }
  actionsHtml.push(
    `<button class="icon-btn-sm" data-act="remove" data-tooltip="Remover" aria-label="Remover">${ICON_TRASH}</button>`
  );

  card.innerHTML = `
    <div class="thumb"><img src="${it.dataUrl}" alt="${escape(it.file.name)}"/></div>
    <div class="body">
      <div class="top">
        <h3>${escape(it.file.name)}</h3>
        <span class="status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="meta-line">
        ${(it.file.size / 1024).toFixed(1)} KB · ${it.file.type || 'image'}
      </div>
      ${it.txt ? `<pre>${escape(it.txt)}</pre>` : ''}
      ${it.error ? `<div class="err-msg">${escape(it.error)}</div>` : ''}
      <div class="card-actions">${actionsHtml.join('')}</div>
    </div>
  `;

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'run' || act === 'reprocess') await processOne(it.id);
    else if (act === 'download') downloadTxt(it);
    else if (act === 'copy') copyToClipboard(it.txt);
    else if (act === 'remove') removeItem(it.id);
  });

  return card;
}

// ==========================================================
// PROCESSING
// ==========================================================
async function processOne(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.status = 'running';
  it.error = '';
  render();
  try {
    const result = await extractFromImage(it.dataUrl);
    it.result = result;
    it.txt = formatReport(result, it.file.name);
    it.status = 'done';
  } catch (err) {
    it.error = err.message || String(err);
    it.status = 'error';
    console.error('[ultrasson_reader]', err);
  }
  render();
}

async function processAll() {
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'error');
  // Série pra evitar rate limit. Trocar por Promise.all(...) se quiser paralelo.
  for (const it of pending) await processOne(it.id);
}

// ==========================================================
// AÇÕES
// ==========================================================
processBtn.addEventListener('click', processAll);

// Download geral: SEMPRE um único TXT consolidado
downloadAllBtn.addEventListener('click', () => {
  const done = items.filter((i) => i.status === 'done');
  if (!done.length) return;

  const consolidated = joinReports(
    done.map((it) => ({ name: it.file.name, txt: it.txt }))
  );
  const blob = new Blob([consolidated], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `laudos_ultrassom_${timestamp()}.txt`);
});

clearBtn.addEventListener('click', () => {
  items.length = 0;
  render();
});

// ==========================================================
// UTILS
// ==========================================================
function downloadTxt(it) {
  const blob = new Blob([it.txt], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, toTxtName(it.file.name));
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    flashToast('Copiado!');
  } catch {
    flashToast('Falha ao copiar', true);
  }
}

function flashToast(msg, isErr = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '6.5rem', right: '1.75rem',
    background: isErr ? 'var(--err)' : 'var(--ok)',
    color: '#fff', padding: '0.55rem 1rem', borderRadius: '8px',
    fontWeight: '600', zIndex: 9999, boxShadow: 'var(--shadow)',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function removeItem(id) {
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) items.splice(i, 1);
  render();
}

function escape(str = '') {
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
