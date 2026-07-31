/**
 * app.js — HASH JOB
 */

const HASH_CLOUD_URL = 'https://hash-cloud-production.up.railway.app';

// ── Sesión ─────────────────────────────────────────────────────────────────

const TOKEN_KEY        = 'hash_token';
const TOKEN_EXPIRY_KEY = 'hash_token_expiry';
const TOKEN_TTL_MS     = 7 * 24 * 60 * 60 * 1000;

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

setInterval(() => { if (!getToken()) { clearToken(); renderLoginScreen(); } }, 5 * 60 * 1000);

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (!code) return;
  window.history.replaceState({}, '', window.location.pathname);
  try {
    const res  = await fetch(HASH_CLOUD_URL + '/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error('Código inválido');
    const data = await res.json();
    if (data.token) setToken(data.token);
  } catch (err) { console.error('Auth callback error:', err); }
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
  cvFile = null; cvUploaded = false; jobResults = [];
  renderLoginScreen();
}

// ── Estado ─────────────────────────────────────────────────────────────────

let cvFile     = null;
let cvUploaded = false;
let jobResults = [];

// ── Helpers show/hide ──────────────────────────────────────────────────────

function show(id) { const el = document.getElementById(id); if (el) el.removeAttribute('hidden'); }
function hide(id) { const el = document.getElementById(id); if (el) el.setAttribute('hidden', ''); }

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

// ── Pantallas ──────────────────────────────────────────────────────────────

function showScreen(id) {
  ['screen-home', 'screen-settings'].forEach(hide);
  show(id);
}

function openSettings() {
  document.getElementById('home').classList.add('hidden');
  document.getElementById('settings').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings').classList.add('hidden');
  document.getElementById('home').classList.remove('hidden');
}

function handleDonate() {
  alert('Redirigiendo a página de donación...');
}

// ── Popups ─────────────────────────────────────────────────────────────────

function goToPopup(id) {
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
  const t = document.getElementById(id);
  if (t) t.classList.remove('hidden');
}

function openPopup(id) {
  document.getElementById('overlay').classList.add('active');
  goToPopup(id);
}

function closePopup(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('overlay').classList.remove('active');
}

function openEmailJSPopup()    { openPopup('popup-emailjs'); }
function openDeleteAccountPopup() { openPopup('popup-delete-account'); }

function saveEmailJSConfig() {
  // TODO: guardar en backend
  closePopup('popup-emailjs');
  setStatus('Configuración guardada.', 'success');
}

function handleDeleteAccount() {
  // TODO: llamar DELETE /auth/account
  closePopup('popup-delete-account');
  logout();
}

function finishOnboarding() {
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('app').classList.remove('blurred');
  renderCards();
}

// ── CV ─────────────────────────────────────────────────────────────────────

function handleFileSelect(e) { const f = e.target.files[0]; if (f) setFile(f); }

function setFile(file) {
  if (file.type !== 'application/pdf') { setStatus('Solo se aceptan PDF.', 'error'); return; }
  cvFile = file;
  document.getElementById('fileSelectedName').textContent = file.name;
  document.getElementById('fileSelected').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('uploadArea');
  if (!area) return;
  area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', ()  => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault(); area.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f) setFile(f);
  });
});

async function handleCVUpload() {
  if (!cvFile) { setStatus('Seleccioná un PDF primero.', 'error'); return; }
  setStatus('Subiendo CV...', 'loading');
  try {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', cvFile);
    const res = await fetch(HASH_CLOUD_URL + '/job/cv', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd,
    });
    if (!res.ok) throw new Error();
    cvUploaded = true;
    setStatus('CV procesado. Buscando ofertas...', 'success');
    finishOnboarding();
    await handleSearch();
  } catch {
    setStatus('No se pudo procesar el CV. Intentá de nuevo.', 'error');
  }
}

// ── Búsqueda ───────────────────────────────────────────────────────────────

async function handleSearch(query = '') {
  if (!cvUploaded) { loadMockJobs(); return; }
  setStatus('Buscando...', 'loading');
  try {
    const token = getToken();
    const res = await fetch(HASH_CLOUD_URL + '/job/search', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error();
    jobResults = await res.json();
    renderCards();
    setStatus(jobResults.length + ' oferta(s) encontrada(s).', 'success');
  } catch { loadMockJobs(); }
}

function loadMockJobs() {
  jobResults = [
    { company: 'Mercado Libre', title: 'Frontend Developer Sr.',     location: 'Buenos Aires', mode: 'Remoto',     compatibility: 94 },
    { company: 'Globant',       title: 'React Engineer',             location: 'Córdoba',      mode: 'Híbrido',    compatibility: 88 },
    { company: 'Naranja X',     title: 'UI Developer',               location: 'Buenos Aires', mode: 'Remoto',     compatibility: 82 },
    { company: 'Auth0',         title: 'Software Engineer Frontend', location: 'Buenos Aires', mode: 'Remoto',     compatibility: 79 },
    { company: 'Rappi',         title: 'Web Developer',              location: 'Buenos Aires', mode: 'Presencial', compatibility: 71 },
    { company: 'Ualá',          title: 'Frontend Engineer',          location: 'Buenos Aires', mode: 'Híbrido',    compatibility: 68 },
  ];
  renderCards();
}

// ── Cards ──────────────────────────────────────────────────────────────────

function compatClass(s) { return s >= 85 ? 'compat--high' : s >= 70 ? 'compat--mid' : 'compat--low'; }

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';
  if (!jobResults.length) {
    grid.innerHTML = '<p class="cards-empty">Subí tu CV para ver ofertas compatibles.</p>';
    return;
  }
  jobResults.forEach(job => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-left">
        <span class="card-company">${esc(job.company)}</span>
        <span class="card-title">${esc(job.title)}</span>
        <div class="card-meta"><span>${esc(job.location)}</span><span>${esc(job.mode)}</span></div>
      </div>
      <div class="card-right">
        <div class="compatibility-badge ${compatClass(job.compatibility)}">
          <span class="compatibility-score">${job.compatibility}%</span>
          <span class="compatibility-label">compatible</span>
        </div>
        <div class="card-actions">
          <button class="btn-outline" onclick='handleVerDetalles(${JSON.stringify(JSON.stringify(job))})'>Ver detalles</button>
          <button class="btn-primary" onclick='handleApply(${JSON.stringify(JSON.stringify(job))})'>Postular</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function handleVerDetalles(jobStr) {
  const job = JSON.parse(jobStr);
  if (job.url) window.open(job.url, '_blank', 'noopener');
  else alert(`${job.title} — ${job.company}\n${job.location} · ${job.mode}\nCompatibilidad: ${job.compatibility}%`);
}

async function handleApply(jobStr) {
  const job   = JSON.parse(jobStr);
  const token = getToken();
  if (!token) { renderLoginScreen(); return; }
  if (!cvUploaded) { setStatus('Primero subí tu CV.', 'error'); return; }
  try {
    setStatus('Enviando postulación...', 'loading');
    const res = await fetch(HASH_CLOUD_URL + '/job/apply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    });
    if (!res.ok) throw new Error();
    setStatus('Postulación enviada a ' + job.company + '.', 'success');
  } catch { setStatus('No se pudo enviar la postulación.', 'error'); }
}

// ── Status bar ─────────────────────────────────────────────────────────────

let statusTimer = null;
function setStatus(msg, type = 'info') {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  bar.textContent = msg;
  bar.className   = 'status-bar status-bar--' + type;
  bar.style.display = '';
  clearTimeout(statusTimer);
  if (type === 'success' || type === 'error') {
    statusTimer = setTimeout(() => { bar.style.display = 'none'; }, 4000);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function checkAuth() {
  await handleAuthCallback();
  const identity = await fetchIdentity();
  if (!identity) { clearToken(); renderLoginScreen(); return; }

  document.getElementById('lock-screen').setAttribute('hidden', '');
  document.getElementById('app').removeAttribute('hidden');

  // Siempre mostrar popup de donación primero
  document.getElementById('overlay').classList.add('active');
  goToPopup('popup-welcome');

  // Verificar si ya tiene CV para saber qué sigue después de la donación
  try {
    const token = getToken();
    const res   = await fetch(HASH_CLOUD_URL + '/job/cv/status', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const data  = await res.json();
    if (data.has_cv) {
      cvUploaded = true;
      // Al cerrar donación va directo al feed
      document.getElementById('popup-welcome').querySelector('.btn-primary').onclick = () => {
        document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
        document.getElementById('overlay').classList.remove('active');
        document.getElementById('app').classList.remove('blurred');
        renderCards();
      };
    }
    // Si no tiene CV, el botón Continuar del popup-welcome ya lleva a popup-how por defecto
  } catch {
    // Si falla, igual muestra donación y luego onboarding
  }
}

document.addEventListener('DOMContentLoaded', () => { checkAuth(); });
