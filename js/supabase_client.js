/**
 * Mediarca Supabase Cloud Database & Supabase Auth Client
 * Authoritative Supabase Auth JWT, Real-time PostgreSQL sync for queues, doctors, bookings, and audit logs
 */

const SUPABASE_CONFIG = {
  url: 'https://pkvwnsigucncdwrjtggs.supabase.co',
  key: 'sb_publishable_ZU0BqFxZTXdTOxUOmhRr1w_CR3myIy8'
};

class MediarcaSupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    if (window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        this.isConnected = true;
        console.log('✅ Mediarca Cloud DB & Supabase Auth Connected:', SUPABASE_CONFIG.url);
        this.setupAuthListener();
        this.setupRealtimeSubscriptions();
        this.syncInitialDataFromCloud();
      } catch (err) {
        console.warn('⚠️ Supabase connection notice:', err);
      }
    }
  }

  // --- 1. SUPABASE AUTH INTEGRATION (C-01 & C-02 Resolution) ---
  setupAuthListener() {
    if (!this.client) return;

    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log('⚡ Supabase Auth State Changed:', event, session?.user?.email);
      if (session && session.user) {
        const user = session.user;
        // Query user role and practitioner profile from database
        try {
          const { data: profile } = await this.client
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          const { data: doctorProfile } = await this.client
            .from('doctors')
            .select('*')
            .eq('user_id', user.id)
            .single();

          const role = profile?.role || (doctorProfile ? 'doctor' : (user.user_metadata?.role || 'patient'));
          const name = profile?.full_name || doctorProfile?.name || user.user_metadata?.name || user.email.split('@')[0];

          window.mediarcaStore.setAuthSession({
            id: user.id,
            email: user.email,
            role: role,
            name: name,
            jwt: session.access_token,
            doctorProfile: doctorProfile || null,
            patientProfile: profile || null
          });
        } catch (e) {
          console.warn('Profile fetch note:', e);
        }
      }
    });
  }

  async authSignUp(email, password, metadata = {}) {
    if (!this.client) throw new Error('Supabase client unavailable');

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) throw error;

    if (data.user) {
      // Upsert profile in users table
      await this.client.from('users').upsert({
        id: data.user.id,
        email: email.toLowerCase().trim(),
        role: metadata.role || 'patient',
        full_name: metadata.name || email.split('@')[0],
        phone: metadata.phone || null,
        age: metadata.age || null,
        gender: metadata.gender || null,
        blood_group: metadata.bloodGroup || null
      });
    }

    return data;
  }

  async authSignIn(email, password) {
    if (!this.client) throw new Error('Supabase client unavailable');

    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim()
    });

    if (error) throw error;
    return data;
  }

  async authSignOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
  }

  async getCurrentSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  // --- 2. PRIVACY-SAFE REALTIME TELEMETRY SUBSCRIPTIONS (P-03 Resolution) ---
  setupRealtimeSubscriptions() {
    if (!this.client) return;

    try {
      // Exclusively listen for Realtime Queue Telemetry (Never subscribe to sensitive internal tables)
      this.client
        .channel('public:clinic_queues')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_queues' }, payload => {
          if (payload.new && payload.new.doctor_id) {
            const queue = window.mediarcaStore.state.queues[payload.new.doctor_id];
            if (queue) {
              queue.currentToken = payload.new.current_token;
              queue.status = payload.new.status;
            }
            window.mediarcaStore.notifySubscribers();
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription note:', e);
    }
  }

  // --- 3. CLOUD REPOSITORY OPERATIONS ---
  async syncInitialDataFromCloud() {
    if (!this.client) return;

    try {
      // 1. Fetch Verified Doctors from sanitized Public Directory View (P-02 Resolution)
      const { data: docs, error: docErr } = await this.client
        .from('public_doctor_directory')
        .select('*')
        .order('rating', { ascending: false });

      if (!docErr && docs && docs.length > 0) {
        window.mediarcaStore.state.doctors = docs.map(d => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
          specialtyId: d.specialty_id,
          title: d.title,
          degrees: d.degrees,
          verificationStatus: d.verification_status,
          experienceYears: d.experience_years,
          hospital: d.hospital,
          fee: parseFloat(d.fee),
          rating: parseFloat(d.rating),
          reviewsCount: d.reviews_count,
          avatar: d.avatar,
          bio: d.bio,
          schedule: d.schedule,
          mediarcaId: d.mediarca_id,
          currentToken: d.current_token || 0,
          totalTokens: d.total_tokens || 0,
          avgConsultTimeMins: d.avg_consult_time_mins || 12
        }));
      }

      // 2. Fetch Live Clinic Queues
      const { data: queues, error: qErr } = await this.client
        .from('clinic_queues')
        .select('*')
        .eq('queue_date', new Date().toISOString().split('T')[0]);

      if (!qErr && queues && queues.length > 0) {
        queues.forEach(q => {
          window.mediarcaStore.state.queues[q.doctor_id] = {
            doctorId: q.doctor_id,
            currentToken: q.current_token,
            status: q.status,
            avgConsultTimeMins: q.avg_consult_time_mins || 12,
            tokens: []
          };
        });
      }

      window.mediarcaStore.notifySubscribers();
    } catch (err) {
      console.warn('Initial cloud hydration notice:', err);
    }
  }

  // --- 4. ATOMIC AUTHORIZED STORED PROCEDURES (C-04 & C-05) ---
  async cloudBookAppointment(bookingObj) {
    if (!this.client) throw new Error('Cloud offline');

    // Call authoritative RPC: patient identity derived via auth.uid() on server
    const { data, error } = await this.client.rpc('issue_next_opd_token', {
      p_doctor_id: bookingObj.doctorId,
      p_symptoms: bookingObj.symptoms || 'General Consultation'
    });

    if (error) {
      console.error('RPC Booking Error:', error);
      throw error;
    }

    return data;
  }

  async cloudAdvanceQueue(doctorId) {
    if (!this.client) throw new Error('Cloud offline');

    // Call authoritative RPC: caller verified against doctor ownership on server
    const { data, error } = await this.client.rpc('advance_doctor_queue_atomic', {
      p_doctor_id: doctorId
    });

    if (error) {
      console.error('RPC Advance Error:', error);
      throw error;
    }

    return data;
  }

  async cloudSavePrescription(doctorId, tokenNumber, rxData) {
    if (!this.client) throw new Error('Cloud offline');

    // Call atomic transactional RPC: updates appointment, advances queue, and logs audit
    const { data, error } = await this.client.rpc('complete_consultation_rx_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_diagnosis: rxData.diagnosis || 'Clinical evaluation concluded.',
      p_medications: Array.isArray(rxData.medications) ? rxData.medications : [rxData.medications],
      p_advice: rxData.advice || 'Follow dosage as directed.'
    });

    if (error) {
      console.error('RPC Prescription Error:', error);
      throw error;
    }

    return data;
  }

  async cloudVerifyDoctor(doctorId, approved, reason = 'Medical board credentials review concluded.') {
    if (!this.client) throw new Error('Cloud offline');

    // Call protected Admin RPC with role validation and immutable audit logging
    const { data, error } = await this.client.rpc('verify_doctor_admin_atomic', {
      p_doctor_id: doctorId,
      p_approved: approved,
      p_reason: reason
    });

    if (error) {
      console.error('RPC Doctor Verification Error:', error);
      throw error;
    }

    return data;
  }

  async cloudMarkAppointmentStatus(doctorId, tokenNumber, status, reason = 'Doctor clinic queue update.') {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('mark_appointment_status_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_status: status,
      p_reason: reason
    });

    if (error) {
      console.error('RPC Mark Status Error:', error);
      throw error;
    }

    return data;
  }

  async cloudFlagPriorityAppointment(doctorId, tokenNumber, reason = 'Emergency clinical triage priority requested.') {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('flag_priority_appointment_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_reason: reason
    });

    if (error) {
      console.error('RPC Priority Override Error:', error);
      throw error;
    }

    return data;
  }

  async cloudGetAuditLogs(limit = 50) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('get_system_audit_logs', {
      p_limit: limit
    });

    if (error) {
      console.error('RPC Audit Logs Error:', error);
      throw error;
    }

    return data;
  }
}

// Instantiate Singleton
window.mediarcaSupabase = new MediarcaSupabaseClient();
