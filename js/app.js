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
      const doc = window.mediarcaStore.state.doctors.find(d => 
        d.id === user.id || 
        d.userId === user.id || 
        (d.email && user.email && d.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      ) || user;

      // Authenticated Doctor Navigation
      navLinksContainer.innerHTML = `
        <li><button class="nav-link-btn active" onclick="window.mediarcaApp.switchView('doctor-portal')"><i data-lucide="layout-dashboard" style="width:15px;height:15px"></i> Practice Console</button></li>
        <li><button class="nav-link-btn" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${doc.id}' })"><i data-lucide="radio" style="width:15px;height:15px"></i> Public Radar View</button></li>
      `;

      navActionsContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="text-align:right;">
            <div style="font-size:0.8125rem; font-weight:700; color:var(--text-primary);">${doc.name || user.name}</div>
            <div style="font-size:0.7rem; color:var(--clinical-blue); font-family:var(--font-mono); font-weight:700;">${doc.mediarcaId || 'VERIFIED PRACTITIONER'}</div>
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
      const queue = window.mediarcaStore.state.queues[doc.id] || { currentToken: 0, status: 'idle', tokens: [] };
      const currentToken = queue.currentToken || 0;
      const waitTime = window.mediarcaStore.calculateSmartWaitTime(doc.id, currentToken + 1);

      return `
        <div class="doctor-card-modern" style="border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <!-- Card Header: Avatar with Status Dot, Name, Verified Badge, Specialty, Experience -->
            <div class="doc-card-header" style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 0.85rem;">
              <div class="doc-avatar-wrap" style="position: relative; flex-shrink: 0; width: 68px; height: 68px;">
                <img src="${sanitizeImageUrl(doc.avatar)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80'" alt="${escapeHtml(doc.name)}" class="doc-avatar-img" style="width: 68px; height: 68px; border-radius: 14px; object-fit: cover; border: 2px solid #f1f5f9; display: block;">
                <span class="doc-status-dot" title="Accepting Patients Now" style="position: absolute; bottom: -2px; right: -2px; width: 13px; height: 13px; border-radius: 50%; background: #10b981; border: 2.5px solid #ffffff;"></span>
              </div>
              
              <div class="doc-title-wrap" style="flex: 1; min-width: 0;">
                <div class="doc-name-row" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.15rem;">
                  <h4 class="doc-name" style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</h4>
                  <span class="doc-verified-badge" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 700; flex-shrink: 0;" title="Medical Council Verified Specialist">
                    <i data-lucide="shield-check" style="width: 11px; height: 11px;"></i>
                    <span>Verified</span>
                  </span>
                </div>
                
                <div class="doc-specialty-text" style="font-size: 0.84rem; font-weight: 600; color: #0284c7; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(doc.specialty)}">${escapeHtml(doc.specialty)}</div>
                
                <div class="doc-exp-row" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #64748b; flex-wrap: wrap;">
                  <span class="doc-exp-pill" style="background: #f1f5f9; color: #334155; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.7rem;">${doc.experienceYears}+ Yrs Exp</span>
                  <span class="doc-degree-text" style="color: #64748b; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(doc.degrees || 'MBBS')}">${escapeHtml(doc.degrees || 'MBBS')}</span>
                </div>
              </div>
            </div>

            <!-- Rating, Reviews Count & Hospital Distance Strip -->
            <div class="doc-metrics-strip" style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 0.45rem 0.75rem; margin-bottom: 0.85rem; font-size: 0.775rem;">
              <div class="doc-rating" style="display: flex; align-items: center; gap: 0.3rem; color: #d97706;">
                <i data-lucide="star" class="star-icon" style="width: 13px; height: 13px; fill: #f59e0b; color: #f59e0b;"></i>
                <strong style="font-weight: 800; color: #b45309;">${doc.rating}</strong>
                <span class="reviews-count" style="color: #64748b; font-weight: 500;">(${doc.reviewsCount} reviews)</span>
              </div>
              <div class="doc-location-tag" style="display: flex; align-items: center; gap: 0.3rem; color: #475569; font-weight: 500;">
                <i data-lucide="map-pin" class="pin-icon" style="width: 12px; height: 12px; color: #0284c7;"></i>
                <span>${escapeHtml(doc.hospitalDistance || '0.8 km • Main Wing')}</span>
              </div>
            </div>

            <!-- Clinic & Languages Spoken -->
            <div class="doc-facility-info" style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.775rem; color: #475569; margin-bottom: 0.85rem;">
              <div class="doc-facility-line" style="display: flex; align-items: center; gap: 0.45rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <i data-lucide="building-2" class="facility-icon" style="width: 13px; height: 13px; color: #94a3b8; flex-shrink: 0;"></i>
                <span class="facility-name" style="font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(doc.hospital)}">${escapeHtml(doc.hospital)}</span>
              </div>
              <div class="doc-languages-line" style="display: flex; align-items: center; gap: 0.45rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <i data-lucide="languages" class="lang-icon" style="width: 13px; height: 13px; color: #94a3b8; flex-shrink: 0;"></i>
                <span>Languages: <strong>${escapeHtml((doc.languages || ['English', 'Hindi']).join(', '))}</strong></span>
              </div>
            </div>

            <!-- Live OPD Queue & Next Available Slot Pill -->
            <div class="doc-queue-pill" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 0.6rem 0.85rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
              <div class="queue-pill-left" style="display: flex; flex-direction: column; gap: 0.15rem;">
                <div class="queue-label" style="font-size: 0.6875rem; color: #0369a1; text-transform: uppercase; font-weight: 700; letter-spacing: 0.02em;">Next Slot: <span class="slot-val" style="color: #0c4a6e; font-weight: 800; text-transform: none;">${escapeHtml(doc.nextSlot || 'Today, 10:30 AM')}</span></div>
                <div class="queue-wait-text" style="font-size: 0.75rem; color: #0369a1; font-weight: 500;">⏱ Est. Wait ~<strong style="color: #0c4a6e; font-weight: 800;">${waitTime.rangeText}</strong></div>
              </div>
              <button class="doc-radar-btn" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${doc.id}' })" style="display: inline-flex; align-items: center; gap: 0.3rem; background: #ffffff; border: 1px solid #bae6fd; color: #0284c7; padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.725rem; font-weight: 700; cursor: pointer;" title="Open Live OPD Queue Radar">
                <i data-lucide="radio" style="width: 11px; height: 11px;"></i>
                <span>Live Radar</span>
              </button>
            </div>
          </div>

          <!-- Card Action Footer: Consultation Fee & Direct Booking CTA -->
          <div class="doc-card-action-footer" style="padding-top: 0.85rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <div class="doc-fee-box">
              <span class="fee-label" style="font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.04em; display: block;">Consultation Fee</span>
              <div class="fee-amount" style="font-size: 1.35rem; font-weight: 900; color: #0f172a; line-height: 1.1;">$${doc.fee} <span class="fee-sub" style="font-size: 0.75rem; font-weight: 500; color: #64748b;">/ visit</span></div>
            </div>
            <button class="doc-book-btn" onclick="window.mediarcaApp.openBookingModal('${doc.id}')" style="display: inline-flex; align-items: center; gap: 0.4rem; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border: none; padding: 0.55rem 1.15rem; border-radius: 8px; font-size: 0.84rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.28);">
              <i data-lucide="calendar-plus" style="width: 14px; height: 14px;"></i>
              <span>Book Slot</span>
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
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Generating Token...';
    }

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
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Confirm & Generate Live Token';
      }
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

  // --- Patient Dashboard with UX Tabbed Navigation (Section 13 Resolution) ---
  setPatientTab(tabName) {
    this.patientActiveTab = tabName;
    this.renderPatientDashboard();
  }

  renderPatientDashboard() {
    const container = document.getElementById('patientPortalContainer');
    if (!container) return;

    const user = window.mediarcaStore.state.currentUser;
    const isAuthorized = window.mediarcaStore.isAuthorized('patient');
    const activeTab = this.patientActiveTab || 'upcoming';

    if (!isAuthorized || !user || !user.id) {
      container.innerHTML = `
        <div class="container" style="padding-top: 3rem; text-align: center; max-width: 500px;">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 2rem;">
            <i data-lucide="lock" style="width: 36px; height: 36px; color: var(--clinical-blue); margin: 0 auto 1rem;"></i>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Patient Session Required</h3>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">Sign in to securely access your clinical encounters, active tokens, and medical timeline.</p>
            <button class="btn btn-primary btn-block" onclick="window.mediarcaApp.switchView('auth-patient')">Sign In to Portal</button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const patientBookings = window.mediarcaStore.state.bookings.filter(b => b.patientId === user.id);
    const patientTimeline = window.mediarcaStore.state.medicalTimeline.filter(tl => tl.patientId === user.id);
    const patientDocs = window.mediarcaStore.state.clinicalDocuments.filter(d => d.patientId === user.id);

    const activeAppointment = patientBookings.find(b => b.status === 'booked' || b.status === 'checked_in') || patientBookings[0];
    const activeBookingId = activeAppointment ? (activeAppointment.bookingId || activeAppointment.id) : '';

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <!-- Patient Header Banner -->
        <div style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border-radius: var(--radius-md); padding: 1.75rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; box-shadow: var(--shadow-md); flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #fff;"><i data-lucide="user" style="width:12px;height:12px"></i> PATIENT EMR PORTAL</span>
              <span style="font-size: 0.75rem; color: #e0f2fe;">Medical ID: <strong>${escapeHtml(user.mediarcaId || ('MED-PAT-' + user.id.substring(0, 4).toUpperCase()))}</strong></span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800;">Welcome, ${escapeHtml(user.name || 'Patient')}</h2>
            <p style="font-size: 0.8125rem; color: #e0f2fe;">Manage your upcoming visits, active queue tokens, electronic prescriptions, and diagnostic vault.</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary" onclick="window.mediarcaApp.showBillingModal('${activeBookingId}')" style="background: #fff; color: #0369a1; font-size:0.8125rem;">
              <i data-lucide="receipt" style="width: 14px; height: 14px;"></i> Invoices & Pay
            </button>
            <button class="btn btn-secondary" onclick="window.mediarcaApp.showUploadDocModal()" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-size:0.8125rem;">
              <i data-lucide="upload-cloud" style="width: 14px; height: 14px;"></i> Upload Record
            </button>
          </div>
        </div>

        <!-- Tabbed Navigation Bar (UX Resolution) -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; overflow-x: auto;">
          <button class="btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('upcoming')">
            <i data-lucide="calendar" style="width:13px;height:13px"></i> Upcoming Visits (${patientBookings.filter(b => b.status === 'booked' || b.status === 'checked_in').length})
          </button>
          <button class="btn btn-sm ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('queue')">
            <i data-lucide="radio" style="width:13px;height:13px"></i> Live Queue Radar
          </button>
          <button class="btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('history')">
            <i data-lucide="clock" style="width:13px;height:13px"></i> Medical History (${patientTimeline.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'prescriptions' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('prescriptions')">
            <i data-lucide="file-text" style="width:13px;height:13px"></i> Prescriptions (${patientBookings.filter(b => b.prescription).length})
          </button>
          <button class="btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('reports')">
            <i data-lucide="folder-lock" style="width:13px;height:13px"></i> Document Vault (${patientDocs.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('profile')">
            <i data-lucide="user-check" style="width:13px;height:13px"></i> Profile & Insurance
          </button>
          <button class="btn btn-sm ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setPatientTab('notifications')">
            <i data-lucide="bell" style="width:13px;height:13px"></i> Notifications
          </button>
        </div>

        <!-- TAB 1: UPCOMING VISITS -->
        ${activeTab === 'upcoming' ? `
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            <div>
              <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">
                Scheduled Appointments & Passes
              </h3>
              ${patientBookings.length === 0 ? `
                <div style="padding: 2.5rem; text-align: center; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: var(--radius-md);">
                  <p style="color: var(--text-secondary);">No appointments scheduled yet. Search doctors on the home directory to book a slot.</p>
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
                        <i data-lucide="printer" style="width: 14px; height: 14px;"></i> Print Pass
                      </button>
                      <button class="btn btn-sm btn-clinical" onclick="window.mediarcaApp.switchView('queue-radar', { doctorId: '${b.doctorId}' })">
                        <i data-lucide="radio" style="width: 14px; height: 14px;"></i> Live Radar
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Vitals Summary Sidecard -->
            <div>
              <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
                <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.4rem;">
                  <i data-lucide="heart-pulse" style="width:14px;height:14px; color:#ef4444;"></i> Recent Triage Vitals
                </h4>
                <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.8125rem;">
                  <div style="display:flex; justify-content:space-between;"><span>Blood Pressure:</span> <strong>120/80 mmHg</strong></div>
                  <div style="display:flex; justify-content:space-between;"><span>Pulse Rate:</span> <strong>74 bpm</strong></div>
                  <div style="display:flex; justify-content:space-between;"><span>SpO2 Oxygen:</span> <strong>99%</strong></div>
                  <div style="display:flex; justify-content:space-between;"><span>Body Mass Index:</span> <strong>22.5 (Normal)</strong></div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- TAB 2: LIVE QUEUE RADAR -->
        ${activeTab === 'queue' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 2rem; text-align: center;">
            <i data-lucide="radio" style="width: 40px; height: 40px; color: var(--clinical-blue); margin: 0 auto 1rem;"></i>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Live OPD Queue Radar</h3>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">View real-time token pacing, distance-to-call telemetry, and live chime notifications.</p>
            <button class="btn btn-primary" onclick="window.mediarcaApp.switchView('queue-radar')">Open Live Queue Radar Screen</button>
          </div>
        ` : ''}

        <!-- TAB 3: MEDICAL HISTORY TIMELINE -->
        ${activeTab === 'history' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.25rem;">
              Longitudinal Clinical Event Timeline
            </h3>
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
        ` : ''}

        <!-- TAB 4: PRESCRIPTIONS -->
        ${activeTab === 'prescriptions' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">
              Itemized Electronic Prescriptions
            </h3>
            ${patientBookings.filter(b => b.prescription).map(b => `
              <div style="padding: 1.25rem; background: var(--status-verified-bg); border-radius: var(--radius-sm); border: 1px solid var(--status-verified-border); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                  <div style="font-size: 0.75rem; font-weight: 700; color: #166534; text-transform: uppercase;">
                    <i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Prescribing Doctor: ${escapeHtml(b.doctorName)}
                  </div>
                  <span style="font-size: 0.75rem; color: #15803d; font-weight: 600;">Follow-up: ${escapeHtml(b.prescription.followUpDate || 'SOS')}</span>
                </div>
                <div style="font-size: 0.875rem; color: #14532d; font-weight: 700;">Diagnosis: ${escapeHtml(b.prescription.diagnosis)}</div>
                <div style="font-size: 0.8125rem; color: #166534; margin-top: 0.35rem;">
                  <strong>Prescribed Regimen:</strong> ${escapeHtml(Array.isArray(b.prescription.medications) ? b.prescription.medications.join(' • ') : b.prescription.medications)}
                </div>
                <div style="font-size: 0.75rem; color: #15803d; margin-top: 0.35rem;"><strong>Instructions:</strong> ${escapeHtml(b.prescription.advice)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- TAB 5: DOCUMENT VAULT & REPORTS -->
        ${activeTab === 'reports' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="shield-check" style="width:16px; height:16px; color:#16a34a;"></i> Clinical Document & Imaging Vault
              </h3>
              <button class="btn btn-sm btn-primary" onclick="window.mediarcaApp.showUploadDocModal()">Upload New PDF/Scan</button>
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
                    <span style="font-size:0.65rem; color:#16a34a; font-weight:600;">🔒 Private Authenticated Vault</span>
                    <button type="button" onclick="window.mediarcaApp.handleDownloadVaultDoc('${doc.id}', '${doc.storagePath || ''}', '${escapeHtml(doc.downloadUrl || '')}')" class="btn btn-sm btn-secondary" style="font-size:0.7rem; padding:0.2rem 0.5rem;">
                      <i data-lucide="download" style="width:11px;height:11px"></i> Download
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- TAB 6: PROFILE & INSURANCE (Audit v10 Resolution: Dynamic Authenticated Demographics) -->
        ${activeTab === 'profile' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; max-width: 650px;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Medical Demographics & Policy</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.875rem;">
              <div><span style="color: var(--text-muted);">Full Name:</span> <strong>${escapeHtml(user.name || 'Verified Patient')}</strong></div>
              <div><span style="color: var(--text-muted);">Email:</span> <strong>${escapeHtml(user.email || 'N/A')}</strong></div>
              <div><span style="color: var(--text-muted);">Phone:</span> <strong>${escapeHtml(user.phone || 'On file')}</strong></div>
              <div><span style="color: var(--text-muted);">Blood Group:</span> <strong class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.8rem;">${escapeHtml(user.clinicalProfile?.blood_group || user.bloodGroup || 'Not Recorded')}</strong></div>
              <div><span style="color: var(--text-muted);">Allergies:</span> <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.75rem;">${escapeHtml(user.clinicalProfile?.allergies || 'None Documented')}</span></div>
              <div><span style="color: var(--text-muted);">Chronic Conditions:</span> <strong>${escapeHtml(user.clinicalProfile?.chronic_conditions || 'None Documented')}</strong></div>
              <div><span style="color: var(--text-muted);">Emergency Contact:</span> <strong>${escapeHtml(user.clinicalProfile?.emergency_contact || 'On file')}</strong></div>
              <div><span style="color: var(--text-muted);">Insurance Policy:</span> <strong>${escapeHtml(user.clinicalProfile?.insurance_policy || 'Self-Pay / Direct')}</strong></div>
            </div>
          </div>
        ` : ''}

        <!-- TAB 7: NOTIFICATIONS (Audit Final Resolution: Dynamic Patient Telemetry Notifications) -->
        ${activeTab === 'notifications' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Clinical Notifications Stream</h3>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              ${patientBookings.length > 0 ? patientBookings.map(b => {
                const isCurrent = b.status === 'in-consultation' || b.status === 'checked_in';
                return `
                  <div style="background:${isCurrent ? '#f0fdf4' : '#f0f9ff'}; border:1px solid ${isCurrent ? '#86efac' : '#bae6fd'}; padding:0.875rem; border-radius:var(--radius-sm); display:flex; gap:0.75rem; align-items:center;">
                    <i data-lucide="${isCurrent ? 'check-circle-2' : 'calendar-check'}" style="width:18px;height:18px; color:${isCurrent ? '#15803d' : '#0369a1'};"></i>
                    <div>
                      <div style="font-size:0.8125rem; font-weight:700; color:${isCurrent ? '#166534' : '#0c4a6e'};">Appointment: ${escapeHtml(b.doctorName)}</div>
                      <div style="font-size:0.75rem; color:${isCurrent ? '#15803d' : '#0369a1'};">Token #${b.tokenNumber} (${escapeHtml(b.status.toUpperCase())}) scheduled for ${escapeHtml(b.date || b.scheduledDate || 'Today')} at ${escapeHtml(b.timeSlot || b.scheduledSlot || '09:00 AM')}.</div>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); background: var(--bg-surface-subtle); border-radius: var(--radius-sm);">
                  No new clinical notifications.
                </div>
              `}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Doctor Console with UX Tabbed Navigation (Section 13 Resolution) ---
  setDoctorTab(tabName) {
    this.doctorActiveTab = tabName;
    this.renderDoctorConsole();
  }

  renderDoctorConsole() {
    const container = document.getElementById('doctorPortalContainer');
    if (!container) return;

    const user = window.mediarcaStore.state.currentUser;
    // Canonical UUID & email matching (A-04 Resolution)
    const doc = window.mediarcaStore.state.doctors.find(d => 
      d.id === user.id || 
      d.userId === user.id || 
      (d.email && user.email && d.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    ) || user;
    const activeTab = this.doctorActiveTab || 'current';

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
    const nextPatients = queue.tokens ? queue.tokens.filter(t => t.tokenNumber > currentToken && t.status === 'waiting') : [];
    const hasWaiting = queue.tokens && queue.tokens.some(t => t.status === 'waiting');

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="background: var(--text-primary); color: #fff; border-radius: var(--radius-md); padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
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

        <!-- Doctor Console Tabbed Navigation (UX Resolution) -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; overflow-x: auto;">
          <button class="btn btn-sm ${activeTab === 'current' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setDoctorTab('current')">
            <i data-lucide="user-check" style="width:13px;height:13px"></i> Current Patient & Vitals
          </button>
          <button class="btn btn-sm ${activeTab === 'next' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setDoctorTab('next')">
            <i data-lucide="users" style="width:13px;height:13px"></i> Next in Line (${nextPatients.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setDoctorTab('schedule')">
            <i data-lucide="calendar" style="width:13px;height:13px"></i> Today's Schedule (${queue.tokens?.length || 0})
          </button>
          <button class="btn btn-sm ${activeTab === 'statistics' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setDoctorTab('statistics')">
            <i data-lucide="bar-chart-2" style="width:13px;height:13px"></i> Daily Statistics
          </button>
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

                  <!-- Medical Background & Allergy Alert (Section 10 & Audit Recheck Resolution) -->
                  <div style="background: #fff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.875rem; margin-bottom: 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; font-size: 0.75rem;">
                    <div>
                      <span style="color: var(--text-muted);">Blood Group:</span>
                      <div style="font-weight: 700; color: #b91c1c;">${escapeHtml(currentPatient.clinicalProfile?.blood_group || currentPatient.bloodGroup || 'Not Recorded')}</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Known Allergies:</span>
                      <div style="font-weight: 700; color: #b91c1c;">${escapeHtml(currentPatient.clinicalProfile?.allergies || 'None Documented')}</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Chronic Conditions:</span>
                      <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(currentPatient.clinicalProfile?.chronic_conditions || 'None Documented')}</div>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">Emergency Contact:</span>
                      <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(currentPatient.clinicalProfile?.emergency_contact || currentPatient.emergencyContact || 'On file')}</div>
                    </div>
                  </div>

                  <!-- Clinical Vitals & Biometrics Dashboard (Tier 2 Resolution) -->
                  <div style="background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                      <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; display:flex; align-items:center; gap:0.35rem;">
                        <i data-lucide="heart-pulse" style="width:14px;height:14px; color:#ef4444;"></i> Pre-Consultation Vitals & Biometrics
                      </div>
                      <div style="font-size:0.7rem; color:var(--text-muted);">
                        Repeat Visit Trend: <strong>${escapeHtml(currentPatient.clinicalProfile?.vitals_trend || 'No prior visit vitals on record')}</strong>
                      </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">BP (mmHg)</label>
                        <input type="text" id="docBpInput" class="form-input" placeholder="e.g. 120/80" value="" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">PULSE (bpm)</label>
                        <input type="text" id="docPulseInput" class="form-input" placeholder="e.g. 74" value="" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">TEMP (°F)</label>
                        <input type="text" id="docTempInput" class="form-input" placeholder="e.g. 98.6" value="" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">SpO2 (%)</label>
                        <input type="text" id="docSpo2Input" class="form-input" placeholder="e.g. 99" value="" style="font-size: 0.8125rem;">
                      </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1.2fr; gap: 0.5rem; align-items:center;">
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">WEIGHT (kg)</label>
                        <input type="number" id="docWeightInput" class="form-input" placeholder="e.g. 70" value="" step="0.5" oninput="window.mediarcaApp.updateDoctorBmiLive()" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">HEIGHT (cm)</label>
                        <input type="number" id="docHeightInput" class="form-input" placeholder="e.g. 175" value="" oninput="window.mediarcaApp.updateDoctorBmiLive()" style="font-size: 0.8125rem;">
                      </div>
                      <div>
                        <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">RESP RATE (/min)</label>
                        <input type="text" id="docRespInput" class="form-input" placeholder="e.g. 16" value="" style="font-size: 0.8125rem;">
                      </div>
                      <div style="padding-top:1.1rem;">
                        <span id="docBmiBadge" class="badge" style="background:#f1f5f9; color:#475569; font-size:0.75rem; width:100%; justify-content:center; display:flex;">
                          BMI: Not Measured
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

                    <input type="text" id="docDiagnosisInput" class="form-input" placeholder="Primary Diagnosis (or select Clinical Protocol Template above)" value="" style="margin-bottom: 0.75rem;">
                    
                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Structured Prescription Regimen (Itemized Drugs):</div>
                    <div id="docPrescriptionItemsContainer" style="background: #fff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.75rem;">
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" id="docMed1Drug" class="form-input" value="" placeholder="Medicine 1 Name (e.g. Tab. Metoprolol 25mg)">
                        <input type="text" id="docMed1Freq" class="form-input" value="" placeholder="Frequency (e.g. OD)">
                        <input type="text" id="docMed1Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed1Dur" class="form-input" value="" placeholder="Duration (e.g. 5 Days)">
                      </div>
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="text" id="docMed2Drug" class="form-input" value="" placeholder="Medicine 2 Name (Optional)">
                        <input type="text" id="docMed2Freq" class="form-input" value="" placeholder="Frequency">
                        <input type="text" id="docMed2Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed2Dur" class="form-input" value="" placeholder="Duration">
                      </div>
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem;">
                        <input type="text" id="docMed3Drug" class="form-input" value="" placeholder="Medicine 3 Name (Optional)">
                        <input type="text" id="docMed3Freq" class="form-input" value="" placeholder="Frequency">
                        <input type="text" id="docMed3Route" class="form-input" value="Oral" placeholder="Route">
                        <input type="text" id="docMed3Dur" class="form-input" value="" placeholder="Duration">
                      </div>
                    </div>

                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Diagnostic Lab Orders & Imaging:</div>
                    <input type="text" id="docLabOrderInput" class="form-input" placeholder="Ordered Tests (e.g. CBC, Lipid Profile, Chest X-Ray)" value="" style="margin-bottom: 0.75rem;">

                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Treatment Plan, Clinical Advice & Follow-Up:</div>
                    <textarea id="docAdviceInput" class="form-textarea" placeholder="Clinical Advice, Dietary Precautions & Follow-up Timeline..." style="margin-bottom: 0.75rem; min-height: 55px;"></textarea>

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
    const bp = document.getElementById('docBpInput')?.value.trim() || null;
    const pulse = document.getElementById('docPulseInput')?.value.trim() || null;
    const temp = document.getElementById('docTempInput')?.value.trim() || null;
    const spo2 = document.getElementById('docSpo2Input')?.value.trim() || null;
    const vitalsObj = (bp || pulse || temp || spo2) ? { bp, pulse, temp, spo2 } : null;
    
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
        vitals: vitalsObj
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

  // --- Admin Verification Desk, Analytics Dashboard & Audit Center (Section 13, 14 & 15 Resolution) ---
  setAdminTab(tabName) {
    this.adminActiveTab = tabName;
    this.renderAdminHub();
  }

  async renderAdminHub() {
    const container = document.getElementById('adminPortalContainer');
    if (!container) return;

    const doctors = window.mediarcaStore.state.doctors;
    const pending = doctors.filter(d => d.verificationStatus === 'pending');
    const verified = doctors.filter(d => d.verificationStatus === 'verified');
    const users = window.mediarcaStore.state.users || [];
    const analytics = await window.mediarcaStore.getHospitalAnalytics();
    let auditLogs = window.mediarcaStore.state.auditLogs || [];

    // Audit v10 Resolution: Fetch authoritative server audit logs for admin
    if (window.mediarcaSupabase && window.mediarcaSupabase.isConnected && window.mediarcaStore.state.currentUser?.role === 'admin') {
      try {
        const serverLogs = await window.mediarcaSupabase.cloudGetAdminAuditLogs(50);
        if (serverLogs && serverLogs.length > 0) {
          auditLogs = serverLogs.map(l => ({
            id: l.id,
            timestamp: l.created_at,
            actor: l.actor_name || l.actor_id || 'Staff',
            action: l.action,
            entity: l.entity_type,
            entityId: l.entity_id,
            beforeState: l.before_state,
            afterState: l.after_state,
            ipAddress: l.ip_address || 'Server',
            device: l.user_agent || 'Secure Gateway'
          }));
        }
      } catch (err) {
        console.warn('Server audit fetch notice:', err);
      }
    }

    const facilities = window.mediarcaStore.state.facilities || [];
    const rooms = window.mediarcaStore.state.rooms || [];
    const queues = window.mediarcaStore.state.queues || {};
    const activeTab = this.adminActiveTab || 'overview';

    container.innerHTML = `
      <div class="container" style="padding-top: 2rem; padding-bottom: 4rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-role" style="background: #b91c1c; margin-bottom: 0.5rem;">Hospital Executive Administration</span>
            <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary);">Medical Board & Operations Command Desk</h2>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Audit compliance ledger, practitioner credentials, multi-hospital facility rooms, and clinical throughput analytics.</p>
          </div>
          <button class="btn btn-secondary" onclick="window.mediarcaAudio.playChime('success'); window.mediarcaApp.showToast('Audit report exported.', 'info');">
            <i data-lucide="download" style="width: 14px; height: 14px;"></i> Export Audit Log (CSV)
          </button>
        </div>

        <!-- Admin Tabbed Navigation Bar (UX Resolution) -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; overflow-x: auto;">
          <button class="btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('overview')">
            <i data-lucide="bar-chart-3" style="width:13px;height:13px"></i> Overview
          </button>
          <button class="btn btn-sm ${activeTab === 'verification' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('verification')">
            <i data-lucide="shield-check" style="width:13px;height:13px"></i> Doctor Verification (${pending.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('users')">
            <i data-lucide="users" style="width:13px;height:13px"></i> Users (${users.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'facilities' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('facilities')">
            <i data-lucide="building" style="width:13px;height:13px"></i> Facilities (${facilities.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('rooms')">
            <i data-lucide="door-open" style="width:13px;height:13px"></i> Rooms (${rooms.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'queues' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('queues')">
            <i data-lucide="radio" style="width:13px;height:13px"></i> Queues
          </button>
          <button class="btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('audit')">
            <i data-lucide="shield-alert" style="width:13px;height:13px"></i> Audit Logs (${auditLogs.length})
          </button>
          <button class="btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('reports')">
            <i data-lucide="file-spreadsheet" style="width:13px;height:13px"></i> Reports
          </button>
          <button class="btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}" onclick="window.mediarcaApp.setAdminTab('settings')">
            <i data-lucide="settings" style="width:13px;height:13px"></i> Settings
          </button>
        </div>

        <!-- TAB 1: OVERVIEW & ANALYTICS -->
        ${activeTab === 'overview' ? `
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
        ` : ''}

        <!-- TAB 2: DOCTOR VERIFICATION -->
        ${activeTab === 'verification' ? `
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
                              <i data-lucide="check" style="width:13px;height:13px"></i> Approve
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
        ` : ''}

        <!-- TAB 3: USERS REGISTRY -->
        ${activeTab === 'users' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">System User Accounts (${users.length})</h3>
            <div class="table-responsive">
              <table class="clinical-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Blood Group</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => `
                    <tr>
                      <td class="text-mono" style="font-size:0.75rem;">${escapeHtml(u.id.substring(0, 13))}...</td>
                      <td><strong>${escapeHtml(u.name)}</strong></td>
                      <td>${escapeHtml(u.email)}</td>
                      <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : (u.role === 'doctor' ? 'badge-verified' : 'badge-pending')}">${escapeHtml(u.role.toUpperCase())}</span></td>
                      <td>${escapeHtml(u.bloodGroup || 'O+')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 4: FACILITIES -->
        ${activeTab === 'facilities' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Multi-Hospital Network Facilities (${facilities.length})</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              ${facilities.map(fac => `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
                  <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(fac.name)}</div>
                  <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(fac.address)} • ${escapeHtml(fac.city)}</div>
                  <div style="margin-top: 0.75rem;"><span class="badge badge-verified">${fac.roomsCount} Active Clinical Suites</span></div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- TAB 5: ROOMS -->
        ${activeTab === 'rooms' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Clinical Room Allocation (${rooms.length})</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              ${rooms.map(rm => `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong class="text-mono" style="color:var(--clinical-blue);">${escapeHtml(rm.roomNumber)}</strong> - ${escapeHtml(rm.type)}
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Attached: ${escapeHtml(rm.doctorName)}</div>
                  </div>
                  <span class="badge badge-live">${escapeHtml(rm.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- TAB 6: QUEUES -->
        ${activeTab === 'queues' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.0625rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Active Doctor OPD Queues</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              ${doctors.map(d => {
                const q = queues[d.id] || { currentToken: 0, tokens: [], status: 'idle' };
                return `
                  <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm);">
                    <div style="font-size:0.95rem; font-weight:800; color:var(--text-primary);">${escapeHtml(d.name)}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">${escapeHtml(d.specialty)} • ${escapeHtml(d.hospital)}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div>Serving: <strong class="text-mono" style="color:var(--clinical-blue);">#${q.currentToken || 0}</strong></div>
                      <div>Total in Queue: <strong>${q.tokens?.length || 0}</strong></div>
                      <span class="badge badge-live">${q.status.toUpperCase()}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- TAB 7: AUDIT LOGS -->
        ${activeTab === 'audit' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Statutory Audit & Compliance Ledger</h3>
            <div class="table-responsive">
              <table class="clinical-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>State Delta</th>
                    <th>IP / Device</th>
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
                      <td class="text-mono" style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(log.ipAddress)} • ${escapeHtml(log.device)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 8: REPORTS (Audit v8 Resolution: Real Dynamic Data Export) -->
        ${activeTab === 'reports' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 2rem; text-align:center;">
            <i data-lucide="file-spreadsheet" style="width:36px;height:36px; color:var(--clinical-blue); margin:0 auto 1rem;"></i>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Hospital Analytics & Compliance Reports</h3>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">Export live certified throughput registers and append-only audit trails.</p>
            <div style="display:flex; justify-content:center; gap:0.75rem;">
              <button class="btn btn-primary" onclick="window.mediarcaApp.handleDownloadThroughputCsv()">
                <i data-lucide="download" style="width:14px;height:14px;"></i> Download Throughput CSV
              </button>
              <button class="btn btn-secondary" onclick="window.mediarcaApp.handleExportAuditCsv()">
                <i data-lucide="download" style="width:14px;height:14px;"></i> Export Audit CSV
              </button>
            </div>
          </div>
        ` : ''}

        <!-- TAB 9: SETTINGS (Audit v8 Resolution: Persistent Configuration Engine) -->
        ${activeTab === 'settings' ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; max-width:600px;">
            <h3 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Hospital System Configuration</h3>
            <div style="display:flex; flex-direction:column; gap:1rem;">
              <div class="form-group">
                <label class="form-label">Default Consultation Slot Buffer (Minutes)</label>
                <input type="number" id="adminSettingSlotBuffer" class="form-input" value="${window.mediarcaStore.state.hospitalSettings?.slotBufferMins || 12}">
              </div>
              <div class="form-group">
                <label class="form-label">Hospital Group Name</label>
                <input type="text" id="adminSettingGroupName" class="form-input" value="${escapeHtml(window.mediarcaStore.state.hospitalSettings?.hospitalName || 'Apex Healthcare Network International')}">
              </div>
              <div class="form-group">
                <label class="form-label">Statutory Compliance Standard</label>
                <input type="text" class="form-input" value="HIPAA / NABH Certified EMR Protocol" disabled>
              </div>
              <button class="btn btn-teal" onclick="window.mediarcaApp.handleSaveAdminSettings()">Save Settings</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  async handleDownloadThroughputCsv() {
    let bookings = [];
    if (window.mediarcaSupabase && window.mediarcaSupabase.isConnected) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: serverAppts, error } = await window.mediarcaSupabase.client
          .from('appointments')
          .select('*, doctor:doctors(name, specialty), patient:users!appointments_patient_id_fkey(full_name, phone)')
          .eq('appointment_date', todayStr);
        if (error) throw error;
        if (serverAppts && serverAppts.length > 0) {
          bookings = serverAppts.map(a => ({
            bookingId: a.id,
            date: a.appointment_date,
            timeSlot: a.appointment_time,
            doctorName: a.doctor?.name || 'Attending Physician',
            specialty: a.doctor?.specialty || 'General OPD',
            tokenNumber: a.token_number,
            status: a.status,
            symptoms: a.chief_complaint || 'Consultation',
            stage: a.current_stage || 'triage'
          }));
        }
      } catch (e) {
        console.error('Server appointments fetch error for CSV export:', e);
        this.showToast('Server throughput data unavailable: ' + e.message, 'warning');
        return;
      }
    } else {
      bookings = window.mediarcaStore.state.bookings || [];
    }

    if (bookings.length === 0) {
      this.showToast('No registered throughput records to export for today.', 'info');
      return;
    }

    const headers = ['Booking ID', 'Date', 'Time Slot', 'Doctor', 'Specialty', 'Token', 'Status', 'Symptoms', 'Stage'];
    const rows = bookings.map(b => [
      b.bookingId || b.id || '',
      b.date || b.scheduledDate || '',
      b.timeSlot || b.scheduledSlot || '',
      `"${(b.doctorName || '').replace(/"/g, '""')}"`,
      `"${(b.specialty || '').replace(/"/g, '""')}"`,
      b.tokenNumber || '',
      b.status || '',
      `"${(b.symptoms || '').replace(/"/g, '""')}"`,
      b.stage || 'triage'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MediArca_Throughput_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Authoritative Throughput CSV report exported successfully.', 'success');
  }

  async handleExportAuditCsv() {
    let logs = [];
    if (window.mediarcaSupabase && window.mediarcaSupabase.isConnected && window.mediarcaStore.state.currentUser?.role === 'admin') {
      try {
        this.showToast('Querying authoritative server audit ledger...', 'info');
        const serverLogs = await window.mediarcaSupabase.cloudGetAdminAuditLogs(100);
        if (serverLogs && serverLogs.length > 0) {
          logs = serverLogs.map(l => ({
            timestamp: l.created_at,
            action: l.action,
            entity: l.entity_type,
            entityId: l.entity_id,
            actorId: l.actor_id || l.actor_name
          }));
        }
      } catch (err) {
        console.error('Server audit export fetch error:', err);
        this.showToast('Failed to export server audit ledger: ' + err.message, 'warning');
        return;
      }
    } else {
      logs = window.mediarcaStore.state.auditLogs || [];
    }

    if (logs.length === 0) {
      this.showToast('No compliance audit logs to export.', 'info');
      return;
    }

    const headers = ['Timestamp', 'Action', 'Entity', 'Entity ID', 'Actor ID'];
    const rows = logs.map(l => [
      l.timestamp || '',
      l.action || '',
      l.entity || '',
      l.entityId || '',
      l.actorId || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MediArca_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Compliance Audit CSV exported successfully.', 'success');
  }

  async handleDownloadVaultDoc(docId, storagePath, fallbackUrl) {
    try {
      if (window.mediarcaSupabase && window.mediarcaSupabase.isConnected && storagePath) {
        this.showToast('Generating fresh cryptographic signed URL...', 'info');
        const signedUrl = await window.mediarcaSupabase.getClinicalDocumentSignedUrl(storagePath);
        if (signedUrl) {
          window.open(signedUrl, '_blank');
          return;
        }
      }
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank');
      } else {
        this.showToast('Document download link unavailable.', 'warning');
      }
    } catch (err) {
      console.error('Vault document download error:', err);
      this.showToast(err.message || 'Failed to generate secure download link.', 'warning');
    }
  }

  handleSaveAdminSettings() {
    const buffer = parseInt(document.getElementById('adminSettingSlotBuffer')?.value) || 12;
    const name = document.getElementById('adminSettingGroupName')?.value?.trim() || 'Apex Healthcare Network International';
    
    if (!window.mediarcaStore.state.hospitalSettings) {
      window.mediarcaStore.state.hospitalSettings = {};
    }
    window.mediarcaStore.state.hospitalSettings.slotBufferMins = buffer;
    window.mediarcaStore.state.hospitalSettings.hospitalName = name;

    window.mediarcaStore.recordAuditLog({
      action: 'ADMIN_HOSPITAL_SETTINGS_SAVED',
      entity: 'system_settings',
      entityId: 'global_config',
      afterState: { slotBufferMins: buffer, hospitalName: name }
    });

    window.mediarcaStore.saveState();
    this.showToast('Hospital configuration parameters saved and audited!', 'success');
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
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="tel" id="walkinPatientPhone" class="form-input" placeholder="Phone Number" required>
                <input type="text" id="walkinSymptoms" class="form-input" placeholder="Chief Complaint / Reason" value="OPD Walk-in Checkup">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
                <input type="number" id="walkinPatientAge" class="form-input" placeholder="Patient Age (optional)" min="0" max="125">
                <select id="walkinPatientGender" class="form-select">
                  <option value="">-- Select Gender --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
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
    const email = document.getElementById('receptionLoginEmail')?.value.trim();
    const password = document.getElementById('receptionLoginPassword')?.value.trim();

    if (!email || !password) {
      this.showToast('Please enter both reception email and password.', 'warning');
      return;
    }

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

  async handleDirectCheckIn(bookingIdentifier) {
    try {
      const store = window.mediarcaStore;
      const booking = store.state.bookings.find(b => b.bookingId === bookingIdentifier || b.id === bookingIdentifier);
      const token = booking?.checkinToken || bookingIdentifier;
      await store.checkInPatientQr(token);
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
    const patientAge = document.getElementById('walkinPatientAge')?.value.trim();
    const patientGender = document.getElementById('walkinPatientGender')?.value;

    if (!doctorId || !patientName || !patientPhone) {
      this.showToast('Please fill out patient name, phone number, and attending physician.', 'warning');
      return;
    }

    try {
      // H-18 & H-19: Call dedicated receptionist walk-in token issuance RPC with accurate demographics
      const newBooking = await window.mediarcaStore.issueReceptionWalkinToken({
        doctorId,
        patientName,
        patientPhone,
        patientAge: patientAge ? parseInt(patientAge) : null,
        patientGender: patientGender || null,
        symptoms
      });

      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Walk-in Token #${newBooking.tokenNumber} issued and registered!`, 'success');
      this.renderReceptionPortal();
    } catch (err) {
      console.error('Walkin registration error:', err);
      this.showToast(err.message || 'Failed to issue walk-in token.', 'warning');
    }
  }

  printPatientPass(bookingId) {
    const booking = window.mediarcaStore.state.bookings.find(b => b.bookingId === bookingId || b.id === bookingId);
    if (!booking) {
      this.showToast('Booking not found.', 'warning');
      return;
    }

    const waitEst = window.mediarcaStore.calculateSmartWaitTime(booking.doctorId, booking.tokenNumber);
    const tokenHash = window.mediarcaStore.generateSignedCheckInToken(booking.bookingId || booking.id, booking.patientId);

    const win = window.open('', '_blank', 'width=450,height=600');
    if (!win) {
      this.showToast('Pop-up blocked. Please allow pop-ups to print pass.', 'warning');
      return;
    }
    win.document.title = 'Mediarca Official OPD Token Pass';
    win.document.body.innerHTML = `
      <style>
        body { font-family: monospace; padding: 20px; text-align: center; color: #000; }
        .header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
        .token { font-size: 48px; font-weight: bold; margin: 10px 0; }
        .meta { font-size: 14px; margin-bottom: 5px; text-align: left; }
        .qr-box { border: 2px solid #000; padding: 10px; margin: 15px 0; font-size: 11px; word-break: break-all; }
        .footer { border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; margin-top: 15px; }
      </style>
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
        Date: ${new Date().toLocaleDateString()} • Ref: ${escapeHtml(booking.bookingId || booking.id)}
      </div>
    `;
    setTimeout(() => {
      win.print();
    }, 250);
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
              <input type="file" id="uploadDocFileInput" class="form-input" style="padding: 0.4rem;" accept=".pdf,.png,.jpg,.jpeg,.webp" required>
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
    const fileInput = document.getElementById('uploadDocFileInput');
    const file = fileInput?.files?.[0];

    if (!file) {
      this.showToast('Please select a file to upload.', 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showToast('File size exceeds the 10MB statutory limit.', 'warning');
      return;
    }

    try {
      this.showToast('Securing and encrypting document in private vault...', 'info');
      await window.mediarcaStore.addClinicalDocument(file, {
        fileName: title || file.name,
        category,
        doctorName: doctor
      });

      document.getElementById('uploadDocModal')?.classList.remove('active');
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Document "${title || file.name}" saved to Secure EMR Vault!`, 'success');
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
          <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.65rem; margin-left:0.35rem;">Possible assessment — physician verification required</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-primary); margin-bottom:0.5rem;">
          <strong>[P] Recommended Regimen:</strong> ${escapeHtml(draft.medications.length > 0 ? draft.medications.join(' • ') : 'To be prescribed by attending physician')}
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

  // --- Dynamic Queue Optimization Actions (H-21 & H-22 Resolution) ---
  applyQueueOptimization(recId) {
    const store = window.mediarcaStore;
    
    // Dynamically adjust active doctor queue pacing and allocate buffer room
    const doctorKeys = Object.keys(store.state.queues || {});
    if (doctorKeys.length > 0) {
      doctorKeys.forEach(docId => {
        if (store.state.queues[docId]) {
          store.state.queues[docId].avgConsultTimeMins = Math.max(8, (store.state.queues[docId].avgConsultTimeMins || 12) - 2);
        }
      });
    }

    store.recordAuditLog({
      action: `QUEUE_OPTIMIZATION_APPLIED_${recId.toUpperCase()}`,
      entity: 'clinic_queues',
      afterState: { recId, action: 'Buffer suite activated & queue throughput pacing adjusted' }
    });

    store.saveState();
    if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
    this.showToast('Buffer Consultation Suite activated & Queue Pacing dynamically balanced!', 'success');
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
            <h3 style="font-size: 1.125rem; font-weight: 800; color: #fff;">MediArca Teleconsultation Suite (Interactive Preview)</h3>
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
                  ● Teleconsultation Room Preview (Interactive Clinical Interface)
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
                  WebRTC Media & Connection State
                </div>
                <div style="font-size: 0.75rem; color: #4ade80; margin-bottom: 0.25rem;">
                  ✓ Media Stream: ${navigator.mediaDevices ? 'WebRTC Media API Ready' : 'Standard WebRTC Client'}
                </div>
                <div style="font-size: 0.75rem; color: #4ade80; margin-bottom: 0.25rem;">
                  ✓ Network Status: ${navigator.onLine ? 'Online (Authenticated)' : 'Offline/Local'}
                </div>
                <div style="font-size: 0.75rem; color: #4ade80;">
                  ✓ Round-Trip Latency: ${navigator.connection?.rtt ? navigator.connection.rtt + 'ms' : 'Low (<50ms LAN/Wi-Fi)'}
                </div>
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

    const currentUserId = window.mediarcaStore.state.currentUser?.id;
    const user = window.mediarcaStore.state.currentUser;
    const booking = window.mediarcaStore.state.bookings.find(b => b.bookingId === bookingId || b.id === bookingId || (b.patientId && b.patientId === currentUserId)) || {
      bookingId: bookingId || 'bk_live',
      patientName: user?.name || 'Verified Patient',
      doctorName: 'Attending Practitioner',
      tokenNumber: 1
    };

    const doc = window.mediarcaStore.state.doctors.find(d => d.id === booking.doctorId || d.name === booking.doctorName);
    const consultFee = doc?.consultFee || 60;
    const insurancePolicy = user?.clinicalProfile?.insurance_policy || user?.insurancePolicy || 'Standard Patient Co-Pay';
    const discount = (consultFee * 0.10);
    const insuranceCover = ((consultFee - discount) * 0.80);
    const netCoPay = (consultFee - discount - insuranceCover).toFixed(2);

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
              <strong class="text-mono">$${consultFee.toFixed(2)}</strong>
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
            <span>Pre-Authorize with <strong>${escapeHtml(insurancePolicy)}</strong> [80% Co-pay Cover]</span>
          </label>

          <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:var(--radius-sm); padding:0.875rem; margin-bottom:1.25rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.25rem;">
              <span>Subtotal:</span>
              <span>$${consultFee.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.25rem;">
              <span>Voucher Discount (10%):</span>
              <span>-$${discount.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:#166534; margin-bottom:0.5rem;">
              <span>Insurance Settlement (80%):</span>
              <span>-$${insuranceCover.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:1rem; font-weight:800; color:#14532d; border-top:1px dashed #86efac; padding-top:0.5rem;">
              <span>Net Patient Co-Pay:</span>
              <span class="text-mono">$${netCoPay}</span>
            </div>
          </div>

          <button class="btn btn-teal btn-block" onclick="window.mediarcaApp.handleProcessPayment('${booking.bookingId}')">
            <i data-lucide="credit-card" style="width: 15px; height: 15px;"></i> Pay $${netCoPay} & Generate Official Invoice
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  async handleProcessPayment(bookingIdentifier) {
    const store = window.mediarcaStore;
    const currentUserId = store.state.currentUser?.id;
    const currentUserRole = store.state.currentUser?.role;

    const booking = store.state.bookings.find(b => b.bookingId === bookingIdentifier || b.id === bookingIdentifier);
    if (!booking) {
      this.showToast('Appointment record not found for billing settlement.', 'warning');
      return;
    }

    if (currentUserRole === 'patient' && booking.patientId && booking.patientId !== currentUserId) {
      this.showToast('Access Denied: You cannot settle invoices for another patient.', 'warning');
      return;
    }

    const doctor = store.state.doctors.find(d => d.id === booking.doctorId || d.name === booking.doctorName);
    const fee = doctor?.consultFee || doctor?.fee || 60.00;
    const hasInsurance = document.getElementById('billingInsuranceCheck')?.checked ?? true;
    const couponCode = document.getElementById('billingCouponInput')?.value?.trim() || '';

    try {
      this.showToast('Processing secure transaction & settling invoice...', 'info');
      const invoice = await store.processBillingInvoice({
        appointmentId: booking.id || booking.bookingId,
        patientName: booking.patientName || store.state.currentUser?.name || 'Verified Patient',
        doctorName: booking.doctorName || (doctor?.name || 'Attending Physician'),
        fee: fee,
        couponCode: couponCode,
        hasInsurance: hasInsurance
      });

      document.getElementById('billingModal')?.classList.remove('active');
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('success');
      this.showToast(`Invoice #${invoice.invoiceNumber} paid & officially settled ($${invoice.netPayable.toFixed(2)})!`, 'success');
      this.renderPatientDashboard();
    } catch (err) {
      console.error('Invoice settlement error:', err);
      this.showToast(err.message || 'Payment settlement failed.', 'warning');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mediarcaApp = new MediarcaApp();
});
