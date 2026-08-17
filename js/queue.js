/**
 * Mediarca Live Queue Engine & QueueLine Radar
 * Clean, high-contrast clinical HUD with instant token telemetry and digital pass QR pass
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
      (d.mediarcaId && d.mediarcaId.toUpperCase() === q) ||
      (d.name || '').toUpperCase().includes(q) ||
      (d.specialty || '').toUpperCase().includes(q)
    );
    if (doc) {
      this.selectedDoctorId = doc.id;
      this.renderQueueRadar();
      return true;
    }

    // Check user's own active pass reference (P-04 Resolution)
    const booking = store.state.bookings.find(b => 
      b.patientId === store.state.currentUser?.id &&
      (b.bookingId || '').toUpperCase() === q
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
    const doctor = store.state.doctors.find(d => d.id === this.selectedDoctorId) || verifiedDocs[0] || store.state.doctors[0];
    if (!doctor) return;
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
      userBooking = store.state.bookings.find(b => b.doctorId === doctor.id && (b.status === 'waiting' || b.status === 'in-consultation'));
    }
    const yourToken = userBooking ? userBooking.tokenNumber : null;

    let waitMins = 0;
    let peopleAhead = 0;
    let smartWait = { rangeText: '--', confidence: 'High', statusText: 'No wait' };

    if (yourToken && yourToken !== currentToken) {
      const activeAhead = (queue.tokens || []).filter(t => t.tokenNumber < yourToken && (t.status === 'waiting' || t.status === 'in-consultation'));
      peopleAhead = activeAhead.length;
      smartWait = store.calculateSmartWaitTime(doctor.id, yourToken);
      waitMins = smartWait.estimatedWaitMins || (peopleAhead * (queue.avgConsultTimeMins || 12));
    }

    // Sound chime trigger on token update
    if (this.lastServedToken !== null && this.lastServedToken !== currentToken && currentToken > 0) {
      if (window.mediarcaAudio) window.mediarcaAudio.playChime('queue-call');
      if (yourToken === currentToken) {
        window.mediarcaApp.showToast(`🔔 It's your turn! Please proceed to: ${doctor.hospital}`, 'success');
      }
    }
    this.lastServedToken = currentToken;

    container.innerHTML = `
      <div style="max-width: 960px; margin: 0 auto; padding-top: 1.5rem; padding-bottom: 3rem;">
        
        <!-- Back Navigation Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="btn btn-sm btn-secondary" onclick="window.mediarcaApp.switchView('patient-portal')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700;">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> Back to My Appointments
          </button>
          
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; max-width: 380px;">
            <input type="text" id="radarSearchInput" placeholder="Lookup Doctor ID or Booking Ref..." class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.8125rem; background: #ffffff;" onkeydown="if(event.key === 'Enter') window.mediarcaQueueEngine.handleSearchSubmit()">
            <button class="btn btn-sm btn-primary" onclick="window.mediarcaQueueEngine.handleSearchSubmit()" style="padding: 0.4rem 0.75rem; font-size: 0.8125rem;">
              <i data-lucide="search" style="width: 13px; height: 13px;"></i>
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge badge-verified" style="font-size: 0.75rem; padding: 0.3rem 0.75rem;">
              <span class="pulse-beacon"></span> Live OPD Telemetry Feed
            </span>
          </div>
        </div>

        <!-- Clinical Radar Screen Box -->
        <div class="radar-hud-box">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <img src="${sanitizeImageUrl(doctor.avatar)}" style="width: 48px; height: 48px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <h3 style="font-size: 1.25rem; font-weight: 800; color: #ffffff;">${escapeHtml(doctor.name)}</h3>
                  <span class="badge badge-verified"><i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Verified</span>
                </div>
                <div style="font-size: 0.8125rem; color: #a1a1aa;">${escapeHtml(doctor.specialty)} • ${escapeHtml(doctor.hospital)}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <span class="doctor-id-tag text-mono" style="background: rgba(255,255,255,0.1); color: #38bdf8; border-color: rgba(255,255,255,0.2);">
                ${escapeHtml(doctor.mediarcaId || 'PENDING')}
              </span>
              <div style="font-size: 0.75rem; color: #a1a1aa; margin-top: 0.25rem;">
                Status: <strong style="color: #ffffff;">${escapeHtml(queue.status.toUpperCase())}</strong>
              </div>
            </div>
          </div>

          <div class="radar-hud-grid">
            <div class="radar-hud-metric-tile">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: #a1a1aa; font-weight: 700; margin-bottom: 0.35rem;">Now Serving</div>
              <div class="radar-hud-num-large">${currentToken > 0 ? '#' + currentToken : 'IDLE'}</div>
              <div style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; margin-top: 0.35rem;">In Consultation</div>
            </div>

            <div class="radar-hud-metric-tile">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: #a1a1aa; font-weight: 700; margin-bottom: 0.35rem;">Your Token</div>
              <div class="radar-hud-num-large" style="color: #4ade80;">${yourToken ? '#' + yourToken : '--'}</div>
              <div style="font-size: 0.75rem; color: #86efac; font-weight: 600; margin-top: 0.35rem;">
                ${yourToken === currentToken ? '✨ YOU ARE BEING CALLED' : (yourToken ? `${peopleAhead} ahead of you` : 'No active ticket')}
              </div>
            </div>

            <div class="radar-hud-metric-tile">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: #a1a1aa; font-weight: 700; margin-bottom: 0.35rem;">Est. Wait Time</div>
              <div class="radar-hud-num-large" style="color: #fbbf24; font-size: 2.25rem;">
                ${yourToken && yourToken > currentToken ? '~' + waitMins + 'm' : (yourToken === currentToken ? '0 min' : '--')}
              </div>
              <div style="font-size: 0.75rem; color: #fde047; font-weight: 600; margin-top: 0.35rem;">
                Avg ${queue.avgConsultTimeMins}m / patient
              </div>
            </div>
          </div>
        </div>

        <!-- Progression Strip -->
        <div class="queue-track-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div>
              <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">Live Line Sequence</h4>
              <p style="font-size: 0.8125rem; color: var(--text-secondary);">Today's queue order for ${escapeHtml(doctor.name)}</p>
            </div>
          </div>

          <div class="queue-tokens-horizontal">
            ${this.renderTokenPills(queue.tokens, currentToken, yourToken)}
          </div>
        </div>

        <!-- Digital Pass Card -->
        ${userBooking ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1.25rem;">
              <div style="width: 72px; height: 72px; background: #ffffff; border: 2px solid var(--border-strong); padding: 4px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                  <path d="M14 14h3v3h-3z"></path>
                  <path d="M18 18h3v3h-3z"></path>
                  <path d="M18 14h3v1h-3z"></path>
                </svg>
              </div>
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Digital Hospital OPD Pass</div>
                <div style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary);">Booking: ${escapeHtml(userBooking.bookingId)} • Token #${userBooking.tokenNumber}</div>
                <div style="font-size: 0.8125rem; color: var(--text-secondary);">Patient: <strong>${escapeHtml(userBooking.patientName)}</strong> (${userBooking.patientAge}y) • ${escapeHtml(userBooking.hospital)}</div>
              </div>
            </div>
            <button class="btn btn-secondary" onclick="window.print()">
              <i data-lucide="printer" style="width: 15px; height: 15px;"></i> Print Token Pass
            </button>
          </div>
        ` : `
          <div style="text-align: center; padding: 2rem; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: var(--radius-md);">
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">Need an appointment with ${escapeHtml(doctor.name)}?</p>
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
      return `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.875rem;">No active tokens in queue.</div>`;
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
          <span style="font-size: 0.65rem; text-transform: uppercase; font-weight: 700; opacity: 0.8;">${statusLabel}</span>
          <span class="text-mono" style="font-size: 1.5rem; font-weight: 800; line-height: 1.2;">#${t.tokenNumber}</span>
          <span style="font-size: 0.65rem; opacity: 0.75;">
            Slot #${t.tokenNumber}
          </span>
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
