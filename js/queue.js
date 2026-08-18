/**
 * Mediarca Live Queue Engine & QueueLine Radar
 * Pure Apple Design System (Light, High-End SF Aesthetics, Frosted Telemetry Pods)
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

class MediarcaQueueEngine {
  constructor() {
    this.selectedDoctorId = null;
    this.lastServedToken = null;
  }

  setDoctor(doctorId) {
    this.selectedDoctorId = doctorId;
    this.renderQueueRadar();
  }

  lookupByQuery(query) {
    const q = (query || '').trim().toUpperCase();
    const store = window.mediarcaStore;
    if (!q) return false;
    
    // Check if query matches doctor ID, Mediarca ID, name, or specialty
    const doc = store.state.doctors.find(d => 
      (d.id || '').toUpperCase() === q || 
      (d.userId || '').toUpperCase() === q ||
      (d.mediarcaId && d.mediarcaId.toUpperCase() === q) ||
      (d.name || '').toUpperCase().includes(q) ||
      (d.specialty || '').toUpperCase().includes(q)
    );
    if (doc) {
      this.selectedDoctorId = doc.id;
      this.renderQueueRadar();
      return true;
    }

    // Check user's own active pass reference
    const booking = store.state.bookings.find(b => 
      (b.patientId === store.state.currentUser?.id || store.state.currentUser?.role === 'doctor') &&
      ((b.bookingId || '').toUpperCase() === q || (b.id || '').toUpperCase() === q)
    );
    if (booking) {
      this.selectedDoctorId = booking.doctorId;
      this.renderQueueRadar(booking);
      return true;
    }

    return false;
  }

  renderQueueRadar(highlightBooking = null) {
    const container = document.getElementById('queueRadarViewContainer');
    if (!container) return;

    const store = window.mediarcaStore;
    const verifiedDocs = (store.state.doctors || []).filter(d => d.verificationStatus === 'verified');
    const doctor = store.state.doctors.find(d => 
      d.id === this.selectedDoctorId || 
      d.userId === this.selectedDoctorId ||
      (d.email && store.state.currentUser?.email && d.email.toLowerCase() === store.state.currentUser.email.toLowerCase())
    ) || verifiedDocs[0] || (store.state.doctors || [])[0] || {
      id: 'default_doc',
      name: 'Dr. Aris Thorne',
      specialty: 'Cardiology',
      hospital: 'Metro Heart Institute',
      mediarcaId: 'MED-DOC-1082',
      avgConsultTimeMins: 12
    };

    this.selectedDoctorId = doctor.id;

    const queue = store.state.queues[doctor.id] || {
      doctorId: doctor.id,
      status: 'idle',
      currentToken: 0,
      avgConsultTimeMins: doctor.avgConsultTimeMins || 12,
      tokens: []
    };

    const currentToken = queue.currentToken || 0;
    
    // Determine user token
    let userBooking = highlightBooking;
    if (!userBooking && store.state.currentUser?.role === 'patient') {
      userBooking = store.state.bookings.find(b => 
        (b.patientId === store.state.currentUser.id || (b.patientPhone && b.patientPhone === store.state.currentUser.phone)) &&
        b.doctorId === doctor.id && 
        (b.status === 'waiting' || b.status === 'in-consultation' || b.status === 'checked_in')
      );
    }
    const yourToken = userBooking ? userBooking.tokenNumber : null;

    let waitMins = 0;
    let peopleAhead = 0;
    let smartWait = { rangeText: '--', confidence: 'High', statusText: 'No wait' };

    if (yourToken && yourToken !== currentToken) {
      const activeAhead = (queue.tokens || []).filter(t => t.tokenNumber < yourToken && (t.status === 'waiting' || t.status === 'in-consultation'));
      peopleAhead = activeAhead.length;
      if (typeof store.calculateSmartWaitTime === 'function') {
        smartWait = store.calculateSmartWaitTime(doctor.id, yourToken);
        waitMins = smartWait.estimatedWaitMins || (peopleAhead * (queue.avgConsultTimeMins || 12));
      } else {
        waitMins = peopleAhead * (queue.avgConsultTimeMins || 12);
      }
    }

    // Sound chime trigger on token update
    if (this.lastServedToken !== null && this.lastServedToken !== currentToken && currentToken > 0) {
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('queue-call');
      if (yourToken === currentToken) {
        window.mediarcaApp.showToast(`🔔 It's your turn! Please proceed to: ${doctor.hospital}`, 'success');
      }
    }
    this.lastServedToken = currentToken;

    // Back destination based on role
    const isDoctorUser = store.state.currentUser?.role === 'doctor';
    const backView = isDoctorUser ? 'doctor-portal' : (store.state.currentUser?.role === 'admin' ? 'admin-portal' : 'patient-portal');
    const backLabel = isDoctorUser ? 'Back to Practice Console' : (store.state.currentUser?.role === 'admin' ? 'Back to Verification Desk' : 'Back to My Bookings');

    container.innerHTML = `
      <div style="max-width: 980px; margin: 0 auto; padding-top: 1.5rem; padding-bottom: 4rem;">
        
        <!-- Apple Action Navigation Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <button class="btn btn-sm btn-pearl" onclick="window.mediarcaApp.switchView('${backView}')">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> ${backLabel}
          </button>
          
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; max-width: 360px;">
            <input type="text" id="radarSearchInput" placeholder="Lookup Doctor ID or Booking Ref..." class="search-input" style="height: 38px; font-size: 0.8125rem; padding-left: 1rem !important;" onkeydown="if(event.key === 'Enter') window.mediarcaQueueEngine.handleSearchSubmit()">
            <button class="btn btn-sm btn-primary" aria-label="Search queue" onclick="window.mediarcaQueueEngine.handleSearchSubmit()" style="padding: 0 16px; height: 38px;">
              <i data-lucide="search" style="width: 14px; height: 14px;"></i>
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge badge-verified" style="font-size: 0.775rem; padding: 5px 12px;">
              <span class="pulse-beacon"></span> Live OPD Telemetry Feed
            </span>
          </div>
        </div>

        <!-- Apple Pure Clinical Radar Card -->
        <div class="radar-apple-card" style="margin-bottom: 1.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1.15rem;">
              <div style="position: relative; width: 64px; height: 64px;">
                <img src="${sanitizeImageUrl(doctor.avatar)}" style="width: 64px; height: 64px; border-radius: 18px; object-fit: cover; border: 1px solid rgba(0,0,0,0.08); display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <span style="position: absolute; bottom: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; background: #34c759; border: 2.5px solid #ffffff;"></span>
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <h3 style="font-size: 1.35rem; font-weight: 600; color: #1d1d1f; margin: 0; letter-spacing: -0.02em;">${escapeHtml(doctor.name)}</h3>
                  <span class="badge badge-verified"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Verified</span>
                </div>
                <div style="font-size: 0.875rem; color: #0066cc; font-weight: 500; margin-top: 0.2rem;">${escapeHtml(doctor.specialty || 'Specialist')}</div>
                <div style="font-size: 0.8125rem; color: #86868b; margin-top: 0.15rem;">${escapeHtml(doctor.hospital || 'Hospital Suite')}</div>
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 0.6875rem; color: #86868b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em;">Official Mediarca ID</div>
              <div style="font-size: 1.35rem; font-weight: 700; color: #0066cc; letter-spacing: -0.01em; margin-top: 0.1rem;">
                ${escapeHtml(doctor.mediarcaId || 'MED-DOC-7700')}
              </div>
            </div>
          </div>

          <!-- 3 Frosted Apple Telemetry Pods -->
          <div class="radar-telemetry-grid">
            <div class="radar-pod">
              <div class="radar-pod-label">Now Serving</div>
              <div class="radar-pod-val" style="color: #0071e3;">${currentToken > 0 ? '#' + currentToken : 'IDLE'}</div>
              <div class="radar-pod-sub">In Consultation Room</div>
            </div>

            <div class="radar-pod">
              <div class="radar-pod-label">Your Token</div>
              <div class="radar-pod-val" style="color: #34c759;">${yourToken ? '#' + yourToken : '—'}</div>
              <div class="radar-pod-sub" style="color: ${yourToken === currentToken ? '#059669' : '#86868b'}; font-weight: ${yourToken === currentToken ? '600' : '500'};">
                ${yourToken === currentToken ? '✨ YOU ARE BEING CALLED' : (yourToken ? `${peopleAhead} patient${peopleAhead > 1 ? 's' : ''} ahead` : 'No active booking')}
              </div>
            </div>

            <div class="radar-pod">
              <div class="radar-pod-label">Est. Wait Time</div>
              <div class="radar-pod-val" style="color: #ff9500;">
                ${yourToken && yourToken > currentToken ? '~' + waitMins + 'm' : (yourToken === currentToken ? '0 min' : '—')}
              </div>
              <div class="radar-pod-sub">
                Avg ${queue.avgConsultTimeMins || 12}m / consultation
              </div>
            </div>
          </div>
        </div>

        <!-- Apple Live Line Sequence Strip -->
        <div class="radar-apple-card" style="margin-bottom: 1.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
            <div>
              <h4 style="font-size: 1.15rem; font-weight: 600; color: #1d1d1f; margin: 0; letter-spacing: -0.02em;">Live Queue Sequence</h4>
              <p style="font-size: 0.8125rem; color: #86868b; margin: 0.2rem 0 0;">Continuous progression for today's OPD session</p>
            </div>
          </div>

          <div class="queue-tokens-horizontal">
            ${this.renderTokenPills(queue.tokens, currentToken, yourToken)}
          </div>
        </div>

        <!-- Digital Pass or Booking CTA Card -->
        ${userBooking ? `
          <div class="radar-apple-card" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1.25rem;">
              <div style="width: 64px; height: 64px; background: #f5f5f7; border: 1px solid rgba(0,0,0,0.06); padding: 8px; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                  <path d="M14 14h3v3h-3z"></path>
                  <path d="M18 18h3v3h-3z"></path>
                  <path d="M18 14h3v1h-3z"></path>
                </svg>
              </div>
              <div>
                <div style="font-size: 0.6875rem; color: #86868b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Official Digital OPD Pass</div>
                <div style="font-size: 1.2rem; font-weight: 600; color: #1d1d1f; letter-spacing: -0.01em;">Token #${userBooking.tokenNumber} • Ref: <span style="font-family: monospace; color: #0066cc;">${escapeHtml(userBooking.bookingId || userBooking.id)}</span></div>
                <div style="font-size: 0.8125rem; color: #86868b; margin-top: 0.2rem;">Patient: <strong style="color: #1d1d1f;">${escapeHtml(userBooking.patientName || 'Patient')}</strong> (${userBooking.patientAge || '30'}y) • ${escapeHtml(doctor.hospital || 'Hospital')}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-pearl" onclick="window.print()">
              <i data-lucide="printer" style="width: 14px; height: 14px; color: #0066cc;"></i> Print Token Pass
            </button>
          </div>
        ` : `
          <div style="text-align: center; padding: 2.5rem; background: #f5f5f7; border: 1px solid rgba(0,0,0,0.06); border-radius: 20px;">
            <p style="color: #86868b; font-size: 0.875rem; margin-bottom: 1rem;">Need an appointment with ${escapeHtml(doctor.name)}?</p>
            <button class="btn btn-primary" onclick="window.mediarcaApp.openBookingModal('${doctor.id}')">
              <i data-lucide="calendar-plus" style="width: 15px; height: 15px;"></i> Book Next Available Token
            </button>
          </div>
        `}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  renderTokenPills(tokens, currentToken, yourToken) {
    if (!tokens || tokens.length === 0) {
      return `
        <div style="padding: 1.5rem; color: #86868b; font-size: 0.875rem; text-align: center; width: 100%; background: #f5f5f7; border-radius: 14px;">
          No active patient tokens currently in queue.
        </div>
      `;
    }

    return tokens.map(t => {
      const isCurrent = t.tokenNumber === currentToken;
      const isCompleted = t.tokenNumber < currentToken || t.status === 'completed';
      const isYours = t.tokenNumber === yourToken;

      let pillClass = 'queue-token-pill';
      let statusLabel = 'WAITING';

      if (isCurrent) {
        pillClass += ' active';
        statusLabel = 'SERVING';
      } else if (isCompleted) {
        pillClass += ' completed';
        statusLabel = 'DONE';
      } else if (isYours) {
        pillClass += ' yours';
        statusLabel = 'YOURS';
      }

      return `
        <div class="${pillClass}">
          <span class="pill-tag">${statusLabel}</span>
          <span class="pill-num">#${t.tokenNumber}</span>
          <span class="pill-slot">Slot #${t.tokenNumber}</span>
        </div>
      `;
    }).join('');
  }

  handleSearchSubmit() {
    const input = document.getElementById('radarSearchInput');
    if (!input || !input.value.trim()) return;
    const found = this.lookupByQuery(input.value.trim());
    if (!found) {
      window.mediarcaApp.showToast('No booking or doctor found matching your search.', 'warning');
    } else {
      window.mediarcaApp.showToast('Queue loaded successfully.', 'info');
    }
  }
}

window.mediarcaQueueEngine = new MediarcaQueueEngine();
