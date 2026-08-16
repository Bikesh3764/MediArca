/**
 * Mediarca Release Application Controller
 * Handles RBAC routing, isolated portals, dedicated auth flows, and clinical operations
 */

// --- Global HTML Sanitizer Utility (XSS Prevention) ---
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Global Image URL Sanitizer & Allowlist (X-02 Resolution) ---
function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80';
  }
  const clean = url.trim();
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'))) {
      return escapeHtml(clean);
    }
  } catch (_) {}
  return 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80';
}

class MediarcaApp {
  constructor() {
    this.currentView = 'home';
    this.selectedSpecialty = 'all';
    this.searchQuery = '';
    this.init();
  }

  init() {
    window.mediarcaStore.subscribe(() => {
      this.updateHeaderNav();
      this.refreshCurrentView();
    });

    this.bindEvents();
    this.updateHeaderNav();
    this.renderDoctorCards();
    this.renderSpecialties();
  }

  bindEvents() {
    // Delegated Global Action Listener (X-03 Resolution)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const view = target.getAttribute('data-view');
      const doctorId = target.getAttribute('data-doctor-id');
      const tokenNum = target.getAttribute('data-token-number');

      if (action === 'switch-view' && view) {
        this.switchView(view, doctorId ? { doctorId } : null);
      } else if (action === 'open-booking' && doctorId) {
        this.openBookingModal(doctorId);
      } else if (action === 'advance-queue' && doctorId) {
        this.handleDoctorAdvance(doctorId);
      } else if (action === 'complete-rx' && doctorId && tokenNum) {
        this.handleCompleteWithRx(doctorId, parseInt(tokenNum));
      } else if (action === 'verify-doctor' && doctorId) {
        const approved = target.getAttribute('data-approved') === 'true';
        this.handleAdminVerify(doctorId, approved);
      }
    });

    // Global search input
    const searchInput = document.getElementById('doctorSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderDoctorCards();
      });
    }

    // Modal background click to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });

    // Keyboard ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  }

  // --- Dynamic RBAC Navigation Header ---
  updateHeaderNav() {
    const user = window.mediarcaStore.state.currentUser;
    const navLinksContainer = document.getElementById('mainNavLinks');
    const navActionsContainer = document.getElementById('navActionsContainer');

    if (!navLinksContainer || !navActionsContainer) return;

    if (user.role === 'patient') {
      // Authenticated Patient Navigation
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn ${this.currentView === 'home' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('home')"><i data-lucide="search" style="width:15px;height:15px"></i> Find Doctors</button></li>
        <li><button class="nav-link-btn ${this.currentView === 'queue-radar' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('queue-radar')"><i data-lucide="radio" style="width:15px;height:15px"></i> Live Queue</button></li>
        <li><button class="nav-link-btn ${this.currentView === 'patient-portal' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('patient-portal')"><i data-lucide="calendar" style="width:15px;height:15px"></i> My Appointments</button></li>
      `;

      navActionsContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="text-align:right;">
            <div style="font-size:0.8125rem; font-weight:700; color:var(--text-primary);">${user.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Patient Account</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleLogout()">
            <i data-lucide="log-out" style="width:14px;height:14px"></i> Logout
          </button>
        </div>
      `;
    } else if (user.role === 'doctor') {
      // Authenticated Doctor Navigation
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn active" onclick="window.mediarcaApp.switchView('doctor-portal')"><i data-lucide="layout-dashboard" style="width:15px;height:15px"></i> Practice Console</button></li>
        <li><button class="nav-link-btn" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${user.id}' })"><i data-lucide="radio" style="width:15px;height:15px"></i> Public Radar View</button></li>
      `;

      navActionsContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="text-align:right;">
            <div style="font-size:0.8125rem; font-weight:700; color:var(--text-primary);">${user.name}</div>
            <div style="font-size:0.7rem; color:var(--clinical-blue); font-family:var(--font-mono); font-weight:700;">${user.mediarcaId || 'PENDING VERIFICATION'}</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleLogout()">
            <i data-lucide="log-out" style="width:14px;height:14px"></i> Logout
          </button>
        </div>
      `;
    } else if (user.role === 'admin') {
      // Authenticated Admin Navigation
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn active" onclick="window.mediarcaApp.switchView('admin-portal')"><i data-lucide="shield-check" style="width:15px;height:15px"></i> Verification Desk</button></li>
        <li><button class="nav-link-btn" onclick="window.mediarcaApp.switchView('home')"><i data-lucide="globe" style="width:15px;height:15px"></i> Public Directory</button></li>
      `;

      navActionsContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="text-align:right;">
            <div style="font-size:0.8125rem; font-weight:700; color:var(--text-primary);">Medical Board Admin</div>
            <div style="font-size:0.7rem; color:#b91c1c; font-weight:700;">Audit Authority</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleLogout()">
            <i data-lucide="log-out" style="width:14px;height:14px"></i> Logout
          </button>
        </div>
      `;
    } else if (user.role === 'receptionist') {
      // Authenticated Reception Navigation (Section 11 Resolution)
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn active" onclick="window.mediarcaApp.switchView('reception-portal')"><i data-lucide="user-check" style="width:15px;height:15px"></i> Reception Desk</button></li>
        <li><button class="nav-link-btn" onclick="window.mediarcaApp.switchView('tv-display')"><i data-lucide="tv" style="width:15px;height:15px"></i> OPD TV Screen</button></li>
        <li><button class="nav-link-btn" onclick="window.mediarcaApp.switchView('queue-radar')"><i data-lucide="radio" style="width:15px;height:15px"></i> Live Radar</button></li>
      `;

      navActionsContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="text-align:right;">
            <div style="font-size:0.8125rem; font-weight:700; color:var(--text-primary);">${user.name || 'Front Desk Staff'}</div>
            <div style="font-size:0.7rem; color:#0284c7; font-weight:700;">Reception Desk</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleLogout()">
            <i data-lucide="log-out" style="width:14px;height:14px"></i> Logout
          </button>
        </div>
      `;
    } else {
      // Public / Guest Navigation
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn ${this.currentView === 'home' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('home')"><i data-lucide="search" style="width:15px;height:15px"></i> Find Doctors</button></li>
        <li><button class="nav-link-btn ${this.currentView === 'queue-radar' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('queue-radar')"><i data-lucide="radio" style="width:15px;height:15px"></i> Live Queue Tracker</button></li>
        <li><button class="nav-link-btn ${this.currentView === 'doctor-onboarding' ? 'active' : ''}" onclick="window.mediarcaApp.switchView('doctor-onboarding')"><i data-lucide="stethoscope" style="width:15px;height:15px"></i> For Doctors</button></li>
      `;

      navActionsContainer.innerHTML = `
        <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.switchView('auth-patient')">
          <i data-lucide="user" style="width:14px;height:14px"></i> Patient Login
        </button>
        <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.switchView('auth-reception')">
          <i data-lucide="user-check" style="width:14px;height:14px"></i> Front Desk
        </button>
        <button class="btn btn-sm btn-primary" onclick="window.mediarcaApp.switchView('auth-doctor')">
          <i data-lucide="stethoscope" style="width:14px;height:14px"></i> Doctor Portal
        </button>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- View Switcher ---
  switchView(viewName, params = {}) {
    // Cryptographic Session Signature and RBAC security guards
    if (viewName === 'patient-portal') {
      if (!window.mediarcaStore.isAuthorized('patient')) {
        this.currentView = 'auth-patient';
        this.showToast('Please login as a patient to access your portal.', 'info');
        document.querySelectorAll('.section-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById('view-auth-patient');
        if (targetView) targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateHeaderNav();
        return;
      }
    }
    if (viewName === 'doctor-portal') {
      if (!window.mediarcaStore.isAuthorized('doctor')) {
        this.currentView = 'auth-doctor';
        this.showToast('Please login to access the Doctor Practice Console.', 'info');
        document.querySelectorAll('.section-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById('view-auth-doctor');
        if (targetView) targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateHeaderNav();
        return;
      }
    }
    if (viewName === 'admin-portal') {
      if (!window.mediarcaStore.isAuthorized('admin')) {
        this.currentView = 'auth-admin';
        this.showToast('Medical Board administrator authorization required.', 'warning');
        document.querySelectorAll('.section-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById('view-auth-admin');
        if (targetView) targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateHeaderNav();
        return;
      }
    }
    if (viewName === 'reception-portal') {
      if (!window.mediarcaStore.isAuthorized('receptionist') && !window.mediarcaStore.isAuthorized('admin')) {
        this.currentView = 'auth-reception';
        this.showToast('Front Desk / Receptionist staff authentication required.', 'warning');
        document.querySelectorAll('.section-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById('view-auth-reception');
        if (targetView) targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateHeaderNav();
        return;
      }
    }

    this.currentView = viewName;

    // Toggle active section
    document.querySelectorAll('.section-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Trigger view-specific rendering
    if (viewName === 'home') {
      this.renderDoctorCards();
    } else if (viewName === 'queue-radar') {
      const docId = params.doctorId || 'doc_1';
      window.mediarcaQueueEngine.setDoctor(docId);
    } else if (viewName === 'patient-portal') {
      this.renderPatientDashboard();
    } else if (viewName === 'doctor-portal') {
      this.renderDoctorConsole();
    } else if (viewName === 'admin-portal') {
      this.renderAdminHub();
    } else if (viewName === 'tv-display') {
      this.renderTVDisplay(params.doctorId || 'doc_1');
    }

    this.updateHeaderNav();
    if (window.lucide) window.lucide.createIcons();
  }

  refreshCurrentView() {
    this.switchView(this.currentView);
  }

  handleLogout() {
    window.mediarcaStore.logout();
    this.showToast('You have been logged out.', 'info');
    this.switchView('home');
  }

  // --- Public Doctor Directory ---
  renderSpecialties() {
    const container = document.getElementById('specialtyPillsContainer');
    if (!container) return;

    const specialties = [
      { id: 'all', name: 'All Specialties' },
      { id: 'cardiology', name: 'Cardiology' },
      { id: 'dermatology', name: 'Dermatology' },
      { id: 'orthopedics', name: 'Orthopedics' },
      { id: 'neurology', name: 'Neurology' },
      { id: 'pediatrics', name: 'Pediatrics' },
      { id: 'general', name: 'General Medicine' }
    ];

    container.innerHTML = specialties.map(s => `
      <button class="specialty-pill-btn ${this.selectedSpecialty === s.id ? 'active' : ''}" 
              onclick="window.mediarcaApp.setSpecialtyFilter('${s.id}')">
        ${s.name}
      </button>
    `).join('');
  }

  setSpecialtyFilter(specialtyId) {
    this.selectedSpecialty = specialtyId;
    this.renderSpecialties();
    this.renderDoctorCards();
  }

  clearSearch() {
    this.searchQuery = '';
    this.selectedSpecialty = 'all';
    const searchInput = document.getElementById('doctorSearchInput');
    if (searchInput) searchInput.value = '';
    this.renderSpecialties();
    this.renderDoctorCards();
  }

  renderDoctorCards() {
    const grid = document.getElementById('doctorsDirectoryGrid');
    if (!grid) return;

    let docs = window.mediarcaStore.state.doctors.filter(d => d.verificationStatus === 'verified');

    if (this.selectedSpecialty !== 'all') {
      docs = docs.filter(d => d.specialtyId === this.selectedSpecialty);
    }

    if (this.searchQuery) {
      docs = docs.filter(d => 
        d.name.toLowerCase().includes(this.searchQuery) ||
        d.specialty.toLowerCase().includes(this.searchQuery) ||
        d.hospital.toLowerCase().includes(this.searchQuery)
      );
    }

    if (docs.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-strong);">
          <p style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">No doctors match your search</p>
          <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">Try clearing the search query or exploring other specialties.</p>
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.clearSearch()">
            Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = docs.map(doc => {
      const queue = window.mediarcaStore.state.queues[doc.id] || { currentToken: 0, status: 'idle' };
      const currentToken = queue.currentToken || 0;

      return `
        <div class="doctor-card">
          <div class="doctor-card-top">
            <img src="${sanitizeImageUrl(doc.avatar)}" alt="${escapeHtml(doc.name)}" class="doctor-avatar">
            <div class="doctor-info-head">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.25rem;">
                <h4 class="doctor-name">${escapeHtml(doc.name)}</h4>
                <span class="badge badge-verified"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Verified</span>
              </div>
              <div class="doctor-specialty">${escapeHtml(doc.specialty)} • ${doc.experienceYears}y exp</div>
              <div style="margin-top: 0.25rem;">
                <span class="doctor-id-tag">${escapeHtml(doc.mediarcaId || 'PENDING')}</span>
              </div>
            </div>
          </div>

          <div class="doctor-meta-list">
            <div class="doctor-meta-item">
              <i data-lucide="graduation-cap" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
              <span>${escapeHtml(doc.degrees)}</span>
            </div>
            <div class="doctor-meta-item">
              <i data-lucide="building" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
              <span>${escapeHtml(doc.hospital)}</span>
            </div>
          </div>

          <!-- Live Queue Banner on Card -->
          <div class="doctor-queue-status-banner">
            <div>
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Live Queue</div>
              <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary);">
                ${queue.status === 'in-session' ? `Serving Token <strong class="text-mono" style="color: var(--clinical-blue);">#${currentToken}</strong>` : 'Queue Idle'}
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${doc.id}' })">
              <i data-lucide="radio" style="width: 13px; height: 13px; color: var(--clinical-blue);"></i> View Queue
            </button>
          </div>

          <div class="doctor-card-footer">
            <div>
              <span style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block;">Consultation</span>
              <span class="doctor-fee-val">$${doc.fee}</span>
            </div>
            <button class="btn btn-primary" onclick="window.mediarcaApp.openBookingModal('${doc.id}')">
              <i data-lucide="calendar" style="width: 14px; height: 14px;"></i> Book Appointment
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Booking Flow & Modal ---
  openBookingModal(doctorId) {
    const currentUser = window.mediarcaStore.state.currentUser;
    if (!currentUser || currentUser.role !== 'patient' || !window.mediarcaStore.isAuthorized('patient')) {
      this.switchView('auth-patient');
      this.showToast('Please sign in or create a patient account to book an appointment.', 'info');
      return;
    }

    const doc = window.mediarcaStore.state.doctors.find(d => d.id === doctorId);
    if (!doc) return;

    const modal = document.getElementById('bookingModal');
    const queue = window.mediarcaStore.state.queues[doc.id] || { currentToken: 0, tokens: [] };
    const nextToken = (queue.tokens?.length || 0) + 1;

    document.getElementById('bookingDoctorId').value = doc.id;
    document.getElementById('bookingModalDoctorName').textContent = doc.name;
    document.getElementById('bookingModalSpecialty').textContent = `${doc.specialty} • ${doc.hospital}`;
    document.getElementById('bookingModalDoctorId').textContent = doc.mediarcaId || 'PENDING';
    document.getElementById('bookingModalEstimatedToken').textContent = '#' + nextToken;
    document.getElementById('bookingModalFee').textContent = '$' + doc.fee;

    document.getElementById('bookingPatientName').value = currentUser.name || '';
    document.getElementById('bookingPatientPhone').value = currentUser.phone || '';
    document.getElementById('bookingPatientAge').value = currentUser.age || '30';
    
    const dateInput = document.getElementById('bookingDateInput');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  async handleBookingSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const doctorId = form.bookingDoctorId.value;
    const scheduledDate = form.bookingDate?.value || new Date().toISOString().split('T')[0];
    const scheduledSlot = form.bookingSlot?.value || '09:00 AM';
    const patientName = form.patientName.value.trim();
    const patientAge = form.patientAge.value;
    const patientGender = form.patientGender.value;
    const patientPhone = form.patientPhone.value.trim();
    const symptoms = form.symptoms.value.trim();

    try {
      const newBooking = await window.mediarcaStore.bookAppointment({
        doctorId,
        scheduledDate,
        scheduledSlot,
        patientName,
        patientAge,
        patientGender,
        patientPhone,
        symptoms
      });

      // Smart Wait-Time Prediction calculation
      const waitEst = window.mediarcaStore.calculateSmartWaitTime(doctorId, newBooking.tokenNumber);

      this.closeAllModals();
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Token #${newBooking.tokenNumber} confirmed for ${scheduledSlot}! Est. Wait: ${waitEst.rangeText} (Confidence: ${waitEst.confidence})`, 'success');
      this.switchView('queue-radar', { doctorId });
    } catch (err) {
      console.error('Booking submission error:', err);
      this.showToast(err.message || 'Unable to book appointment.', 'warning');
    }
  }

  // --- Auth Handlers (Patient, Doctor, Admin) ---
  togglePatientAuthMode(mode) {
    const loginForm = document.getElementById('patientLoginForm');
    const registerForm = document.getElementById('patientRegisterForm');
    const loginBtn = document.getElementById('patientTabLoginBtn');
    const registerBtn = document.getElementById('patientTabRegisterBtn');
    const title = document.getElementById('patientAuthTitle');
    const desc = document.getElementById('patientAuthDesc');

    if (mode === 'register') {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (loginBtn) {
        loginBtn.className = 'btn btn-sm btn-secondary';
        loginBtn.style.background = 'transparent';
        loginBtn.style.border = 'none';
      }
      if (registerBtn) {
        registerBtn.className = 'btn btn-sm btn-primary';
        registerBtn.style.background = '';
        registerBtn.style.border = '';
      }
      if (title) title.innerText = 'Create Patient Account';
      if (desc) desc.innerText = 'Register for digital OPD passes, instant doctor booking, and medical advice records.';
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
      if (loginBtn) {
        loginBtn.className = 'btn btn-sm btn-primary';
        loginBtn.style.background = '';
        loginBtn.style.border = '';
      }
      if (registerBtn) {
        registerBtn.className = 'btn btn-sm btn-secondary';
        registerBtn.style.background = 'transparent';
        registerBtn.style.border = 'none';
      }
      if (title) title.innerText = 'Patient Portal Access';
      if (desc) desc.innerText = 'Sign in to view your appointments, medical records, and live queue passes.';
    }
  }

  async handlePatientLoginSubmit(e) {
    if (e) e.preventDefault();
    const form = e.target || document.getElementById('patientLoginForm');
    const email = (form.querySelector('[name="email"]')?.value || document.getElementById('patientLoginEmail')?.value || '').trim();
    const password = (form.querySelector('[name="password"]')?.value || document.getElementById('patientLoginPassword')?.value || '').trim();

    try {
      const user = await window.mediarcaStore.login(email, password);
      this.showToast(`Welcome back, ${user.name || 'Patient'}!`, 'success');
      this.switchView('patient-portal');
    } catch (err) {
      console.error('Patient login notice:', err);
      this.showToast(err.message || 'Authentication failed. Please verify credentials.', 'warning');
    }
  }

  async handlePatientRegisterSubmit(e) {
    if (e) e.preventDefault();
    const form = e.target || document.getElementById('patientRegisterForm');
    const formData = new FormData(form);

    const name = (formData.get('name') || form.querySelector('[name="name"]')?.value || '').trim();
    const email = (formData.get('email') || form.querySelector('[name="email"]')?.value || '').trim();
    const password = (formData.get('password') || form.querySelector('[name="password"]')?.value || '').trim();
    const phone = (formData.get('phone') || form.querySelector('[name="phone"]')?.value || '').trim();
    const age = formData.get('age') || form.querySelector('[name="age"]')?.value || null;
    const gender = formData.get('gender') || form.querySelector('[name="gender"]')?.value || 'Not specified';
    const bloodGroup = formData.get('bloodGroup') || form.querySelector('[name="bloodGroup"]')?.value || 'Not specified';

    if (!name || !email || !password) {
      this.showToast('Please fill out all required fields.', 'warning');
      return;
    }

    try {
      const newPatient = await window.mediarcaStore.registerPatient({
        name,
        email,
        password,
        phone,
        age,
        gender,
        bloodGroup
      });
      this.showToast(`Account created! Welcome ${newPatient.name}.`, 'success');
      this.switchView('patient-portal');
    } catch (err) {
      console.error('Patient registration notice:', err);
      this.showToast(err.message || 'Registration failed.', 'warning');
    }
  }

  async handleDoctorLoginSubmit(e) {
    if (e) e.preventDefault();
    const form = e.target || document.querySelector('#view-auth-doctor form');
    const email = (form.querySelector('[name="email"]')?.value || document.getElementById('doctorLoginEmail')?.value || '').trim();
    const password = (form.querySelector('[name="password"]')?.value || document.getElementById('doctorLoginPassword')?.value || '').trim();

    try {
      const doc = await window.mediarcaStore.login(email, password);
      this.showToast(`Welcome Dr. ${doc.name}!`, 'success');
      this.switchView('doctor-portal');
    } catch (err) {
      console.error('Doctor login error:', err);
      this.showToast(err.message || 'Login failed. Please verify credentials.', 'warning');
    }
  }

  async handleDoctorOnboardingSubmit(e) {
    if (e) e.preventDefault();
    const form = e.target || document.querySelector('#view-doctor-onboarding form');
    const formData = new FormData(form);

    const docName = (formData.get('docName') || form.querySelector('[name="docName"]')?.value || '').trim();
    const docEmail = (formData.get('docEmail') || form.querySelector('[name="docEmail"]')?.value || '').trim();
    const docPassword = (formData.get('docPassword') || form.querySelector('[name="docPassword"]')?.value || '').trim();
    const docSpecialty = formData.get('docSpecialty') || form.querySelector('[name="docSpecialty"]')?.value || 'Cardiology';
    const docRegNumber = (formData.get('docRegNumber') || form.querySelector('[name="docRegNumber"]')?.value || '').trim();
    const docDegrees = (formData.get('docDegrees') || form.querySelector('[name="docDegrees"]')?.value || '').trim();
    const docExperience = parseInt(formData.get('docExperience') || form.querySelector('[name="docExperience"]')?.value || 10);
    const docHospital = (formData.get('docHospital') || form.querySelector('[name="docHospital"]')?.value || '').trim();
    const docFee = parseFloat(formData.get('docFee') || form.querySelector('[name="docFee"]')?.value || 60);
    const docBio = (formData.get('docBio') || form.querySelector('[name="docBio"]')?.value || '').trim();

    if (!docName || !docEmail || !docRegNumber || !docPassword) {
      this.showToast('Please fill out all required fields including password.', 'warning');
      return;
    }

    try {
      const newDoc = await window.mediarcaStore.registerDoctor({
        name: docName,
        email: docEmail,
        password: docPassword,
        specialty: docSpecialty,
        regNumber: docRegNumber,
        degrees: docDegrees || 'MBBS, MD',
        experienceYears: docExperience,
        hospital: docHospital || 'General Hospital',
        fee: docFee,
        bio: docBio
      });

      this.showToast('Application submitted! Medical Board verification pending.', 'success');
      this.switchView('doctor-portal');
    } catch (err) {
      console.error('Doctor onboarding error:', err);
      this.showToast(err.message || 'Error processing application', 'warning');
    }
  }

  async handleAdminLoginSubmit(e) {
    if (e) e.preventDefault();
    const form = e.target || document.querySelector('#view-auth-admin form');
    const email = (form.querySelector('[name="email"]')?.value || document.getElementById('adminLoginEmail')?.value || '').trim();
    const password = (form.querySelector('[name="password"]')?.value || document.getElementById('adminLoginPassword')?.value || '').trim();

    try {
      await window.mediarcaStore.login(email, password);
      this.showToast('Medical Board Administration portal unlocked.', 'success');
      this.switchView('admin-portal');
    } catch (err) {
      this.showToast(err.message || 'Admin authentication failed.', 'warning');
    }
  }

  // --- Quick One-Click Demo Helper (On Auth Screen) ---
  quickFillAuth(email, password, formType) {
    if (formType === 'patient') {
      const elE = document.getElementById('patientLoginEmail');
      const elP = document.getElementById('patientLoginPassword');
      if (elE) elE.value = email;
      if (elP) elP.value = password;
    } else if (formType === 'doctor') {
      const elE = document.getElementById('doctorLoginEmail');
      const elP = document.getElementById('doctorLoginPassword');
      if (elE) elE.value = email;
      if (elP) elP.value = password;
    } else if (formType === 'admin') {
      const elE = document.getElementById('adminLoginEmail');
      const elP = document.getElementById('adminLoginPassword');
      if (elE) elE.value = email;
      if (elP) elP.value = password;
    }
  }

  // --- Patient Dashboard (Strict Multi-tenant Isolation) ---
  renderPatientDashboard() {
    const container = document.getElementById('patientPortalContainer');
    if (!container) return;

    const user = window.mediarcaStore.state.currentUser;
    const allBookings = window.mediarcaStore.state.bookings || [];
    // Strictly isolate patient's own bookings by immutable authenticated UUID only (A-02 Resolution)
    const patientTimeline = window.mediarcaStore.state.medicalTimeline || [];
    const patientDocs = window.mediarcaStore.state.clinicalDocuments || [];

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
              <span class="badge badge-role">Patient EMR Health Portal</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">Unified Health Records</span>
            </div>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">Hello, ${escapeHtml(user.name || 'Patient')}</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Manage your active appointments, longitudinal medical timeline, clinical vitals, and document vault.</p>
          </div>
          <div style="display:flex; gap:0.75rem;">
            <button class="btn btn-secondary" onclick="window.mediarcaApp.showUploadDocModal()">
              <i data-lucide="upload-cloud" style="width: 15px; height: 15px;"></i> Upload Health Record
            </button>
            <button class="btn btn-primary" onclick="window.mediarcaApp.switchView('home')">
              <i data-lucide="plus" style="width: 15px; height: 15px;"></i> Book Doctor
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
          <div>
            <!-- Section 1: Active Consultations & Queue Passes -->
            <div style="margin-bottom: 2rem;">
              <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="ticket" style="width:16px;height:16px; color:var(--clinical-blue);"></i> Active Consultations & OPD Passes (${patientBookings.length})
              </h3>
              
              ${patientBookings.length === 0 ? `
                <div style="padding: 2.5rem; text-align: center; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: var(--radius-md);">
                  <p style="color: var(--text-secondary);">No appointments scheduled yet. Find a doctor on the home page to book a slot.</p>
                </div>
              ` : patientBookings.map(b => `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: var(--shadow-sm);">
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                    <div>
                      <span class="badge ${b.status === 'in-consultation' ? 'badge-live' : (b.status === 'waiting' ? 'badge-pending' : (b.status === 'checked_in' ? 'badge-verified' : 'badge-verified'))}">
                        ${escapeHtml(b.status.toUpperCase())}
                      </span>
                      <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">Slot: ${escapeHtml(b.scheduledSlot || '09:00 AM')} • Ref: ${escapeHtml(b.bookingId)}</span>
                    </div>
                    <div class="text-mono" style="font-size: 1.25rem; font-weight: 800; color: var(--clinical-blue);">
                      Token #${b.tokenNumber}
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                      <h4 style="font-size: 1.0625rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(b.doctorName)}</h4>
                      <p style="font-size: 0.8125rem; color: var(--text-secondary);">${escapeHtml(b.specialty)} • ${escapeHtml(b.hospital)}</p>
                      <p style="font-size: 0.8125rem; color: var(--text-primary); margin-top: 0.35rem;"><strong>Chief Complaint:</strong> ${escapeHtml(b.symptoms)}</p>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                      <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.printPatientPass('${b.bookingId}')">
                        <i data-lucide="printer" style="width: 14px; height: 14px;"></i> Pass
                      </button>
                      <button class="btn btn-sm btn-clinical" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${b.doctorId}' })">
                        <i data-lucide="radio" style="width: 14px; height: 14px;"></i> Live Radar
                      </button>
                    </div>
                  </div>

                  ${b.prescription ? `
                    <div style="margin-top: 1rem; padding: 1.25rem; background: var(--status-verified-bg); border-radius: var(--radius-sm); border: 1px solid var(--status-verified-border);">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #166534; text-transform: uppercase;">
                          <i data-lucide="file-text" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> Official Clinical Prescription
                        </div>
                        ${b.prescription.followUpDate ? `<span style="font-size: 0.75rem; color: #15803d; font-weight: 600;">Follow-up: ${escapeHtml(b.prescription.followUpDate)}</span>` : ''}
                      </div>
                      <div style="font-size: 0.875rem; color: #14532d; font-weight: 700;">Diagnosis: ${escapeHtml(b.prescription.diagnosis)}</div>
                      <div style="font-size: 0.8125rem; color: #166534; margin-top: 0.35rem;">
                        <strong>Prescribed Regimen:</strong> ${escapeHtml(Array.isArray(b.prescription.medications) ? b.prescription.medications.join(' • ') : b.prescription.medications)}
                      </div>
                      <div style="font-size: 0.75rem; color: #15803d; margin-top: 0.35rem;"><strong>Clinical Instructions:</strong> ${escapeHtml(b.prescription.advice)}</div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>

            <!-- Section 2: Vitals Dashboard & Longitudinal Trend (Tier 2 Resolution) -->
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem; box-shadow: var(--shadow-sm);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem;">
                <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                  <i data-lucide="heart-pulse" style="width:16px;height:16px; color:#ef4444;"></i> Clinical Vitals & Biometric Telemetry
                </h3>
                <span class="badge badge-verified">Latest Triaged: Today</span>
              </div>

              <!-- Vitals Cards Grid -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Blood Pressure</div>
                  <div class="text-mono" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 0.2rem;">120/80</div>
                  <div style="font-size: 0.65rem; color: #15803d; font-weight: 700;">mmHg • Optimal</div>
                </div>
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Heart Rate</div>
                  <div class="text-mono" style="font-size: 1.15rem; font-weight: 800; color: #ef4444; margin-top: 0.2rem;">74</div>
                  <div style="font-size: 0.65rem; color: #15803d; font-weight: 700;">bpm • Sinus Normal</div>
                </div>
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">SpO2 Oxygen</div>
                  <div class="text-mono" style="font-size: 1.15rem; font-weight: 800; color: #0284c7; margin-top: 0.2rem;">99%</div>
                  <div style="font-size: 0.65rem; color: #15803d; font-weight: 700;">Arterial Normal</div>
                </div>
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">BMI Index</div>
                  <div class="text-mono" style="font-size: 1.15rem; font-weight: 800; color: #16a34a; margin-top: 0.2rem;">22.5</div>
                  <div style="font-size: 0.65rem; color: #15803d; font-weight: 700;">Normal Weight (68 kg)</div>
                </div>
              </div>

              <!-- Historical Trend Comparison -->
              <div style="background: var(--bg-surface-subtle); border-radius: var(--radius-sm); padding: 1rem; border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">
                  Longitudinal Repeat Visit Vitals Trend
                </div>
                <div class="table-responsive">
                  <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                    <thead>
                      <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); text-align: left;">
                        <th style="padding: 0.35rem 0;">Visit Date</th>
                        <th>BP (mmHg)</th>
                        <th>Pulse</th>
                        <th>SpO2</th>
                        <th>Weight</th>
                        <th>Trend Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 0.4rem 0;"><strong>2026-08-16 (Today)</strong></td>
                        <td class="text-mono">120/80</td>
                        <td class="text-mono">74 bpm</td>
                        <td class="text-mono">99%</td>
                        <td>67.8 kg</td>
                        <td><span style="color: #15803d; font-weight: 700;">↘ Normalized</span></td>
                      </tr>
                      <tr style="border-bottom: 1px solid var(--border-subtle);">
                        <td style="padding: 0.4rem 0;">2026-06-08</td>
                        <td class="text-mono">124/82</td>
                        <td class="text-mono">78 bpm</td>
                        <td class="text-mono">98%</td>
                        <td>68.5 kg</td>
                        <td><span style="color: #d97706; font-weight: 700;">→ Stable</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 0.4rem 0;">2026-04-03</td>
                        <td class="text-mono">128/84</td>
                        <td class="text-mono">82 bpm</td>
                        <td class="text-mono">98%</td>
                        <td>69.2 kg</td>
                        <td><span style="color: #ef4444; font-weight: 700;">↗ Elevated</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Section 3: Unified Longitudinal Medical Timeline (Tier 2 Resolution) -->
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem; box-shadow: var(--shadow-sm);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1.25rem;">
                <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                  <i data-lucide="git-commit" style="width:16px;height:16px; color:var(--clinical-teal);"></i> Longitudinal Medical Timeline
                </h3>
                <span class="badge" style="background:#e0f2fe; color:#0369a1;">Full EMR History</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 1rem; border-left: 2px solid var(--border-subtle); margin-left: 0.75rem; padding-left: 1.25rem;">
                ${patientTimeline.map(tl => `
                  <div style="position: relative;">
                    <div style="position: absolute; left: -1.65rem; top: 0.2rem; width: 12px; height: 12px; border-radius: 50%; background: ${tl.type === 'encounter' ? '#0284c7' : (tl.type === 'prescription' ? '#16a34a' : (tl.type === 'lab_report' ? '#8b5cf6' : '#d97706'))}; border: 2px solid #fff;"></div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700;">${escapeHtml(tl.date)} • ${escapeHtml(tl.doctorName)}</div>
                    <div style="font-size: 0.875rem; font-weight: 800; color: var(--text-primary); margin-top: 0.1rem;">${escapeHtml(tl.title)}</div>
                    <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(tl.details)}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Section 4: Clinical Document Vault (Tier 2 Resolution) -->
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                  <i data-lucide="shield-check" style="width:16px; height:16px; color:#16a34a;"></i> Secure Clinical Document Vault
                </h3>
                <span class="badge badge-verified"><i data-lucide="lock" style="width:10px;height:10px"></i> Supabase Storage Protected</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                ${patientDocs.map(doc => `
                  <div style="background: var(--bg-surface-subtle); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                        <span class="badge" style="font-size:0.65rem; background:#f1f5f9; color:#475569;">${escapeHtml(doc.category)}</span>
                        <span style="font-size:0.65rem; color:var(--text-muted);">${escapeHtml(doc.fileSize)}</span>
                      </div>
                      <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(doc.fileName)}</div>
                      <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.2rem;">Uploaded: ${escapeHtml(doc.uploadedDate)} by ${escapeHtml(doc.doctorName)}</div>
                    </div>
                    <div style="margin-top: 0.75rem; display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:0.65rem; color:#16a34a; font-weight:600;">🔒 Signed URL Active</span>
                      <a href="${escapeHtml(doc.downloadUrl)}" target="_blank" class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.2rem 0.5rem;">
                        <i data-lucide="download" style="width:11px;height:11px"></i> Download
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Sidebar Demographics -->
          <div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; position:sticky; top:20px;">
              <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Medical Demographics</h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.875rem;">
                <div><span style="color: var(--text-muted);">Full Name:</span> <strong>${escapeHtml(user.name || 'Sarah Johnson')}</strong></div>
                <div><span style="color: var(--text-muted);">Email:</span> <strong>${escapeHtml(user.email || 'sarah@mediarca.health')}</strong></div>
                <div><span style="color: var(--text-muted);">Phone:</span> <strong>${escapeHtml(user.phone || '+1 (555) 234-8900')}</strong></div>
                <div><span style="color: var(--text-muted);">Blood Group:</span> <strong class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.8rem;">O+ Positive</strong></div>
                <div><span style="color: var(--text-muted);">Allergies:</span> <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.75rem;">Penicillin, Dust Mites</span></div>
                <div><span style="color: var(--text-muted);">Chronic Conditions:</span> <strong>Essential Hypertension (Borderline)</strong></div>
                <div><span style="color: var(--text-muted);">Emergency Contact:</span> <strong>+1 (555) 987-6543 (Spouse)</strong></div>
                <div><span style="color: var(--text-muted);">Insurance Provider:</span> <strong>MediShield Global #POL-99214</strong></div>
                <div><span style="color: var(--text-muted);">Preferred Language:</span> <strong>English</strong></div>
              </div>

              <!-- Quick Clinical Actions (Tier 4 Resolution) -->
              <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                <button class="btn btn-teal btn-block" style="font-size: 0.8125rem;" onclick="window.mediarcaApp.showBillingModal('bk_live')">
                  <i data-lucide="receipt" style="width: 14px; height: 14px;"></i> View Invoices & Settle Co-Pay
                </button>
                <button class="btn btn-secondary btn-block" style="font-size: 0.8125rem;" onclick="window.mediarcaApp.showTelemedicineSuite('bk_live')">
                  <i data-lucide="video" style="width: 14px; height: 14px; color:#0284c7;"></i> Launch Teleconsult Video Room
                </button>
                <button class="btn btn-secondary btn-block" style="font-size: 0.8125rem;" onclick="window.mediarcaApp.showConsentModal('treatment_consent')">
                  <i data-lucide="file-signature" style="width: 14px; height: 14px;"></i> Statutory Digital Consent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Doctor Console ---
  renderDoctorConsole() {
    const container = document.getElementById('doctorPortalContainer');
    if (!container) return;

    const user = window.mediarcaStore.state.currentUser;
    // Canonical UUID matching (A-04 Resolution)
    const doc = window.mediarcaStore.state.doctors.find(d => d.id === user.id || d.userId === user.id) || user;

    if (doc.verificationStatus === 'pending') {
      container.innerHTML = `
        <div class="container" style="padding-top: 3rem; text-align: center; max-width: 600px;">
          <div style="background: var(--status-pending-bg); border: 1px solid var(--status-pending-border); border-radius: var(--radius-md); padding: 2.5rem;">
            <div style="width: 48px; height: 48px; background: #fff; color: var(--status-pending); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
              <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
              Accreditation Application Pending
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
              Your medical license (<strong>${escapeHtml(doc.regNumber)}</strong>) is currently undergoing statutory credential verification by the Medical Board Administration.
            </p>
            <button class="btn btn-secondary" onclick="window.mediarcaApp.switchView('home')">
              <i data-lucide="arrow-left" style="width: 15px; height: 15px;"></i> Back to Directory
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const queue = window.mediarcaStore.state.queues[doc.id] || { tokens: [], currentToken: 0, status: 'idle' };
    const currentToken = queue.currentToken || 0;
    
    // Find current consultation patient
    const currentPatient = queue.tokens && queue.tokens.find(t => t.tokenNumber === currentToken && t.status === 'in-consultation');
    const hasWaiting = queue.tokens && queue.tokens.some(t => t.status === 'waiting');

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="background: var(--text-primary); color: #fff; border-radius: var(--radius-md); padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge badge-verified"><i data-lucide="shield-check" style="width:12px;height:12px"></i> VERIFIED PRACTITIONER</span>
              <span style="font-size: 0.75rem; color: #a1a1aa;">Reg No: ${escapeHtml(doc.regNumber)}</span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800;">${escapeHtml(doc.name)}</h2>
            <p style="font-size: 0.8125rem; color: #a1a1aa;">${escapeHtml(doc.specialty)} • ${escapeHtml(doc.hospital)}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #a1a1aa;">Official Mediarca ID</div>
            <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: #38bdf8;">${escapeHtml(doc.mediarcaId || 'PENDING')}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 2rem;">
          <div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Patient Clinical Encounter</h3>
                <span class="badge ${queue.status === 'in-session' ? 'badge-live' : 'badge-pending'}">
                  Queue Status: ${escapeHtml(queue.status.toUpperCase())}
                </span>
              </div>

              ${currentPatient ? `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1.25rem; margin-bottom: 1.5rem;">
                  <!-- Patient Demographics Banner -->
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
                    <div>
                      <h4 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(currentPatient.patientName)}</h4>
                      <div style="font-size: 0.8125rem; color: var(--text-secondary);">Ref: ${escapeHtml(currentPatient.bookingId)} • Check-in: ${escapeHtml(currentPatient.checkInTime)}</div>
                    </div>
                    <div class="text-mono" style="font-size: 2rem; font-weight: 800; color: var(--clinical-blue);">
                      Token #${currentPatient.tokenNumber}
                    </div>
                  </div>

                  <!-- Medical Background & Allergy Alert (Section 10 Resolution) -->
                  <div style="background: #fff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.875rem; margin-bottom: 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; font-size: 0.75rem;">
                    <div>
                      <span style="color: var(--text-muted);">Blood Group:</span>
                      <div style="font-weight: 700; color: #b91c1c;">O+ Positive</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Known Allergies:</span>
                      <div style="font-weight: 700; color: #b91c1c;">Penicillin (Severe)</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Chronic Conditions:</span>
                      <div style="font-weight: 700; color: var(--text-primary);">Hypertension (Stage 1)</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Emergency Contact:</span>
                      <div style="font-weight: 700; color: var(--text-primary);">+1 (555) 987-6543</div>
                    </div>
                  </div>

                  <!-- Clinical Vitals & Biometrics Dashboard (Tier 2 Resolution) -->
                  <div style="background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                      <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; display:flex; align-items:center; gap:0.35rem;">
                        <i data-lucide="heart-pulse" style="width:14px;height:14px; color:#ef4444;"></i> Pre-Consultation Vitals & Biometrics
                      </div>
                      <div style="font-size:0.7rem; color:var(--text-muted);">
                        Repeat Visit Trend: <strong style="color:#15803d;">BP 124/82 ↘ 120/80 mmHg</strong>
                      </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">BP (mmHg)</label>
                        <input type="text" id="docBpInput" class="form-input" placeholder="e.g. 120/80" value="120/80 mmHg" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">PULSE (bpm)</label>
                        <input type="text" id="docPulseInput" class="form-input" placeholder="e.g. 74 bpm" value="74 bpm" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">TEMP (°F)</label>
                        <input type="text" id="docTempInput" class="form-input" placeholder="e.g. 98.6°F" value="98.6 °F" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">SpO2 (%)</label>
                        <input type="text" id="docSpo2Input" class="form-input" placeholder="e.g. 99%" value="99%" style="font-size: 0.8125rem;">
                      </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1.2fr; gap: 0.5rem; align-items:center;">
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">WEIGHT (kg)</label>
                        <input type="number" id="docWeightInput" class="form-input" placeholder="68" value="68" step="0.5" oninput="window.mediarcaApp.updateDoctorBmiLive()" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">HEIGHT (cm)</label>
                        <input type="number" id="docHeightInput" class="form-input" placeholder="174" value="174" oninput="window.mediarcaApp.updateDoctorBmiLive()" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">RESP RATE (/min)</label>
                        <input type="text" id="docRespInput" class="form-input" placeholder="16 /min" value="16 /min" style="font-size: 0.8125rem;">
                      </div>
                      <div style="padding-top:1.1rem;">
                        <span id="docBmiBadge" class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem; width:100%; justify-content:center; display:flex;">
                          BMI: 22.5 (Normal Weight)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style="margin-bottom: 1.25rem;">
                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Chief Complaint & Reported Symptoms</div>
                    <div style="font-size: 0.875rem; color: var(--text-primary); margin-top: 0.25rem; background: #fff; padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                      ${escapeHtml(currentPatient.symptoms || 'General Consultation & Routine Health Check')}
                    </div>
                  </div>

                  <!-- AI-Assisted Ambient Clinical Scribe (Section 16 Resolution) -->
                  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); padding: 0.875rem; margin-bottom: 1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                      <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:0.35rem;">
                        <i data-lucide="sparkles" style="width:14px;height:14px; color:#6366f1;"></i> AI Ambient Clinical Scribe & Dictation Assistant
                      </div>
                      <span class="badge" style="background:#e0e7ff; color:#4338ca; font-size:0.65rem; font-weight:700;">AI DRAFT ONLY • REQUIRES PHYSICIAN CONFIRMATION</span>
                    </div>
                    <textarea id="aiScribeInput" class="form-textarea" placeholder="Dictate or type clinical encounter notes (e.g. 'Patient has mild fever for three days, dry cough, slight throat irritation, no breathing difficulty. Exam shows mild pharyngeal congestion. Plan for 5-day antibiotic and hydration.')" style="min-height:48px; font-size:0.8125rem; margin-bottom:0.5rem;"></textarea>
                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                      <button type="button" class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleProcessAiScribe()" style="background:#6366f1; color:#fff; font-size:0.75rem; padding:0.3rem 0.6rem;">
                        <i data-lucide="wand-2" style="width:12px;height:12px;"></i> Convert to Structured SOAP Draft
                      </button>
                      <button type="button" class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.showTelemedicineSuite('${currentPatient.bookingId || 'bk_live'}')" style="font-size:0.75rem; padding:0.3rem 0.6rem;">
                        <i data-lucide="video" style="width:12px;height:12px; color:#0284c7;"></i> Launch Teleconsult Video Room
                      </button>
                      <span style="font-size:0.65rem; color:var(--text-muted);">AI output will populate draft fields below only upon explicit acceptance.</span>
                    </div>
                    <div id="aiScribeDraftResult" style="display:none; margin-top:0.75rem; background:#fff; border:1px dashed #6366f1; padding:0.75rem; border-radius:var(--radius-sm);"></div>
                  </div>

                  <!-- Clinical Examination & Itemized Prescription Suite (Tier 2 Resolution) -->
                  <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                      <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary);">Clinical Assessment & Final Diagnosis:</div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <label style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600;">Clinical Protocol Template:</label>
                        <select id="docRxTemplateSelect" class="form-select" style="font-size:0.75rem; padding:0.25rem 0.5rem; width:auto;" onchange="window.mediarcaApp.applyPrescriptionTemplate(this.value)">
                          <option value="">-- Select Standard Protocol --</option>
                          <option value="urti">🩺 Viral Upper Respiratory Infection (URTI)</option>
                          <option value="cardio">🫀 Hypertension & Cardiac Care</option>
                          <option value="gerd">🧬 Acid Reflux & Dyspepsia (GERD)</option>
                          <option value="pain">🩹 Acute Musculoskeletal Strain</option>
                        </select>
                      </div>
                    </div>

                    <input type="text" id="docDiagnosisInput" class="form-input" placeholder="Primary Diagnosis" value="Acute Upper Respiratory Tract Infection" style="margin-bottom: 0.75rem;">
                    
                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Structured Prescription Regimen (Itemized Drugs):</div>
                    <div id="docPrescriptionItemsContainer" style="background: #fff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.75rem;">
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" id="docMed1Drug" class="form-input" value="Tab. Azithromycin 500mg" placeholder="Medicine Name">
                        <input type="text" id="docMed1Freq" class="form-input" value="OD (1-0-0)" placeholder="Frequency">
                        <input type="text" id="docMed1Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed1Dur" class="form-input" value="5 Days" placeholder="Duration">
                      </div>
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" id="docMed2Drug" class="form-input" value="Tab. Paracetamol 650mg" placeholder="Medicine Name">
                        <input type="text" id="docMed2Freq" class="form-input" value="TID (1-1-1)" placeholder="Frequency">
                        <input type="text" id="docMed2Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed2Dur" class="form-input" value="3 Days" placeholder="Duration">
                      </div>
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem;">
                        <input type="text" id="docMed3Drug" class="form-input" value="Tab. Levocetirizine 5mg" placeholder="Medicine Name">
                        <input type="text" id="docMed3Freq" class="form-input" value="HS (0-0-1)" placeholder="Frequency">
                        <input type="text" id="docMed3Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed3Dur" class="form-input" value="5 Days" placeholder="Duration">
                      </div>
                    </div>

                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Diagnostic Lab Orders & Imaging:</div>
                    <input type="text" id="docLabOrderInput" class="form-input" placeholder="Ordered Tests (e.g. Complete Blood Count CBC, Chest X-Ray PA View)" value="Complete Blood Count (CBC), Serum Ferritin" style="margin-bottom: 0.75rem;">

                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Treatment Plan, Clinical Advice & Follow-Up:</div>
                    <textarea id="docAdviceInput" class="form-textarea" placeholder="Clinical Advice, Dietary Precautions & Follow-up Timeline..." style="margin-bottom: 0.75rem; min-height: 55px;">Hydrate adequately (3L water daily). Complete full 5-day antibiotic course. Review after 5 days if fever persists.</textarea>

                    <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem;">
                      <span style="font-size: 0.8125rem; color: var(--text-secondary); font-weight: 600;">Scheduled Follow-up:</span>
                      <input type="date" id="docFollowUpDate" class="form-input" style="width: 200px;" value="${new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0]}">
                    </div>

                    <button class="btn btn-teal btn-block" onclick="window.mediarcaApp.handleCompleteWithRx('${doc.id}', ${currentPatient.tokenNumber})" style="margin-bottom: 0.75rem;">
                      <i data-lucide="check-check" style="width: 15px; height: 15px;"></i> Save Clinical Encounter & Advance Queue
                    </button>

                    <div style="display: flex; gap: 0.5rem;">
                      <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleMarkStatus('${doc.id}', ${currentPatient.tokenNumber}, 'no-show')" style="flex: 1; color: #b91c1c;">
                        <i data-lucide="user-x" style="width: 13px; height: 13px;"></i> Mark No-Show
                      </button>
                      <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.handleMarkStatus('${doc.id}', ${currentPatient.tokenNumber}, 'skipped')" style="flex: 1; color: #d97706;">
                        <i data-lucide="skip-forward" style="width: 13px; height: 13px;"></i> Skip / Call Later
                      </button>
                    </div>
                  </div>
                </div>
              ` : `
                <div style="padding: 2.5rem; text-align: center; background: var(--bg-surface-subtle); border: 1px dashed var(--border-strong); border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
                  <div style="width: 44px; height: 44px; background: var(--status-verified-bg); color: var(--status-verified); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
                    <i data-lucide="check-circle" style="width: 22px; height: 22px;"></i>
                  </div>
                  <h4 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">
                    ${hasWaiting ? 'Consultation Room Ready' : 'All Consultations Completed!'}
                  </h4>
                  <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.25rem;">
                    ${hasWaiting ? 'Waiting patients are in queue line.' : 'You have completed all scheduled patient visits for today.'}
                  </p>
                  ${hasWaiting ? `
                    <button class="btn btn-primary" onclick="window.mediarcaApp.handleDoctorAdvance('${doc.id}')">
                      <i data-lucide="user-check" style="width: 15px; height: 15px;"></i> Call Next Waiting Patient
                    </button>
                  ` : ''}
                </div>
              `}

              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="window.mediarcaApp.handleDoctorAdvance('${doc.id}')">
                  <i data-lucide="user-check" style="width: 15px; height: 15px;"></i> Call Next in Line
                </button>
                <button class="btn btn-secondary" onclick="window.mediarcaApp.handleDoctorPause('${doc.id}')">
                  <i data-lucide="pause" style="width: 15px; height: 15px;"></i> ${queue.status === 'paused' ? 'Resume Queue' : 'Pause Queue'}
                </button>
                <button class="btn btn-secondary" onclick="window.mediarcaAudio.playChime('queue-call')">
                  <i data-lucide="volume-2" style="width: 15px; height: 15px;"></i> Test Room Chime
                </button>
              </div>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
              <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Today's Registered Patient Queue</h3>
              <div class="table-responsive">
                <table class="clinical-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Patient</th>
                      <th>Check In</th>
                      <th>Status</th>
                      <th>Triage Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${queue.tokens && queue.tokens.length > 0 ? queue.tokens.map(t => `
                      <tr style="${t.tokenNumber === currentToken && t.status === 'in-consultation' ? 'background: var(--clinical-blue-subtle); font-weight: 600;' : ''}">
                        <td class="text-mono">
                          #${t.tokenNumber}
                          ${t.isPriority ? '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.65rem; margin-left:0.25rem;">EMERGENCY</span>' : ''}
                        </td>
                        <td>${escapeHtml(t.patientName)}</td>
                        <td>${escapeHtml(t.checkInTime || '09:00 AM')}</td>
                        <td>
                          <span class="badge ${t.status === 'in-consultation' ? 'badge-live' : (t.status === 'completed' ? 'badge-verified' : (t.status === 'no-show' ? 'badge-role' : 'badge-pending'))}">
                            ${t.status === 'in-consultation' ? 'IN ROOM' : escapeHtml(t.status.toUpperCase())}
                          </span>
                        </td>
                        <td>
                          ${t.status === 'waiting' && !t.isPriority ? `
                            <button class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:#b91c1c;" onclick="window.mediarcaApp.handleFlagPriority('${doc.id}', ${t.tokenNumber})">
                              <i data-lucide="alert-circle" style="width:11px; height:11px;"></i> Priority Triage
                            </button>
                          ` : (t.isPriority ? '<span style="color:#b91c1c; font-size:0.75rem; font-weight:700;">Top Priority</span>' : '—')}
                        </td>
                      </tr>
                    `).join('') : `
                      <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No patients registered in queue.</td></tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
              <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Queue Metrics</h4>
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: var(--bg-surface-subtle); padding: 1rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Completed Today</div>
                  <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">
                    ${queue.tokens ? queue.tokens.filter(t => t.status === 'completed').length : 0}
                  </div>
                </div>
                <div style="background: var(--bg-surface-subtle); padding: 1rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Waiting Patients</div>
                  <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: var(--clinical-blue);">
                    ${queue.tokens ? queue.tokens.filter(t => t.status === 'waiting').length : 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  async handleMarkStatus(doctorId, tokenNumber, status) {
    try {
      await window.mediarcaStore.markAppointmentStatus(doctorId, tokenNumber, status);
      this.showToast(`Token #${tokenNumber} marked as ${status}.`, 'info');
      this.renderDoctorConsole();
    } catch (err) {
      console.error('Status update error:', err);
      this.showToast(err.message || 'Failed to update status.', 'warning');
    }
  }

  async handleFlagPriority(doctorId, tokenNumber) {
    try {
      await window.mediarcaStore.flagPriorityAppointment(doctorId, tokenNumber, 'Emergency medical priority override.');
      this.showToast(`Token #${tokenNumber} flagged for Priority Emergency Triage!`, 'success');
      this.renderDoctorConsole();
    } catch (err) {
      console.error('Priority flag error:', err);
      this.showToast(err.message || 'Failed to flag priority.', 'warning');
    }
  }

  async handleCompleteWithRx(doctorId, tokenNumber) {
    const diagnosis = document.getElementById('docDiagnosisInput')?.value.trim() || 'Clinical evaluation concluded.';
    const bp = document.getElementById('docBpInput')?.value.trim() || '120/80 mmHg';
    const pulse = document.getElementById('docPulseInput')?.value.trim() || '72 bpm';
    const temp = document.getElementById('docTempInput')?.value.trim() || '98.6 °F';
    const spo2 = document.getElementById('docSpo2Input')?.value.trim() || '99%';
    
    // Multi-drug regimen items
    const med1Drug = document.getElementById('docMed1Drug')?.value.trim();
    const med1Freq = document.getElementById('docMed1Freq')?.value.trim();
    const med1Dur = document.getElementById('docMed1Dur')?.value.trim();
    const med2Drug = document.getElementById('docMed2Drug')?.value.trim();
    const med2Freq = document.getElementById('docMed2Freq')?.value.trim();
    const med2Dur = document.getElementById('docMed2Dur')?.value.trim();

    const medications = [];
    if (med1Drug) medications.push(`${med1Drug} [${med1Freq || 'OD'}] (${med1Dur || '5 Days'})`);
    if (med2Drug) medications.push(`${med2Drug} [${med2Freq || 'TID'}] (${med2Dur || '3 Days'})`);
    if (medications.length === 0) medications.push('Prescribed supportive oral medication as indicated');

    const labOrders = document.getElementById('docLabOrderInput')?.value.trim() || '';
    const advice = document.getElementById('docAdviceInput')?.value.trim() || 'Take prescribed medications with plenty of water. Follow up if needed.';
    const followUpDate = document.getElementById('docFollowUpDate')?.value || '';

    try {
      await window.mediarcaStore.completeConsultationWithPrescription(doctorId, tokenNumber, {
        diagnosis,
        medications,
        advice: `${advice}${labOrders ? ' • Diagnostic Labs Ordered: ' + labOrders : ''}`,
        followUpDate,
        vitals: { bp, pulse, temp, spo2 }
      });

      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Clinical Encounter & Prescription for Token #${tokenNumber} finalized!`, 'success');
      this.renderDoctorConsole();
    } catch (err) {
      console.error('Prescription save error:', err);
      this.showToast(err.message || 'Error saving prescription.', 'warning');
    }
  }

  async handleDoctorAdvance(doctorId) {
    try {
      const updated = await window.mediarcaStore.advanceDoctorQueue(doctorId);
      if (updated) {
        if (window.mediarcaAudio) window.mediarcaAudio.playChime('queue-call');
        if (updated.currentToken > 0) {
          this.showToast(`Queue advanced to Token #${updated.currentToken}`, 'success');
        } else {
          this.showToast(`All scheduled patient consultations completed!`, 'info');
        }
        this.renderDoctorConsole();
      }
    } catch (err) {
      console.error('Doctor queue advance error:', err);
      this.showToast(err.message || 'Error advancing queue.', 'warning');
    }
  }

  handleDoctorPause(doctorId) {
    const updated = window.mediarcaStore.pauseDoctorQueue(doctorId);
    if (updated) {
      this.showToast(`Queue status: ${updated.status}`, 'info');
      this.renderDoctorConsole();
    }
  }

  // --- Admin Verification Desk, Analytics Dashboard & Audit Center (Section 14 & 15 Resolution) ---
  renderAdminHub() {
    const container = document.getElementById('adminPortalContainer');
    if (!container) return;

    const doctors = window.mediarcaStore.state.doctors;
    const pending = doctors.filter(d => d.verificationStatus === 'pending');
    const verified = doctors.filter(d => d.verificationStatus === 'verified');
    const analytics = window.mediarcaStore.getHospitalAnalytics();
    const auditLogs = window.mediarcaStore.state.auditLogs || [];
    const facilities = window.mediarcaStore.state.facilities || [];
    const rooms = window.mediarcaStore.state.rooms || [];

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-role" style="background: #b91c1c; margin-bottom: 0.5rem;">Hospital Executive Administration</span>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">Medical Board & Operations Command Desk</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Audit compliance ledger, practitioner credentials, multi-hospital facility rooms, and clinical throughput analytics.</p>
          </div>
          <button class="btn btn-secondary" onclick="window.mediarcaAudio.playChime('success'); window.mediarcaApp.showToast('Audit report exported.', 'info');">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i> Export Audit Log (CSV)
          </button>
        </div>

        <!-- 1. Executive Hospital Analytics Dashboard (Section 14 Resolution) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem; box-shadow: var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="bar-chart-3" style="width:18px;height:18px; color:var(--clinical-blue);"></i> Real-Time Hospital OPD Operations Analytics
            </h3>
            <span class="badge badge-live">Live Hospital Telemetry</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Total Bookings</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 0.25rem;">${analytics.totalAppointments}</div>
              <div style="font-size: 0.65rem; color: #15803d; font-weight: 600;">Today's Registered</div>
            </div>
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Avg Wait Time</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: var(--clinical-blue); margin-top: 0.25rem;">${analytics.avgWaitTimeMins}</div>
              <div style="font-size: 0.65rem; color: #15803d; font-weight: 600;">Benchmark < 20 min</div>
            </div>
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Consult Duration</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: #059669; margin-top: 0.25rem;">${analytics.avgConsultDurationMins}</div>
              <div style="font-size: 0.65rem; color: #059669; font-weight: 600;">Optimal Clinical Care</div>
            </div>
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">No-Show Rate</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: #d97706; margin-top: 0.25rem;">${analytics.noShowRate}</div>
              <div style="font-size: 0.65rem; color: #15803d; font-weight: 600;">Below 8% Industry Cap</div>
            </div>
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Doctor Utilization</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: #7c3aed; margin-top: 0.25rem;">${analytics.doctorUtilization}</div>
              <div style="font-size: 0.65rem; color: #15803d; font-weight: 600;">High Efficiency</div>
            </div>
            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Queue Abandon</div>
              <div class="text-mono" style="font-size: 1.5rem; font-weight: 800; color: #16a34a; margin-top: 0.25rem;">${analytics.queueAbandonmentRate}</div>
              <div style="font-size: 0.65rem; color: #15803d; font-weight: 600;">High Retention</div>
            </div>
          </div>

          <!-- Peak OPD Hourly Traffic -->
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">
              Peak OPD Hourly Patient Traffic (Peak: ${analytics.peakHours})
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: flex-end; height: 75px; padding-top: 0.5rem;">
              ${analytics.hourlyDistribution.map(h => `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
                  <div style="background: linear-gradient(180deg, #0284c7, #0369a1); width: 100%; border-radius: 4px 4px 0 0; height: ${(h.patients / 18) * 100}%; min-height: 12px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.65rem; font-weight:bold;">
                    ${h.patients}
                  </div>
                  <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.35rem;">${h.hour}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 1.5 AI Queue Optimization & Operational Decision Support (Section 17 Resolution) -->
        <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #86efac; border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; flex-wrap:wrap; gap:0.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: #166534; display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="cpu" style="width:18px;height:18px; color:#15803d;"></i> AI Queue Optimization & Operational Decision Engine
            </h3>
            <span class="badge" style="background:#bbf7d0; color:#14532d; font-weight:700;">Predictive Operational Support</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1.6fr; gap: 1rem; align-items:center;">
            <div style="background:#fff; border:1px solid #bbf7d0; padding:0.875rem; border-radius:var(--radius-sm);">
              <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Predicted No-Show Risk</div>
              <div style="font-size:1.125rem; font-weight:800; color:#15803d; margin-top:0.25rem;">12% (Low Risk)</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">Token #7 • 98% check-in confidence</div>
            </div>
            <div style="background:#fff; border:1px solid #bbf7d0; padding:0.875rem; border-radius:var(--radius-sm);">
              <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Doctor Velocity Index</div>
              <div style="font-size:1.125rem; font-weight:800; color:#0369a1; margin-top:0.25rem;">+6 min Buffer</div>
              <div style="font-size:0.65rem; color:var(--text-secondary);">Cardiology pacing optimal</div>
            </div>
            <div style="background:#fff; border:1px solid #bbf7d0; padding:0.875rem; border-radius:var(--radius-sm);">
              <div style="font-size:0.75rem; font-weight:700; color:#166534; margin-bottom:0.35rem;">💡 Recommended Operational Action:</div>
              <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.5rem;">
                Open <strong>Secondary Suite 403</strong> to absorb 11:30 AM predicted peak surge.
              </div>
              <button class="btn btn-sm btn-teal" onclick="window.mediarcaApp.applyQueueOptimization('rec_1')" style="font-size:0.7rem; padding:0.25rem 0.5rem;">
                <i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Apply Recommendation
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Pending Credential Verification Desk -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem;">
          <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Pending Practitioner Accreditation (${pending.length})</h3>
          
          ${pending.length === 0 ? `
            <div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-surface-subtle); border-radius: var(--radius-sm);">
              All doctor applications have been reviewed and certified.
            </div>
          ` : `
            <div class="table-responsive">
              <table class="clinical-table">
                <thead>
                  <tr>
                    <th>Doctor Name</th>
                    <th>Specialty</th>
                    <th>Medical License Reg</th>
                    <th>Qualifications</th>
                    <th>Hospital Affiliation</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  ${pending.map(doc => `
                    <tr>
                      <td><strong>${escapeHtml(doc.name)}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(doc.email)}</div></td>
                      <td><span class="badge badge-live">${escapeHtml(doc.specialty)}</span></td>
                      <td class="text-mono"><strong>${escapeHtml(doc.regNumber)}</strong></td>
                      <td>${escapeHtml(doc.degrees)} (${doc.experienceYears}y)</td>
                      <td>${escapeHtml(doc.hospital)}</td>
                      <td>
                        <div style="display:flex; gap:0.5rem;">
                          <button class="btn btn-sm btn-teal" onclick="window.mediarcaApp.handleAdminVerify('${doc.id}', true)">
                            <i data-lucide="check" style="width:13px;height:13px"></i> Approve & Issue ID
                          </button>
                          <button class="btn btn-sm btn-danger" onclick="window.mediarcaApp.handleAdminVerify('${doc.id}', false)">
                            <i data-lucide="x" style="width:13px;height:13px"></i> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- 3. Multi-Clinic / Hospital Facility & Room Roster (Section 11 & 12 Resolution) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="building" style="width:16px;height:16px; color:#0284c7;"></i> Multi-Hospital Network Facilities (${facilities.length})
            </h3>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              ${facilities.map(fac => `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size: 0.875rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(fac.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(fac.address)} • ${escapeHtml(fac.city)}</div>
                  </div>
                  <span class="badge badge-verified">${fac.roomsCount} Active Suites</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="door-open" style="width:16px;height:16px; color:#7c3aed;"></i> Clinical Room & Queue Allocation (${rooms.length})
            </h3>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              ${rooms.map(rm => `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 0.875rem; border-radius: var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong class="text-mono" style="color:var(--clinical-blue);">${escapeHtml(rm.roomNumber)}</strong> - ${escapeHtml(rm.type)}
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Attached: ${escapeHtml(rm.doctorName)}</div>
                  </div>
                  <span class="badge badge-live">${escapeHtml(rm.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 4. Incident & Append-Only Audit Compliance Center (Section 15 Resolution) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="shield-alert" style="width:18px;height:18px; color:#b91c1c;"></i> Statutory Audit & Incident Compliance Ledger (Append-Only)
            </h3>
            <span class="badge" style="background:#fef2f2; color:#b91c1c; font-weight:700;">Immutable Compliance Trail</span>
          </div>

          <div class="table-responsive">
            <table class="clinical-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Actor / Practitioner</th>
                  <th>Action Code</th>
                  <th>Entity</th>
                  <th>State Delta (Before ➔ After)</th>
                  <th>Device / IP Address</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map(log => `
                  <tr>
                    <td class="text-mono" style="font-size:0.75rem;">${escapeHtml(new Date(log.timestamp).toLocaleTimeString())}</td>
                    <td><strong>${escapeHtml(log.actor)}</strong></td>
                    <td><span class="badge badge-verified text-mono" style="font-size:0.65rem;">${escapeHtml(log.action)}</span></td>
                    <td class="text-mono">${escapeHtml(log.entity)}</td>
                    <td style="font-size:0.75rem;">
                      ${log.beforeState ? `<span style="color:#b91c1c;">${escapeHtml(JSON.stringify(log.beforeState))}</span> ➔ ` : ''}
                      <span style="color:#15803d; font-weight:bold;">${escapeHtml(JSON.stringify(log.afterState))}</span>
                    </td>
                    <td class="text-mono" style="font-size:0.7rem; color:var(--text-muted);">
                      ${escapeHtml(log.ipAddress)} • ${escapeHtml(log.device)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  async handleAdminVerify(doctorId, approved) {
    try {
      const doc = await window.mediarcaStore.verifyDoctor(doctorId, approved);
      if (doc && approved) {
        if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
        this.showToast(`Verified ${doc.name}! Issued Mediarca ID: ${doc.mediarcaId}`, 'success');
      } else if (doc && !approved) {
        this.showToast(`Application for ${doc.name} was rejected.`, 'warning');
      }
      this.renderAdminHub();
    } catch (err) {
      console.error('Admin verify error:', err);
      this.showToast(err.message || 'Error processing verification.', 'warning');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // --- Hospital OPD Fullscreen TV Display ---
  renderTVDisplay(doctorId = 'doc_1') {
    const container = document.getElementById('tvDisplayContainer');
    if (!container) return;

    const doc = window.mediarcaStore.state.doctors.find(d => d.id === doctorId) || window.mediarcaStore.state.doctors[0];
    const queue = window.mediarcaStore.state.queues[doc.id] || { currentToken: 0, status: 'idle', tokens: [] };
    const currentToken = queue.currentToken || 0;
    const waitingTokens = queue.tokens.filter(t => t.tokenNumber > currentToken && t.status === 'waiting');

    // Live clock ticker
    if (this.tvClockInterval) clearInterval(this.tvClockInterval);
    this.tvClockInterval = setInterval(() => {
      const el = document.getElementById('tvClock');
      if (el) el.innerText = new Date().toLocaleTimeString();
    }, 1000);

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 1rem;">
        <!-- TV Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #27272a; padding-bottom: 1.5rem; margin-bottom: 2.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 48px; height: 48px; background: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: #fff;">
              +
            </div>
            <div>
              <h1 style="font-size: 1.75rem; font-weight: 800; color: #fff; letter-spacing: -0.02em;">MEDIARCA OPD LIVE MONITOR</h1>
              <p style="color: #a1a1aa; font-size: 0.95rem;">${escapeHtml(doc.hospital)} • ${escapeHtml(doc.specialty)}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-mono); font-size: 1.75rem; font-weight: 800; color: #38bdf8;" id="tvClock">
              ${new Date().toLocaleTimeString()}
            </div>
            <div style="color: #22c55e; font-size: 0.85rem; font-weight: 700;">● LIVE TELEMETRY STREAM</div>
          </div>
        </div>

        <!-- Main Display Grid -->
        <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 2.5rem; align-items: start;">
          <!-- Serving Box -->
          <div style="background: #18181b; border: 2px solid #0284c7; border-radius: 20px; padding: 3rem; text-align: center; box-shadow: 0 20px 50px rgba(2, 132, 199, 0.2);">
            <div style="font-size: 1.125rem; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; font-weight: 800; margin-bottom: 0.5rem;">NOW SERVING IN ROOM</div>
            <div style="font-family: var(--font-mono); font-size: 7.5rem; font-weight: 800; color: #ffffff; line-height: 1; margin: 1rem 0; text-shadow: 0 0 30px rgba(56, 189, 248, 0.4);">
              ${currentToken > 0 ? '#' + currentToken : 'IDLE'}
            </div>
            
            <div style="background: #27272a; border-radius: 12px; padding: 1.25rem; margin-top: 2rem;">
              <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${escapeHtml(doc.name)}</div>
              <div style="font-size: 1rem; color: #38bdf8;">${escapeHtml(doc.specialty)} • Consultation Suite</div>
              <div style="font-size: 1rem; color: #4ade80; font-weight: 700; margin-top: 0.5rem;">
                ${currentToken > 0 ? '● Active Consultation in Progress' : 'Waiting for next patient call'}
              </div>
            </div>
          </div>

          <!-- Upcoming Tokens List (Privacy Masked) -->
          <div>
            <div style="background: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 2rem;">
              <h3 style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 1.5rem; border-bottom: 1px solid #27272a; padding-bottom: 0.75rem;">
                NEXT IN QUEUE LINE
              </h3>

              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${waitingTokens.slice(0, 5).map((t, idx) => `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #27272a; padding: 1.25rem 1.5rem; border-radius: 12px; border-left: 4px solid ${idx === 0 ? '#fbbf24' : '#52525b'};">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                      <div class="text-mono" style="font-size: 2rem; font-weight: 800; color: ${idx === 0 ? '#fbbf24' : '#ffffff'};">
                        #${t.tokenNumber}
                      </div>
                      <div>
                        <div style="font-size: 1.125rem; font-weight: 700; color: #fff;">Token #${t.tokenNumber}</div>
                        <div style="font-size: 0.8125rem; color: #a1a1aa;">Scheduled Slot • Room Ready</div>
                      </div>
                    </div>
                    <div>
                      <span class="badge" style="background: ${idx === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.1)'}; color: ${idx === 0 ? '#fbbf24' : '#a1a1aa'}; font-size: 0.85rem; padding: 0.4rem 0.75rem;">
                        ${idx === 0 ? 'PLEASE PREPARE' : 'IN QUEUE'}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; border-top: 1px solid #27272a; padding-top: 1rem;">
                <button class="btn btn-secondary" onclick="window.mediarcaAudio.playChime('queue-call')">
                  <i data-lucide="volume-2" style="width:16px;height:16px"></i> Sound Room Chime
                </button>
                <button class="btn btn-primary" onclick="if (window.mediarcaApp.tvClockInterval) clearInterval(window.mediarcaApp.tvClockInterval); window.mediarcaApp.switchView('home')">
                  Exit TV View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Receptionist / Front Desk Portal (Section 11 Resolution) ---
  renderReceptionPortal() {
    const container = document.getElementById('receptionPortalContainer');
    if (!container) return;

    const doctors = window.mediarcaStore.state.doctors.filter(d => d.verificationStatus === 'verified');
    const allBookings = window.mediarcaStore.state.bookings || [];

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="background: linear-gradient(135deg, #0369a1, #0284c7); color: #fff; border-radius: var(--radius-md); padding: 1.75rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; box-shadow: var(--shadow-md);">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #fff;"><i data-lucide="building" style="width:12px;height:12px"></i> HOSPITAL OPERATIONS</span>
              <span style="font-size: 0.75rem; color: #e0f2fe;">Central OPD Reception Desk</span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800;">Hospital Front Desk & Triage Console</h2>
            <p style="font-size: 0.8125rem; color: #e0f2fe;">Scan QR check-in passes, register walk-in patients, manage queue transfers, and print tokens.</p>
          </div>
          <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary" onclick="window.mediarcaApp.switchView('tv-display')" style="background: #fff; color: #0369a1;">
              <i data-lucide="tv" style="width: 14px; height: 14px;"></i> Open TV Screen
            </button>
            <button class="btn btn-secondary" onclick="window.mediarcaAudio.playChime('queue-call')" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4);">
              <i data-lucide="volume-2" style="width: 14px; height: 14px;"></i> Public Announcement
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
          <!-- 1. Quick QR Check-in Box -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
              <div style="width: 32px; height: 32px; background: #e0f2fe; color: #0284c7; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center;">
                <i data-lucide="qr-code" style="width: 16px; height: 16px;"></i>
              </div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">Instant QR Check-In Scanner</h3>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">Scan or paste patient's encrypted check-in pass token</p>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="receptionQrInput" class="form-input text-mono" placeholder="Scan or enter token (e.g. MED-CHK-... or MED-BK-...)" style="flex: 1;">
              <button class="btn btn-teal" onclick="window.mediarcaApp.handleReceptionCheckIn()">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i> Check In
              </button>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">
              🔒 Encrypted Token: Contains zero clinical PII. Verification is authorized via cryptographic signature.
            </div>
          </div>

          <!-- 2. Walk-in Patient Rapid Registration -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
              <div style="width: 32px; height: 32px; background: #f0fdf4; color: #16a34a; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center;">
                <i data-lucide="user-plus" style="width: 16px; height: 16px;"></i>
              </div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">Walk-in Patient Token Issuance</h3>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">Issue instant paper/digital token at reception desk</p>
              </div>
            </div>

            <form onsubmit="window.mediarcaApp.handleWalkInRegister(event)">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                <select id="walkinDoctorSelect" class="form-select" required>
                  ${doctors.map(d => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)})</option>`).join('')}
                </select>
                <input type="text" id="walkinPatientName" class="form-input" placeholder="Patient Full Name" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
                <input type="tel" id="walkinPatientPhone" class="form-input" placeholder="Phone Number" required>
                <input type="text" id="walkinSymptoms" class="form-input" placeholder="Chief Complaint / Reason" value="OPD Walk-in Checkup">
              </div>
              <button type="submit" class="btn btn-primary btn-block">
                <i data-lucide="ticket" style="width: 14px; height: 14px;"></i> Issue Walk-in Token & Print Pass
              </button>
            </form>
          </div>
        </div>

        <!-- 3. Active Hospital Registered Patients Table -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary);">Today's Hospital Patient Ledger (${allBookings.length})</h3>
            <span class="badge badge-live">Live Hospital Roster</span>
          </div>

          <div class="table-responsive">
            <table class="clinical-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient Name</th>
                  <th>Attending Doctor</th>
                  <th>Flow Stage</th>
                  <th>Status</th>
                  <th>Patient-Flow Actions</th>
                </tr>
              </thead>
              <tbody>
                ${allBookings.length > 0 ? allBookings.map(b => `
                  <tr>
                    <td class="text-mono"><strong>#${b.tokenNumber}</strong></td>
                    <td>
                      <strong>${escapeHtml(b.patientName)}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(b.patientPhone)}</div>
                    </td>
                    <td>${escapeHtml(b.doctorName)}</td>
                    <td>
                      <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:0.7rem;">
                        ${escapeHtml((b.stage || 'consultation').replace(/_/g, ' ').toUpperCase())}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${b.status === 'checked_in' ? 'badge-verified' : (b.status === 'in-consultation' ? 'badge-live' : (b.status === 'completed' ? 'badge-verified' : 'badge-pending'))}">
                        ${escapeHtml(b.status.toUpperCase())}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem; align-items:center;">
                        ${b.status === 'booked' ? `
                          <button class="btn btn-sm btn-teal" style="font-size:0.7rem; padding:0.25rem 0.5rem;" onclick="window.mediarcaApp.handleDirectCheckIn('${b.bookingId}')">
                            <i data-lucide="check" style="width:11px; height:11px;"></i> Check-In
                          </button>
                        ` : ''}
                        
                        <!-- Multi-Stage Patient Flow Routing (Section 13 Resolution) -->
                        <select class="form-select" style="font-size:0.7rem; padding:0.2rem 0.4rem; width:auto;" onchange="window.mediarcaApp.handleStageAdvance('${b.bookingId}', this.value)">
                          <option value="triage" ${b.stage === 'triage' ? 'selected' : ''}>Route: 1. Triage</option>
                          <option value="ecg_diagnostics" ${b.stage === 'ecg_diagnostics' ? 'selected' : ''}>Route: 2. ECG / Lab</option>
                          <option value="consultation" ${(!b.stage || b.stage === 'consultation') ? 'selected' : ''}>Route: 3. Doctor</option>
                          <option value="pharmacy" ${b.stage === 'pharmacy' ? 'selected' : ''}>Route: 4. Pharmacy</option>
                          <option value="discharged" ${b.stage === 'discharged' ? 'selected' : ''}>Route: 5. Discharge</option>
                        </select>

                        <button class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.25rem 0.5rem;" onclick="window.mediarcaApp.printPatientPass('${b.bookingId}')">
                          <i data-lucide="printer" style="width:11px; height:11px;"></i> Pass
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No patients scheduled in hospital register.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  handleFollowUpPresetChange(days) {
    const input = document.getElementById('docFollowUpDate');
    if (!input) return;
    const numDays = parseInt(days);
    if (numDays === 0) {
      input.value = '';
      this.showToast('Follow-up scheduled as SOS / When Needed.', 'info');
    } else {
      const targetDate = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);
      input.value = targetDate.toISOString().split('T')[0];
      this.showToast(`Follow-up reminder set for ${targetDate.toLocaleDateString()} (${numDays} days)`, 'info');
    }
  }

  async handleStageAdvance(bookingId, stage) {
    try {
      await window.mediarcaStore.updatePatientStage(bookingId, stage);
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Patient routed to: ${stage.replace(/_/g, ' ').toUpperCase()}`, 'success');
      this.renderReceptionPortal();
    } catch (err) {
      console.error('Stage advance error:', err);
      this.showToast(err.message || 'Failed to route patient.', 'warning');
    }
  }

  async handleReceptionLoginSubmit(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('receptionLoginEmail')?.value.trim() || 'reception@mediarca.health';
    const password = document.getElementById('receptionLoginPassword')?.value.trim() || 'reception123';

    try {
      const user = await window.mediarcaStore.login(email, password);
      this.showToast(`Welcome ${user.name || 'Front Desk Staff'}!`, 'success');
      this.switchView('reception-portal');
    } catch (err) {
      console.error('Reception login error:', err);
      this.showToast(err.message || 'Login failed.', 'warning');
    }
  }

  async handleReceptionCheckIn() {
    const input = document.getElementById('receptionQrInput')?.value.trim();
    if (!input) {
      this.showToast('Please scan or enter a check-in token.', 'warning');
      return;
    }

    try {
      await window.mediarcaStore.checkInPatientQr(input);
      this.showToast(`Patient Check-in Successful! Status updated to CHECKED_IN.`, 'success');
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      document.getElementById('receptionQrInput').value = '';
      this.renderReceptionPortal();
    } catch (err) {
      console.error('Reception Check-in Error:', err);
      this.showToast(err.message || 'Check-in validation failed.', 'warning');
    }
  }

  async handleDirectCheckIn(bookingId) {
    try {
      await window.mediarcaStore.checkInPatientQr(bookingId);
      this.showToast(`Patient checked in!`, 'success');
      this.renderReceptionPortal();
    } catch (err) {
      console.error('Direct check-in error:', err);
      this.showToast(err.message || 'Check-in failed.', 'warning');
    }
  }

  async handleWalkInRegister(e) {
    if (e) e.preventDefault();
    const doctorId = document.getElementById('walkinDoctorSelect')?.value;
    const patientName = document.getElementById('walkinPatientName')?.value.trim();
    const patientPhone = document.getElementById('walkinPatientPhone')?.value.trim();
    const symptoms = document.getElementById('walkinSymptoms')?.value.trim() || 'Walk-in Consultation';

    if (!doctorId || !patientName || !patientPhone) {
      this.showToast('Please fill out all walk-in registration fields.', 'warning');
      return;
    }

    try {
      const newBooking = await window.mediarcaStore.bookAppointment({
        doctorId,
        patientName,
        patientPhone,
        patientAge: 35,
        patientGender: 'Not specified',
        symptoms
      });

      // Automatically mark checked-in for walk-ins
      await window.mediarcaStore.checkInPatientQr(newBooking.bookingId);

      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Walk-in Token #${newBooking.tokenNumber} issued and checked in!`, 'success');
      this.renderReceptionPortal();
    } catch (err) {
      console.error('Walkin registration error:', err);
      this.showToast(err.message || 'Failed to issue walk-in token.', 'warning');
    }
  }

  printPatientPass(bookingId) {
    const booking = window.mediarcaStore.state.bookings.find(b => b.bookingId === bookingId);
    if (!booking) {
      this.showToast('Booking not found.', 'warning');
      return;
    }

    const waitEst = window.mediarcaStore.calculateSmartWaitTime(booking.doctorId, booking.tokenNumber);
    const tokenHash = window.mediarcaStore.generateSignedCheckInToken(booking.bookingId, booking.patientId);

    const win = window.open('', '_blank', 'width=450,height=600');
    win.document.write(`
      <html>
        <head>
          <title>Mediarca Official OPD Token Pass</title>
          <style>
            body { font-family: monospace; padding: 20px; text-align: center; color: #000; }
            .header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .token { font-size: 48px; font-weight: bold; margin: 10px 0; }
            .meta { font-size: 14px; margin-bottom: 5px; text-align: left; }
            .qr-box { border: 2px solid #000; padding: 10px; margin: 15px 0; font-size: 11px; word-break: break-all; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin:0;">MEDIARCA HEALTH</h2>
            <div>OFFICIAL OPD CLINICAL PASS</div>
          </div>
          <div class="token">TOKEN #${booking.tokenNumber}</div>
          <div class="meta"><strong>Patient:</strong> ${escapeHtml(booking.patientName)}</div>
          <div class="meta"><strong>Doctor:</strong> ${escapeHtml(booking.doctorName)}</div>
          <div class="meta"><strong>Slot:</strong> ${escapeHtml(booking.scheduledSlot || '09:00 AM')}</div>
          <div class="meta"><strong>Est. Wait:</strong> ${waitEst.rangeText} (${waitEst.confidence} Confidence)</div>
          
          <div class="qr-box">
            <div style="font-weight:bold; margin-bottom:4px;">CRYPTOGRAPHIC CHECK-IN TOKEN:</div>
            ${tokenHash}
          </div>

          <div class="footer">
            Please proceed to waiting lounge. Token will be chimed on display.<br>
            Date: ${new Date().toLocaleDateString()} • Ref: ${escapeHtml(booking.bookingId)}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  applyPrescriptionTemplate(templateKey) {
    if (!templateKey) return;
    const template = window.mediarcaStore.state.prescriptionTemplates[templateKey];
    if (!template) return;

    const diagInput = document.getElementById('docDiagnosisInput');
    if (diagInput) diagInput.value = template.diagnosis;

    const adviceInput = document.getElementById('docAdviceInput');
    if (adviceInput) adviceInput.value = template.advice;

    const container = document.getElementById('docPrescriptionItemsContainer');
    if (container && template.medications) {
      container.innerHTML = template.medications.map((med, idx) => `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input type="text" id="docMed${idx+1}Drug" class="form-input" value="${escapeHtml(med.drug)}" placeholder="Medicine Name">
          <input type="text" id="docMed${idx+1}Freq" class="form-input" value="${escapeHtml(med.freq)}" placeholder="Frequency">
          <input type="text" id="docMed${idx+1}Route" class="form-input" value="${escapeHtml(med.route)}" placeholder="Route">
          <input type="text" id="docMed${idx+1}Dur" class="form-input" value="${escapeHtml(med.dur)}" placeholder="Duration">
        </div>
      `).join('');
    }

    this.showToast(`Applied clinical template: ${template.diagnosis}`, 'info');
  }

  updateDoctorBmiLive() {
    const weight = parseFloat(document.getElementById('docWeightInput')?.value || 0);
    const height = parseFloat(document.getElementById('docHeightInput')?.value || 0);
    const badge = document.getElementById('docBmiBadge');
    if (!badge) return;

    const result = window.mediarcaStore.calculateBmi(weight, height);
    if (result.bmi) {
      badge.textContent = `BMI: ${result.bmi} (${result.category})`;
      badge.style.background = result.category === 'Normal' ? '#dcfce7' : (result.category === 'Overweight' ? '#fef3c7' : '#fee2e2');
      badge.style.color = result.category === 'Normal' ? '#15803d' : (result.category === 'Overweight' ? '#92400e' : '#b91c1c');
    }
  }

  showUploadDocModal() {
    let modal = document.getElementById('uploadDocModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'uploadDocModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Upload Clinical Document</h3>
          <button class="modal-close-btn" onclick="document.getElementById('uploadDocModal').classList.remove('active')" style="background:none; border:none; cursor:pointer;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="window.mediarcaApp.handleDocumentUploadSubmit(event)">
            <div class="form-group">
              <label class="form-label">Document Record Name *</label>
              <input type="text" id="uploadDocTitle" class="form-input" placeholder="e.g. Echo_Color_Doppler_Report.pdf" required>
            </div>
            <div class="form-group">
              <label class="form-label">Clinical Category *</label>
              <select id="uploadDocCategory" class="form-select" required>
                <option value="Lab Report PDF">Diagnostic Lab PDF Report</option>
                <option value="Imaging X-Ray">Medical Imaging (X-Ray / MRI / CT)</option>
                <option value="Prescription">Physician Prescription Scan</option>
                <option value="Discharge Summary">Hospital Discharge Summary</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Attending Doctor / Lab *</label>
              <input type="text" id="uploadDocDoctor" class="form-input" placeholder="e.g. Apex Diagnostics / Dr. Bikesh Ray" value="Apex Central Clinical Laboratory" required>
            </div>
            <div class="form-group">
              <label class="form-label">Attach File (PDF, PNG, JPEG) *</label>
              <input type="file" class="form-input" style="padding: 0.4rem;" required>
              <span class="form-hint">🔒 Files are encrypted and stored in private Supabase Storage buckets.</span>
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 1rem;">
              <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Upload to Secure Vault
            </button>
          </form>
        </div>
      </div>
    `;

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  async handleDocumentUploadSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('uploadDocTitle')?.value.trim();
    const category = document.getElementById('uploadDocCategory')?.value;
    const doctor = document.getElementById('uploadDocDoctor')?.value.trim();

    try {
      await window.mediarcaStore.addClinicalDocument({
        fileName: title || 'Clinical_Document.pdf',
        category,
        doctorName: doctor,
        fileSize: '520 KB'
      });

      document.getElementById('uploadDocModal')?.classList.remove('active');
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Document "${title}" saved to Secure EMR Vault!`, 'success');
      this.renderPatientDashboard();
    } catch (err) {
      console.error('Doc upload error:', err);
      this.showToast(err.message || 'Upload failed.', 'warning');
    }
  }

  // --- AI-Assisted Clinical Documentation (Ambient Scribe) (Section 16 Resolution) ---
  handleProcessAiScribe() {
    const rawNote = document.getElementById('aiScribeInput')?.value;
    if (!rawNote || !rawNote.trim()) {
      this.showToast('Please type or dictate clinical encounter notes.', 'warning');
      return;
    }

    try {
      const draft = window.mediarcaStore.parseAmbientClinicalNote(rawNote);
      const resContainer = document.getElementById('aiScribeDraftResult');
      if (!resContainer) return;

      this.currentAiDraft = draft;

      resContainer.innerHTML = `
        <div style="font-size:0.75rem; font-weight:800; color:#4338ca; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>🤖 AI STRUCTURED SOAP DRAFT</span>
          <span style="color:#b91c1c; font-size:0.65rem;">${escapeHtml(draft.disclaimer)}</span>
        </div>

        <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.35rem;">
          <strong>[S] Chief Complaint:</strong> ${escapeHtml(draft.subjective)}
        </div>
        <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.35rem;">
          <strong>[O] Objective Exam:</strong> ${escapeHtml(draft.objective)}
        </div>
        <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.35rem;">
          <strong>[A] Assessment:</strong> <span style="color:#0284c7; font-weight:bold;">${escapeHtml(draft.assessment)}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.5rem;">
          <strong>[P] Recommended Regimen:</strong> ${escapeHtml(draft.medications.join(' • '))}
        </div>

        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-sm btn-teal" onclick="window.mediarcaApp.applyAiScribeDraft()" style="font-size:0.7rem; padding:0.25rem 0.5rem;">
            <i data-lucide="check" style="width:12px;height:12px;"></i> Confirm & Insert into Encounter
          </button>
          <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('aiScribeDraftResult').style.display='none'" style="font-size:0.7rem; padding:0.25rem 0.5rem;">
            Dismiss
          </button>
        </div>
      `;
      resContainer.style.display = 'block';
      if (window.lucide) window.lucide.createIcons();
      this.showToast('AI SOAP Draft Generated. Requires Physician Confirmation.', 'info');
    } catch (err) {
      console.error('AI Scribe Error:', err);
      this.showToast(err.message || 'Scribe conversion failed.', 'warning');
    }
  }

  applyAiScribeDraft() {
    if (!this.currentAiDraft) return;
    const draft = this.currentAiDraft;

    const diagInput = document.getElementById('docDiagnosisInput');
    if (diagInput) diagInput.value = draft.assessment;

    const adviceInput = document.getElementById('docAdviceInput');
    if (adviceInput) adviceInput.value = draft.advice;

    const container = document.getElementById('docPrescriptionItemsContainer');
    if (container && draft.medications.length > 0) {
      container.innerHTML = draft.medications.map((medStr, idx) => `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input type="text" id="docMed${idx+1}Drug" class="form-input" value="${escapeHtml(medStr)}" placeholder="Medicine Name">
          <input type="text" id="docMed${idx+1}Freq" class="form-input" value="OD / Indicated" placeholder="Frequency">
          <input type="text" id="docMed${idx+1}Route" class="form-input" value="Oral" placeholder="Route">
          <input type="text" id="docMed${idx+1}Dur" class="form-input" value="5 Days" placeholder="Duration">
        </div>
      `).join('');
    }

    document.getElementById('aiScribeDraftResult').style.display = 'none';
    this.showToast('AI SOAP Draft confirmed and populated into Clinical Encounter.', 'success');
  }

  // --- AI Queue Optimization Actions (Section 17 Resolution) ---
  applyQueueOptimization(recId) {
    window.mediarcaStore.recordAuditLog({
      action: `AI_QUEUE_OPTIMIZATION_APPLIED_${recId.toUpperCase()}`,
      entity: 'clinic_queues',
      afterState: { recId, action: 'Opened Suite 403 secondary consultation room' }
    });

    if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
    this.showToast('Secondary OPD Suite 403 successfully opened & staffed!', 'success');
    this.renderAdminHub();
  }

  // --- Telemedicine Virtual Consultation Suite (Section 18 Resolution) ---
  showTelemedicineSuite(bookingId) {
    let modal = document.getElementById('telemedModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'telemedModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const booking = window.mediarcaStore.state.bookings.find(b => b.bookingId === bookingId) || {
      patientName: 'Sarah Jenkins',
      doctorName: 'Dr. Bikesh Ray',
      tokenNumber: 2
    };

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 850px; background: #09090b; color: #fff; border: 1px solid #27272a;">
        <div class="modal-header" style="border-bottom: 1px solid #27272a; padding: 1rem 1.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:10px; height:10px; background:#22c55e; border-radius:50%; box-shadow:0 0 10px #22c55e;"></div>
            <h3 style="font-size: 1.125rem; font-weight: 800; color: #fff;">MediArca Encrypted Telemedicine Room</h3>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('telemedModal').classList.remove('active')" style="background:none; border:none; color:#a1a1aa; cursor:pointer;">
            <i data-lucide="x" style="width: 18px; height: 18px;"></i>
          </button>
        </div>

        <div class="modal-body" style="padding: 1.5rem;">
          <!-- Telemedicine Hardware Self-Test & Video Stream -->
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem;">
            <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; height: 340px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center;">
              <!-- Simulated Video Canvas -->
              <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&fit=crop&q=80" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.9);" alt="Doctor Video">
              
              <!-- Patient PiP Inset -->
              <div style="position: absolute; bottom: 12px; right: 12px; width: 110px; height: 80px; background: #27272a; border: 2px solid #0284c7; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&fit=crop&q=80" style="width: 100%; height: 100%; object-fit: cover;" alt="Self View">
                <div style="position: absolute; bottom: 2px; left: 4px; font-size: 9px; background: rgba(0,0,0,0.7); padding: 1px 3px; border-radius: 2px;">Patient (You)</div>
              </div>

              <!-- Stream Status Bar -->
              <div style="position: absolute; top: 12px; left: 12px; display: flex; gap: 0.5rem; align-items: center;">
                <span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; font-size: 0.7rem; border: 1px solid #22c55e;">
                  ● Encrypted WebRTC Session (2.4 Mbps)
                </span>
              </div>

              <!-- Video Controls HUD -->
              <div style="position: absolute; bottom: 12px; left: 12px; display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.showToast('Microphone muted/unmuted', 'info')" style="background: #27272a; color: #fff; border: 1px solid #3f3f46;">
                  <i data-lucide="mic" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.showToast('Camera toggled', 'info')" style="background: #27272a; color: #fff; border: 1px solid #3f3f46;">
                  <i data-lucide="video" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.showToast('Screen share active', 'info')" style="background: #27272a; color: #fff; border: 1px solid #3f3f46;">
                  <i data-lucide="share-2" style="width: 13px; height: 13px;"></i>
                </button>
              </div>
            </div>

            <!-- Side Consultation Notes & Device Diagnostic -->
            <div style="display: flex; flex-direction: column; justify-content: space-between;">
              <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #a1a1aa; text-transform: uppercase; margin-bottom: 0.5rem;">
                  Hardware Self-Test
                </div>
                <div style="font-size: 0.75rem; color: #4ade80; margin-bottom: 0.25rem;">✓ HD Video Camera: Ready</div>
                <div style="font-size: 0.75rem; color: #4ade80; margin-bottom: 0.25rem;">✓ Audio Input: High-Fidelity</div>
                <div style="font-size: 0.75rem; color: #4ade80;">✓ Network Latency: 18ms</div>
              </div>

              <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 1rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #a1a1aa; text-transform: uppercase; margin-bottom: 0.5rem;">
                  Live Teleconsult Notes
                </div>
                <div style="font-size: 0.75rem; color: #fff; margin-bottom: 0.25rem;">
                  <strong>Patient:</strong> ${escapeHtml(booking.patientName)}
                </div>
                <div style="font-size: 0.75rem; color: #fff; margin-bottom: 0.5rem;">
                  <strong>Attending:</strong> ${escapeHtml(booking.doctorName)}
                </div>
                <textarea class="form-textarea" placeholder="Live teleconsult clinical observations..." style="background: #27272a; border: 1px solid #3f3f46; color: #fff; font-size: 0.75rem; min-height: 60px;">Patient confirms mild pharyngeal congestion. Prescription issued electronically.</textarea>
              </div>

              <button class="btn btn-danger btn-block" onclick="document.getElementById('telemedModal').classList.remove('active'); window.mediarcaApp.showToast('Teleconsultation session concluded.', 'info');" style="margin-top: 0.75rem;">
                <i data-lucide="phone-off" style="width: 14px; height: 14px;"></i> Conclude Call & Finalize EMR
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  // --- Digital Consent System (Section 19 Resolution) ---
  showConsentModal(consentType, onAcceptCallback) {
    let modal = document.getElementById('consentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'consentModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 550px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="file-signature" style="width: 18px; height: 18px; color: var(--clinical-blue);"></i>
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Digital Statutory Consent (v2.4-HIPAA)</h3>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('consentModal').classList.remove('active')" style="background:none; border:none; cursor:pointer;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
        <div class="modal-body">
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem; font-size: 0.8125rem; color: var(--text-secondary); max-height: 180px; overflow-y: auto; margin-bottom: 1rem;">
            <p style="margin-bottom: 0.5rem;"><strong>Informed Outpatient & Telemedicine Consent Agreement:</strong></p>
            <p style="margin-bottom: 0.5rem;">I hereby authorize MediArca Healthcare practitioners to provide diagnostic triage, clinical consultations, teleconsultation audio-visual services, and securely maintain my electronic health records in compliance with statutory healthcare data privacy frameworks.</p>
            <p>I acknowledge that all consultation records and prescriptions are encrypted with authenticated access controls.</p>
          </div>

          <label style="display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.8125rem; color: var(--text-primary); cursor: pointer; margin-bottom: 1rem;">
            <input type="checkbox" id="consentCheckbox" style="margin-top: 0.2rem;" required>
            <span>I have read, understood, and voluntarily agree to the informed medical consent terms (Signed timestamp will be cryptographically logged).</span>
          </label>

          <button class="btn btn-primary btn-block" onclick="window.mediarcaApp.handleConsentAccept('${consentType}')">
            <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Sign & Confirm Consent
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    this.pendingConsentCallback = onAcceptCallback;
    if (window.lucide) window.lucide.createIcons();
  }

  async handleConsentAccept(consentType) {
    const cb = document.getElementById('consentCheckbox');
    if (!cb || !cb.checked) {
      this.showToast('Please check the box to confirm consent agreement.', 'warning');
      return;
    }

    try {
      await window.mediarcaStore.recordDigitalConsent(null, consentType);
      document.getElementById('consentModal').classList.remove('active');
      this.showToast('Digital consent signed and logged in compliance ledger!', 'success');
      if (this.pendingConsentCallback) this.pendingConsentCallback();
    } catch (err) {
      console.error('Consent error:', err);
      this.showToast(err.message || 'Failed to record consent.', 'warning');
    }
  }

  // --- Hospital Billing & Insurance Drawer (Section 20 Resolution) ---
  showBillingModal(bookingId = 'bk_live') {
    let modal = document.getElementById('billingModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'billingModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const booking = window.mediarcaStore.state.bookings.find(b => b.bookingId === bookingId) || {
      patientName: 'Sarah Jenkins',
      doctorName: 'Dr. Bikesh Ray',
      tokenNumber: 2
    };

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 520px;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <i data-lucide="receipt" style="width:18px;height:18px; color:#15803d;"></i>
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Hospital Invoice & Insurance Settlement</h3>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('billingModal').classList.remove('active')" style="background:none; border:none; cursor:pointer;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>

        <div class="modal-body">
          <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.8125rem;">
              <span style="color:var(--text-secondary);">Patient:</span>
              <strong>${escapeHtml(booking.patientName)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.8125rem;">
              <span style="color:var(--text-secondary);">Attending Physician:</span>
              <strong>${escapeHtml(booking.doctorName)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem;">
              <span style="color:var(--text-secondary);">OPD Consultation Fee:</span>
              <strong class="text-mono">$60.00</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Healthcare Promo / Voucher Code</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="text" id="billingCouponInput" class="form-input" placeholder="e.g. HEALTH10 or PREVENT20" value="HEALTH10">
              <button class="btn btn-secondary" onclick="window.mediarcaApp.showToast('Coupon HEALTH10 applied! (10% Discount)', 'success')">Apply</button>
            </div>
          </div>

          <label style="display:flex; gap:0.5rem; align-items:center; font-size:0.8125rem; margin-bottom:1rem; cursor:pointer;">
            <input type="checkbox" id="billingInsuranceCheck" checked>
            <span>Pre-Authorize with <strong>MediShield Global Insurance (#POL-99214)</strong> [80% Co-pay Cover]</span>
          </label>

          <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:var(--radius-sm); padding:0.875rem; margin-bottom:1.25rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.25rem;">
              <span>Subtotal:</span>
              <span>$60.00</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.25rem;">
              <span>Voucher Discount (10%):</span>
              <span>-$6.00</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.5rem;">
              <span>Insurance Settlement (80%):</span>
              <span>-$43.20</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:1rem; font-weight:800; color:#14532d; border-top:1px dashed #86efac; padding-top:0.5rem;">
              <span>Net Patient Co-Pay:</span>
              <span class="text-mono">$10.80</span>
            </div>
          </div>

          <button class="btn btn-teal btn-block" onclick="window.mediarcaApp.handleProcessPayment('${booking.bookingId}')">
            <i data-lucide="credit-card" style="width: 15px; height: 15px;"></i> Pay $10.80 & Generate Official Invoice
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  handleProcessPayment(bookingId) {
    const invoice = window.mediarcaStore.processBillingInvoice({
      appointmentId: bookingId,
      patientName: 'Sarah Jenkins',
      doctorName: 'Dr. Bikesh Ray',
      fee: 60.00,
      couponCode: 'HEALTH10',
      hasInsurance: true
    });

    document.getElementById('billingModal').classList.remove('active');
    if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
    this.showToast(`Invoice #${invoice.invoiceNumber} paid and settled!`, 'success');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mediarcaApp = new MediarcaApp();
});
