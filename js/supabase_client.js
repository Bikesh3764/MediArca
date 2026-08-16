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

  // --- 2. PRIVACY-SAFE REALTIME SUBSCRIPTIONS (C-12 Resolution) ---
  setupRealtimeSubscriptions() {
    if (!this.client) return;

    try {
      // Listen for Realtime Queue updates across doctor clinics (Telemetry only)
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

      // Listen for Verified Doctor profile updates
      this.client
        .channel('public:doctors')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, payload => {
          if (payload.new && payload.new.id) {
            const index = window.mediarcaStore.state.doctors.findIndex(d => d.id === payload.new.id);
            if (index >= 0) {
              window.mediarcaStore.state.doctors[index] = {
                ...window.mediarcaStore.state.doctors[index],
                verificationStatus: payload.new.verification_status,
                mediarcaId: payload.new.mediarca_id,
                currentToken: payload.new.current_token
              };
              window.mediarcaStore.notifySubscribers();
            }
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
      // 1. Fetch Verified Doctors Directory
      const { data: docs, error: docErr } = await this.client
        .from('doctors')
        .select('*')
        .order('rating', { ascending: false });

      if (!docErr && docs && docs.length > 0) {
        const cloudDocs = docs.map(d => ({
          id: d.id,
          name: d.name,
          email: d.email,
          specialty: d.specialty,
          specialtyId: d.specialty_id || 'general',
          title: d.title,
          degrees: d.degrees,
          regNumber: d.reg_number,
          mediarcaId: d.mediarca_id,
          verificationStatus: d.verification_status,
          experienceYears: d.experience_years,
          hospital: d.hospital,
          fee: parseFloat(d.fee) || 50,
          rating: parseFloat(d.rating) || 5.0,
          reviewsCount: d.reviews_count || 0,
          avatar: d.avatar,
          bio: d.bio,
          schedule: d.schedule,
          currentToken: d.current_token || 0,
          totalTokens: d.total_tokens || 0,
          avgConsultTimeMins: d.avg_consult_time_mins || 12
        }));

        window.mediarcaStore.state.doctors = cloudDocs;
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

  async cloudSavePrescription(appointmentId, rxData) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client
      .from('appointments')
      .update({
        diagnosis: rxData.diagnosis,
        medications: Array.isArray(rxData.medications) ? rxData.medications : [rxData.medications],
        advice: rxData.advice,
        status: 'completed'
      })
      .eq('id', appointmentId)
      .select();

    if (error) throw error;
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
}

// Instantiate Singleton
window.mediarcaSupabase = new MediarcaSupabaseClient();
