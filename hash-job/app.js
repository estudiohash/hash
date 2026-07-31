// ===================== ESTADO =====================
let cvFile = null;

// ===================== DATOS DE EJEMPLO =====================
// TODO: reemplazar con llamada GET /jobs cuando el backend esté listo
const mockJobs = [
  { company: 'Mercado Libre', title: 'Frontend Developer Sr.', location: 'Buenos Aires', mode: 'Remoto', compatibility: 94 },
  { company: 'Globant', title: 'React Engineer', location: 'Córdoba', mode: 'Híbrido', compatibility: 88 },
  { company: 'Naranja X', title: 'UI Developer', location: 'Buenos Aires', mode: 'Remoto', compatibility: 82 },
  { company: 'Auth0', title: 'Software Engineer Frontend', location: 'Buenos Aires', mode: 'Remoto', compatibility: 79 },
  { company: 'Rappi', title: 'Web Developer', location: 'Buenos Aires', mode: 'Presencial', compatibility: 71 },
  { company: 'Ualá', title: 'Frontend Engineer', location: 'Buenos Aires', mode: 'Híbrido', compatibility: 68 },
];

// ===================== POPUPS =====================
function goToPopup(id) {
  // Ocultar todos los popups
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));

  // Mostrar el popup destino
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
  }
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
  // Si todavía está el onboarding, no abrir
  const welcomeVisible = !document.getElementById('popup-welcome').classList.contains('hidden');
  const howVisible = !document.getElementById('popup-how').classList.contains('hidden');
  const cvVisible = !document.getElementById('popup-cv').classList.contains('hidden');
  if (welcomeVisible || howVisible || cvVisible) return;

  document.getElementById('overlay').classList.add('active');
  goToPopup('popup-emailjs');
}

function openDeleteAccountPopup() {
  document.getElementById('overlay').classList.add('active');
  goToPopup('popup-delete-account');
}

function handleDonate() {
  // TODO: conectar con enlace de donación real
  alert('Redirigiendo a página de donación...');
}

// ===================== ONBOARDING: FIN =====================
function finishOnboarding() {
  // Ocultar todos los popups y overlay
  document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
  document.getElementById('overlay').classList.remove('active');

  // Desenfocar la app
  document.getElementById('app').classList.remove('blurred');

  // Renderizar cards de ejemplo
  renderCards();
}

// ===================== ARCHIVO CV =====================
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  setFile(file);
}

function setFile(file) {
  cvFile = file;
  document.getElementById('fileSelectedName').textContent = file.name;
  document.getElementById('fileSelected').classList.remove('hidden');

  // TODO: enviar CV al backend con POST /cv
}

// Drag & drop
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    setFile(file);
  }
});

// ===================== RENDER CARDS =====================
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  mockJobs.forEach(job => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-left">
        <span class="card-company">${job.company}</span>
        <span class="card-title">${job.title}</span>
        <div class="card-meta">
          <span>${job.location}</span>
          <span>${job.mode}</span>
        </div>
      </div>
      <div class="card-right">
        <div class="compatibility-badge">
          <span class="compatibility-score">${job.compatibility}%</span>
          <span class="compatibility-label">compatible</span>
        </div>
        <button class="btn-outline" onclick="handleVerDetalles('${job.title}')">Ver detalles</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleVerDetalles(title) {
  // TODO: abrir modal con detalle del puesto cuando el backend esté listo
  alert(`Detalle de: ${title}`);
}

// ===================== NAVEGACIÓN =====================
function openSettings() {
  document.getElementById('home').classList.add('hidden');
  document.getElementById('settings').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings').classList.add('hidden');
  document.getElementById('home').classList.remove('hidden');
}

// ===================== INICIALIZACIÓN =====================
document.addEventListener('DOMContentLoaded', () => {
  // El primer popup ya está activo en el HTML
  // Solo nos aseguramos de que el overlay esté activo
  document.getElementById('overlay').classList.add('active');
});
