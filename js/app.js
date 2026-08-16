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
            <img src="${escapeHtml(doc.avatar)}" alt="${escapeHtml(doc.name)}" class="doctor-avatar">
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

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  async handleBookingSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const doctorId = form.bookingDoctorId.value;
    const patientName = form.patientName.value.trim();
    const patientAge = form.patientAge.value;
    const patientGender = form.patientGender.value;
    const patientPhone = form.patientPhone.value.trim();
    const symptoms = form.symptoms.value.trim();

    try {
      const newBooking = await window.mediarcaStore.bookAppointment({
        doctorId,
        patientName,
        patientAge,
        patientGender,
        patientPhone,
        symptoms
      });

      this.closeAllModals();
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Token #${newBooking.tokenNumber} issued successfully!`, 'success');
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

    // Strictly isolate patient's own bookings by immutable user keys (no name fallback)
    const patientBookings = allBookings.filter(b => {
      if (user.id && b.patientId === user.id) return true;
      if (user.phone && b.patientPhone && b.patientPhone === user.phone) return true;
      if (user.email && b.email && b.email.toLowerCase() === user.email.toLowerCase()) return true;
      return false;
    });

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-role" style="margin-bottom: 0.5rem;">Patient Account</span>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">Hello, ${user.name || 'Patient'}</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Manage your active appointments, digital queue tokens, and physician advice.</p>
          </div>
          <button class="btn btn-primary" onclick="window.mediarcaApp.switchView('home')">
            <i data-lucide="plus" style="width: 15px; height: 15px;"></i> Book Another Doctor
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
          <div>
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">My Consultation Tickets (${patientBookings.length})</h3>
            
            ${patientBookings.length === 0 ? `
              <div style="padding: 2.5rem; text-align: center; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: var(--radius-md);">
                <p style="color: var(--text-secondary);">No appointments scheduled yet. Find a doctor on the home page to book a slot.</p>
              </div>
            ` : patientBookings.map(b => `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                  <div>
                    <span class="badge ${b.status === 'in-consultation' ? 'badge-live' : (b.status === 'waiting' ? 'badge-pending' : 'badge-verified')}">
                      ${escapeHtml(b.status.toUpperCase())}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">Booking Ref: ${escapeHtml(b.bookingId)}</span>
                  </div>
                  <div class="text-mono" style="font-size: 1.25rem; font-weight: 800; color: var(--clinical-blue);">
                    Token #${b.tokenNumber}
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                  <div>
                    <h4 style="font-size: 1.0625rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(b.doctorName)}</h4>
                    <p style="font-size: 0.8125rem; color: var(--text-secondary);">${escapeHtml(b.specialty)} • ${escapeHtml(b.hospital)}</p>
                    <p style="font-size: 0.8125rem; color: var(--text-primary); margin-top: 0.35rem;"><strong>Symptoms:</strong> ${escapeHtml(b.symptoms)}</p>
                  </div>
                  <button class="btn btn-sm btn-clinical" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${b.doctorId}' })">
                    <i data-lucide="radio" style="width: 14px; height: 14px;"></i> Open Live Radar
                  </button>
                </div>

                ${b.prescription ? `
                  <div style="margin-top: 1rem; padding: 1rem; background: var(--status-verified-bg); border-radius: var(--radius-sm); border: 1px solid var(--status-verified-border);">
                    <div style="font-size: 0.75rem; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 0.25rem;">Doctor Prescription & Advice</div>
                    <div style="font-size: 0.875rem; color: #14532d; font-weight: 600;">Diagnosis: ${escapeHtml(b.prescription.diagnosis)}</div>
                    <div style="font-size: 0.8125rem; color: #166534; margin-top: 0.25rem;">Medications: ${escapeHtml(Array.isArray(b.prescription.medications) ? b.prescription.medications.join(', ') : b.prescription.medications)}</div>
                    <div style="font-size: 0.75rem; color: #15803d; margin-top: 0.25rem;">Advice: ${escapeHtml(b.prescription.advice)}</div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <div>
            <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
              <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Patient Profile</h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.875rem;">
                <div><span style="color: var(--text-muted);">Full Name:</span> <strong>${escapeHtml(user.name || 'Patient')}</strong></div>
                <div><span style="color: var(--text-muted);">Email:</span> <strong>${escapeHtml(user.email || 'N/A')}</strong></div>
                <div><span style="color: var(--text-muted);">Phone:</span> <strong>${escapeHtml(user.phone || 'N/A')}</strong></div>
                <div><span style="color: var(--text-muted);">Blood Group:</span> <strong>${escapeHtml(user.bloodGroup || 'O+')}</strong></div>
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
    const doc = window.mediarcaStore.state.doctors.find(d => d.id === user.id || (d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase())) || user;

    if (doc.verificationStatus === 'pending') {
      container.innerHTML = `
        <div class="container" style="max-width: 680px; padding-top: 3rem; padding-bottom: 4rem;">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 2.5rem; text-align: center; box-shadow: var(--shadow-md);">
            <div style="width: 52px; height: 52px; background: var(--status-pending-bg); color: var(--status-pending); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
              <i data-lucide="clock" style="width: 26px; height: 26px;"></i>
            </div>
            <span class="badge badge-pending" style="margin-bottom: 1rem;">Verification In Progress</span>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Welcome, ${escapeHtml(doc.name)}</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem;">
              Your medical credentials for <strong>${escapeHtml(doc.specialty)}</strong> (License: <code>${escapeHtml(doc.regNumber)}</code>) are under review by the Mediarca Medical Board.
              Once verified, your certified Mediarca Doctor ID will be activated to accept bookings.
            </p>

            <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem; text-align: left; margin-bottom: 1.5rem; font-size: 0.8125rem;">
              <div style="margin-bottom: 0.25rem;"><strong>Qualifications:</strong> ${escapeHtml(doc.degrees)}</div>
              <div style="margin-bottom: 0.25rem;"><strong>Hospital:</strong> ${escapeHtml(doc.hospital)}</div>
              <div><strong>Registration Date:</strong> ${escapeHtml(doc.appliedDate || 'Today')}</div>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (!window.mediarcaStore.state.queues[doc.id]) {
      window.mediarcaStore.state.queues[doc.id] = {
        doctorId: doc.id,
        currentToken: 0,
        status: 'in-session',
        avgConsultTimeMins: doc.avgConsultTimeMins || 12,
        tokens: []
      };
    }

    const queue = window.mediarcaStore.state.queues[doc.id] || { currentToken: 0, status: 'idle', tokens: [] };
    const currentToken = queue.currentToken || 0;
    const currentPatient = queue.tokens && queue.tokens.length > 0 ? queue.tokens.find(t => t.status === 'in-consultation' || (t.tokenNumber === currentToken && t.status !== 'completed' && currentToken > 0)) : null;
    const hasWaiting = queue.tokens ? queue.tokens.some(t => t.status === 'waiting') : false;

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
                <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Patient In Consultation</h3>
                <span class="badge ${queue.status === 'in-session' ? 'badge-live' : 'badge-pending'}">
                  Queue Status: ${escapeHtml(queue.status.toUpperCase())}
                </span>
              </div>

              ${currentPatient ? `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1.25rem; margin-bottom: 1.5rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div>
                      <h4 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(currentPatient.patientName)}</h4>
                      <div style="font-size: 0.8125rem; color: var(--text-secondary);">Ref: ${escapeHtml(currentPatient.bookingId)} • Check-in: ${escapeHtml(currentPatient.checkInTime)}</div>
                    </div>
                    <div class="text-mono" style="font-size: 2rem; font-weight: 800; color: var(--clinical-blue);">
                      Token #${currentPatient.tokenNumber}
                    </div>
                  </div>

                  <div style="margin-bottom: 1.25rem;">
                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Reported Symptoms</div>
                    <div style="font-size: 0.875rem; color: var(--text-primary); margin-top: 0.25rem; background: #fff; padding: 0.625rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                      ${escapeHtml(currentPatient.symptoms || 'General Consultation')}
                    </div>
                  </div>

                  <!-- Prescription Input Box -->
                  <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Issue Prescription & Clinical Notes:</div>
                    <input type="text" id="docDiagnosisInput" class="form-input" placeholder="Diagnosis (e.g. Acute bronchitis, Viral fever)" style="margin-bottom: 0.5rem;">
                    <input type="text" id="docMedicationsInput" class="form-input" placeholder="Medications (e.g. Tab Azithromycin 500mg, Paracetamol 650mg)" style="margin-bottom: 0.5rem;">
                    <textarea id="docAdviceInput" class="form-textarea" placeholder="Clinical Advice & Follow-up timeline..." style="margin-bottom: 1rem; min-height: 60px;"></textarea>

                    <button class="btn btn-teal btn-block" onclick="window.mediarcaApp.handleCompleteWithRx('${doc.id}', ${currentPatient.tokenNumber})">
                      <i data-lucide="check-check" style="width: 15px; height: 15px;"></i> Save Prescription & Call Next Patient
                    </button>
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
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${queue.tokens && queue.tokens.length > 0 ? queue.tokens.map(t => `
                      <tr style="${t.tokenNumber === currentToken && t.status === 'in-consultation' ? 'background: var(--clinical-blue-subtle); font-weight: 600;' : ''}">
                        <td class="text-mono">#${t.tokenNumber}</td>
                        <td>${t.patientName}</td>
                        <td>${t.checkInTime || '09:00 AM'}</td>
                        <td>
                          <span class="badge ${t.status === 'in-consultation' ? 'badge-live' : (t.status === 'completed' ? 'badge-verified' : 'badge-pending')}">
                            ${t.status === 'in-consultation' ? 'IN ROOM' : t.status.toUpperCase()}
                          </span>
                        </td>
                        <td style="color: var(--text-secondary); font-size: 0.8125rem;">${t.symptoms}</td>
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

  async handleCompleteWithRx(doctorId, tokenNumber) {
    const diagnosis = document.getElementById('docDiagnosisInput')?.value.trim() || 'Clinical evaluation concluded.';
    const medications = document.getElementById('docMedicationsInput')?.value.trim() || 'Prescribed oral medication as directed';
    const advice = document.getElementById('docAdviceInput')?.value.trim() || 'Take prescribed medications with plenty of water. Follow up if needed.';

    try {
      await window.mediarcaStore.completeConsultationWithPrescription(doctorId, tokenNumber, {
        diagnosis,
        medications: [medications],
        advice
      });

      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Prescription saved! Token #${tokenNumber} completed.`, 'success');
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

  // --- Admin Verification Desk ---
  renderAdminHub() {
    const container = document.getElementById('adminPortalContainer');
    if (!container) return;

    const doctors = window.mediarcaStore.state.doctors;
    const pending = doctors.filter(d => d.verificationStatus === 'pending');
    const verified = doctors.filter(d => d.verificationStatus === 'verified');

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
          <div>
            <span class="badge badge-role" style="background: #b91c1c; margin-bottom: 0.5rem;">Medical Board Administration</span>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">Doctor Verification & License Desk</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Audit medical credentials, approve practitioner licenses, and issue certified Mediarca IDs.</p>
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem;">
          <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Pending Verification Requests (${pending.length})</h3>
          
          ${pending.length === 0 ? `
            <div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-surface-subtle); border-radius: var(--radius-sm);">
              All doctor applications have been processed.
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
                    <th>Hospital</th>
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

        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
          <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Verified Doctor Ledger</h3>
          <div class="table-responsive">
            <table class="clinical-table">
              <thead>
                <tr>
                  <th>Mediarca ID</th>
                  <th>Practitioner</th>
                  <th>Specialty</th>
                  <th>Medical Reg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${verified.map(doc => `
                  <tr>
                    <td><strong class="text-mono" style="color: var(--clinical-blue);">${escapeHtml(doc.mediarcaId || 'VERIFIED')}</strong></td>
                    <td><strong>${escapeHtml(doc.name)}</strong></td>
                    <td>${escapeHtml(doc.specialty)}</td>
                    <td class="text-mono">${escapeHtml(doc.regNumber)}</td>
                    <td><span class="badge badge-verified">Active & Verified</span></td>
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.mediarcaApp = new MediarcaApp();
});
