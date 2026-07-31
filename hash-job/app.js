/**
 * app.js — HASH JOB
 * Auth idéntica a HASH AI → HASH Cloud.
 * Lógica: CV upload + búsqueda laboral con LLM + auto-apply.
 */

const HASH_CLOUD_URL = 'https://hash-cloud-production.up.railway.app';

// ── Sesión ─────────────────────────────────────────────────────────────────

const TOKEN_KEY    = 'hash_token';
const TOKEN_EXPIRY_KEY = 'hash_token_expiry';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function getToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  if (!token || Date.now() > expiry) { clearToken(); return null; }
  return token;
}

function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Verificación periódica: si el token expiró → logout
setInterval(() => {
  if (!getToken()) { clearToken(); renderLoginScreen(); }
}, 5 * 60 * 1000);

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (!code) return;

  // Limpiar la URL de inmediato — el código no debe quedar en historial
  window.history.replaceState({}, '', window.location.pathname);

  try {
    const res = await fetch(HASH_CLOUD_URL + '/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error('Código inválido o expirado');
    const data = await res.json();
    if (data.token) setToken(data.token);
  } catch (err) {
    console.error('Error en callback de auth:', err);
  }
}

async function fetchIdentity() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(HASH_CLOUD_URL + '/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function loginWithGoogle() {
  window.location.href = HASH_CLOUD_URL + '/auth/login?next=job';
}

function logout() {
  clearToken();
  cvFile      = null;
  cvUploaded  = false;
  jobResults  = [];
  renderLoginScreen();
}

// ── Estado ─────────────────────────────────────────────────────────────────

let cvFile     = null;   // File object del CV
let cvUploaded = false;  // true una vez que el backend confirmó la recepción
let jobResults = [];     // [{company, title, location, mode, compatibility, url?}]
let userIdentity = null;

// ── Red: CV ────────────────────────────────────────────────────────────────

async function apiUploadCV(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(HASH_CLOUD_URL + '/job/cv', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
  });
  if (!res.ok) throw new Error('Error al subir el CV: ' + res.status);
  return await res.json(); // { ok: true, message: '...' }
}

async function apiSearchJobs(query = '') {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/job/search', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Error en la búsqueda: ' + res.status);
  return await res.json(); // [{ company, title, location, mode, compatibility, url }]
}

async function apiApplyJob(job) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/job/apply', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(job),
  });
  if (!res.ok) throw new Error('Error al postular: ' + res.status);
  return await res.json();
}

// ── Render: Login ──────────────────────────────────────────────────────────

function renderLoginScreen() {
  document.getElementById('app').setAttribute('hidden', '');
  const screen = document.getElementById('lock-screen');
  screen.removeAttribute('hidden');
  const box = document.getElementById('lock-box');
  box.innerHTML =
    '<img src="images/logo_hash.png" alt="HASH" class="lock-logo">' +
    '<div class="lock-submit-wrapper"><button id="login-button" class="lock-submit" type="button">Entrar con Google</button></div>';
  document.getElementById('login-button').addEventListener('click', loginWithGoogle);
}

// ── Render: App principal ──────────────────────────────────────────────────

function showScreen(id) {
  ['screen-home', 'screen-settings'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.setAttribute('hidden', '');
  });
  const target = document.getElementById(id);
  if (target) target.removeAttribute('hidden');
}

function openSettings() { showScreen('screen-settings'); }
function closeSettings() { showScreen('screen-home'); }

// ── Render: Cards de trabajo ───────────────────────────────────────────────

function compatibilityClass(score) {
  if (score >= 85) return 'compat--high';
  if (score >= 70) return 'compat--mid';
  return 'compat--low';
}

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  if (!jobResults.length) {
    const empty = document.createElement('p');
    empty.className = 'cards-empty';
    empty.textContent = cvUploaded
      ? 'No se encontraron ofertas. Probá con otro filtro.'
      : 'Subí tu CV para ver ofertas compatibles con tu perfil.';
    grid.appendChild(empty);
    return;
  }

  jobResults.forEach(job => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-left">
        <span class="card-company">${escapeHtml(job.company)}</span>
        <span class="card-title">${escapeHtml(job.title)}</span>
        <div class="card-meta">
          <span>${escapeHtml(job.location)}</span>
          <span>${escapeHtml(job.mode)}</span>
        </div>
      </div>
      <div class="card-right">
        <div class="compatibility-badge ${compatibilityClass(job.compatibility)}">
          <span class="compatibility-score">${job.compatibility}%</span>
          <span class="compatibility-label">compatible</span>
        </div>
        <div class="card-actions">
          <button class="btn-outline" onclick="handleVerDetalles(${JSON.stringify(JSON.stringify(job))})">Ver detalles</button>
          <button class="btn-primary" onclick="handleApply(${JSON.stringify(JSON.stringify(job))})">Postular</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleVerDetalles(jobStr) {
  const job = JSON.parse(jobStr);
  // TODO: abrir modal de detalle cuando el backend esté listo
  // Por ahora abre la URL si está disponible
  if (job.url) {
    window.open(job.url, '_blank', 'noopener');
  } else {
    alert(`${job.title} — ${job.company}\n${job.location} · ${job.mode}\n\nCompatibilidad: ${job.compatibility}%`);
  }
}

async function handleApply(jobStr) {
  const job = JSON.parse(jobStr);
  const token = getToken();
  if (!token) { renderLoginScreen(); return; }
  if (!cvUploaded) {
    setStatus('Primero subí tu CV para poder postular.', 'error');
    return;
  }
  try {
    setStatus('Enviando postulación...', 'loading');
    await apiApplyJob(job);
    setStatus(`Postulación enviada a ${job.company}.`, 'success');
  } catch (err) {
    setStatus('No se pudo enviar la postulación. Intentá de nuevo.', 'error');
    console.error(err);
  }
}

// ── Render: Status bar ─────────────────────────────────────────────────────

let statusTimer = null;

function setStatus(msg, type = 'info') {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  bar.textContent = msg;
  bar.className = 'status-bar status-bar--' + type;
  bar.removeAttribute('hidden');
  clearTimeout(statusTimer);
  if (type === 'success' || type === 'error') {
    statusTimer = setTimeout(() => {
      bar.setAttribute('hidden', '');
    }, 4000);
  }
}

// ── CV: Upload ─────────────────────────────────────────────────────────────

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  if (file.type !== 'application/pdf') {
    setStatus('Solo se aceptan archivos PDF.', 'error');
    return;
  }
  cvFile = file;
  const nameEl = document.getElementById('fileSelectedName');
  const chip   = document.getElementById('fileSelected');
  if (nameEl) nameEl.textContent = file.name;
  if (chip)   chip.classList.remove('hidden');
}

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
});

async function handleCVUpload() {
  if (!cvFile) {
    setStatus('Seleccioná un archivo PDF primero.', 'error');
    return;
  }
  const token = getToken();
  if (!token) { renderLoginScreen(); return; }

  setStatus('Subiendo CV...', 'loading');
  try {
    await apiUploadCV(cvFile);
    cvUploaded = true;
    setStatus('CV procesado. Buscando ofertas...', 'success');
    // Cerrar popup de onboarding y arrancar búsqueda
    finishOnboarding();
    await handleSearch();
  } catch (err) {
    setStatus('No se pudo procesar el CV. Intentá de nuevo.', 'error');
    console.error(err);
  }
}

// ── Búsqueda ───────────────────────────────────────────────────────────────

async function handleSearch(query = '') {
  if (!cvUploaded) {
    setStatus('Primero subí tu CV.', 'error');
    return;
  }
  setStatus('Buscando ofertas compatibles...', 'loading');
  try {
    jobResults = await apiSearchJobs(query);
    renderCards();
    setStatus(jobResults.length
      ? `${jobResults.length} oferta${jobResults.length !== 1 ? 's' : ''} encontrada${jobResults.length !== 1 ? 's' : ''}.`
      : 'Sin resultados para este filtro.',
      'success');
  } catch (err) {
    setStatus('No se pudo realizar la búsqueda. Intentá de nuevo.', 'error');
    console.error(err);
    // Mientras el backend no está listo, mostrar mocks
    loadMockJobs();
  }
}

// ── Mock (mientras el backend de /job no esté listo) ──────────────────────

function loadMockJobs() {
  jobResults = [
    { company: 'Mercado Libre', title: 'Frontend Developer Sr.',      location: 'Buenos Aires', mode: 'Remoto',     compatibility: 94 },
    { company: 'Globant',       title: 'React Engineer',              location: 'Córdoba',      mode: 'Híbrido',    compatibility: 88 },
    { company: 'Naranja X',     title: 'UI Developer',                location: 'Buenos Aires', mode: 'Remoto',     compatibility: 82 },
    { company: 'Auth0',         title: 'Software Engineer Frontend',  location: 'Buenos Aires', mode: 'Remoto',     compatibility: 79 },
    { company: 'Rappi',         title: 'Web Developer',               location: 'Buenos Aires', mode: 'Presencial', compatibility: 71 },
    { company: 'Ualá',          title: 'Frontend Engineer',           location: 'Buenos Aires', mode: 'Híbrido',    compatibility: 68 },
  ];
  renderCards();
}

// ── Popups / Onboarding ────────────────────────────────────────────────────

function goToPopup(id) {
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
}

function openPopup(id) {
  document.getElementById('overlay').classList.add('active');
  goToPopup(id);
}

function closePopup(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('overlay').classList.remove('active');
}

function openEmailJSPopup() {
  const onboarding = ['popup-welcome', 'popup-how', 'popup-cv'];
  const isOnboarding = onboarding.some(p => !document.getElementById(p).classList.contains('hidden'));
  if (isOnboarding) return;
  openPopup('popup-emailjs');
}

function openDeleteAccountPopup() {
  openPopup('popup-delete-account');
}

function finishOnboarding() {
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('app').classList.remove('blurred');
  renderCards();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Auth: check & boot ─────────────────────────────────────────────────────

async function checkAuth() {
  await handleAuthCallback();
  userIdentity = await fetchIdentity();
  if (!userIdentity) {
    clearToken();
    renderLoginScreen();
    return;
  }
  document.getElementById('lock-screen').setAttribute('hidden', '');
  document.getElementById('app').removeAttribute('hidden');
  initApp();
}

function initApp() {
  // Mostrar pantalla home
  showScreen('screen-home');

  // Mostrar onboarding si no hay CV todavía
  document.getElementById('overlay').classList.add('active');
  goToPopup('popup-welcome');
  document.getElementById('app').classList.add('blurred');

  // Búsqueda en tiempo real (si ya tenía CV en sesión anterior)
  // TODO: llamar GET /job/cv/status para saber si el usuario ya tiene CV en el backend
  // Por ahora siempre arranca desde el onboarding
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
