/**
 * Mediarca Supabase Cloud Database & Supabase Auth Client
 * Authoritative Supabase Auth JWT, Real-time PostgreSQL sync for queues, doctors, bookings, and audit logs
 */

const SUPABASE_CONFIG = {
  url: 'https://pkvwnsigucncdwrjtggs.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrdnduc2lndWNuY2R3cmp0Z2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzg5NzAsImV4cCI6MjEwMjQ1NDk3MH0._VAaiZ0DiNHeMmiS9VoaSdNsluOaz5sOTgM0Qi4Lbok'
};

class MediarcaSupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    this.isConnected = true;
    if (window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        console.log('✅ Mediarca Cloud DB & Supabase Auth Connected:', SUPABASE_CONFIG.url);
        this.setupAuthListener();
        this.setupRealtimeSubscriptions();
      } catch (err) {
        console.warn('⚠️ Supabase connection notice:', err);
      }
    }
    this.syncInitialDataFromCloud();
  }

  // --- 1. SUPABASE AUTH INTEGRATION (C-01, C-02, C-03 & C-17 Resolution) ---
  setupAuthListener() {
    if (!this.client) return;

    this.client.auth.onAuthStateChange(async (event, session) => {
      console.log('⚡ Supabase Auth State Changed:', event, session?.user?.email);
      if (session && session.user) {
        const user = session.user;
        let profile = null;
        let doctorProfile = null;
        let clinicalProfile = null;

        // C-17: Query user identity profile independently with maybeSingle()
        try {
          const { data } = await this.client
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          profile = data;
        } catch (e) {
          console.warn('User profile fetch notice:', e);
        }

        // Auto-provision user record if signed in via Google OAuth for first time
        if (!profile && user.id) {
          const googleName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]).trim();
          try {
            const { data: newProfile } = await this.client
              .from('users')
              .upsert({
                id: user.id,
                email: user.email.toLowerCase().trim(),
                full_name: googleName,
                role: 'patient',
                phone: user.phone || user.user_metadata?.phone || null
              }, { onConflict: 'id' })
              .select('*')
              .maybeSingle();
            if (newProfile) profile = newProfile;

            await this.client.from('patient_clinical_profiles').upsert({
              user_id: user.id,
              age: null,
              gender: null,
              blood_group: null
            }, { onConflict: 'user_id' });
          } catch (upsertErr) {
            console.warn('OAuth profile provisioning notice:', upsertErr);
          }
        }

        // Query doctor profile by user_id OR email
        try {
          const userEmail = (user.email || '').toLowerCase().trim();
          const { data } = await this.client
            .from('doctors')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          doctorProfile = data;

        } catch (e) {
          console.warn('Doctor profile fetch notice:', e);
        }

        // C-17: Query patient clinical profile independently
        try {
          const { data } = await this.client
            .from('patient_clinical_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          clinicalProfile = data;
        } catch (e) {
          console.warn('Clinical profile fetch notice:', e);
        }

        // Authoritative role resolution from DB (doctor profile takes precedence if registered doctor)
        const role = doctorProfile ? 'doctor' : (profile?.role || 'patient');
        const name = doctorProfile?.name || profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];

        window.mediarcaStore.setAuthSession({
          id: user.id,
          email: user.email,
          role: role,
          name: name,
          doctorProfile: doctorProfile || null,
          patientProfile: profile || null,
          clinicalProfile: clinicalProfile || null
        });

        // P0-07 Resolution: Trigger immediate authoritative data sync after successful login
        try {
          await this.syncInitialDataFromCloud();
        } catch (syncErr) {
          console.warn('Post-login cloud sync notice:', syncErr);
        }

        // Auto navigate to role-specific portal on fresh login
        if (window.mediarcaApp) {
          if (role === 'doctor') {
            window.mediarcaApp.switchView('doctor-portal');
          } else if (role === 'admin') {
            window.mediarcaApp.switchView('admin-portal');
          } else if (role === 'receptionist') {
            window.mediarcaApp.switchView('reception-portal');
          } else if (role === 'patient' && window.mediarcaApp.currentView.startsWith('auth-')) {
            window.mediarcaApp.switchView('patient-portal');
          }
        }
      }
    });
  }

  async authSignUp(email, password, metadata = {}) {
    if (!this.client) throw new Error('Supabase client unavailable');

    // Audit v8 Resolution: Public signup strictly creates 'patient' (or 'doctor' with pending accreditation). Block any self-assignment of 'receptionist' or 'admin'!
    const assignedRole = metadata.role === 'doctor' ? 'doctor' : 'patient';
    const cleanEmail = email.toLowerCase().trim();

    const { data, error } = await this.client.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          name: (metadata.name || '').trim(),
          role: assignedRole
        }
      }
    });

    if (error) {
      if (error.message && error.message.toLowerCase().includes('rate limit')) {
        throw new Error('Supabase free email limit reached. In Supabase Dashboard -> Auth -> Providers -> Email -> turn OFF "Confirm email" for instant unlimited signups.');
      }
      throw error;
    }

    if (data.user) {
      // 1. C-16 & P-02 Resolution: Upsert core identity strictly into users table
      const { error: userErr } = await this.client.from('users').upsert({
        id: data.user.id,
        email: cleanEmail,
        role: assignedRole,
        full_name: (metadata.name || cleanEmail.split('@')[0]).trim(),
        phone: metadata.phone || null
      });
      if (userErr) {
        console.error('User profile sync error:', userErr);
        throw new Error('Registration failed: Could not persist user profile to database (' + userErr.message + ')');
      }

      // 2. Upsert clinical demographics separately into patient_clinical_profiles
      if (assignedRole === 'patient') {
        const { error: profErr } = await this.client.from('patient_clinical_profiles').upsert({
          user_id: data.user.id,
          age: metadata.age ? parseInt(metadata.age) : null,
          gender: metadata.gender || null,
          blood_group: metadata.bloodGroup || null
        });
        if (profErr) {
          console.error('Clinical profile sync error:', profErr);
          throw new Error('Registration failed: Could not record clinical demographics (' + profErr.message + ')');
        }
      }
    }

    return data;
  }

  async authSignIn(email, password) {
    if (!this.client) throw new Error('Supabase client unavailable');

    // H-15 Resolution: Never trim passwords; normalize email only
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) throw error;
    return data;
  }

  async signInWithGoogle() {
    if (!this.client) throw new Error('Supabase client unavailable');
    // Ensure full path (including /MediArca/ on GitHub Pages) is passed
    const redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
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

  async cloudUpdatePatientProfile(userId, profileData) {
    if (!this.client || !userId) throw new Error('Supabase client unavailable');

    const name = profileData.name || null;
    const phone = profileData.phone || null;
    const age = profileData.age ? parseInt(profileData.age, 10) : null;
    const gender = profileData.gender || null;
    const bloodGroup = profileData.bloodGroup || null;

    const { data, error } = await this.client.rpc('update_patient_profile_atomic', {
      p_name: name,
      p_phone: phone,
      p_age: age,
      p_gender: gender,
      p_blood_group: bloodGroup
    });

    if (error) throw error;
    return data;
  }

  async cloudUpdateDoctorProfile(doctorId, doctorData) {
    if (!this.client || !doctorId) throw new Error('Supabase client unavailable');

    const updatePayload = {};
    if (doctorData.fee !== undefined) updatePayload.fee = parseFloat(doctorData.fee);
    if (doctorData.hospital !== undefined) updatePayload.hospital = doctorData.hospital;
    if (doctorData.schedule !== undefined) updatePayload.schedule = doctorData.schedule;
    if (doctorData.bio !== undefined) updatePayload.bio = doctorData.bio;

    const { data, error } = await this.client
      .from('doctors')
      .update(updatePayload)
      .eq('id', doctorId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Doctor profile update was not persisted.');
    return data;
  }

  // --- 2. PRIVACY-SAFE REALTIME TELEMETRY SUBSCRIPTIONS (P-03 Resolution) ---
  setupRealtimeSubscriptions() {
    if (!this.client) return;

    try {
      // PQ-02 Resolution: Exclusively listen for today's live queue changes
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      this.client
        .channel('public:clinic_queues_today')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'clinic_queues',
          filter: `queue_date=eq.${todayStr}`
        }, payload => {
          if (payload.new && payload.new.doctor_id) {
            const queue = window.mediarcaStore.state.queues[payload.new.doctor_id];
            if (queue) {
              queue.currentToken = payload.new.current_token;
              queue.totalTokens = payload.new.total_tokens || queue.totalTokens;
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

    const { data: authUserData } = await this.client.auth.getUser();
    const user = authUserData?.user || null;

    try {
      // 1. Fetch Verified Doctors from sanitized Public Directory View (P-02 Resolution)
      const { data: docs, error: docErr } = await this.client
        .from('public_doctor_directory')
        .select('*')
        .order('rating', { ascending: false });

      if (!docErr && docs) {
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
        .eq('queue_date', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));

      if (!qErr && queues) {
        window.mediarcaStore.state.queues = {};
        queues.forEach(q => {
          if (!window.mediarcaStore.state.queues[q.doctor_id]) {
            window.mediarcaStore.state.queues[q.doctor_id] = {
              doctorId: q.doctor_id,
              currentToken: q.current_token,
              status: q.status,
              avgConsultTimeMins: q.avg_consult_time_mins || 12,
              tokens: []
            };
          } else {
            window.mediarcaStore.state.queues[q.doctor_id].currentToken = q.current_token;
            window.mediarcaStore.state.queues[q.doctor_id].status = q.status;
            window.mediarcaStore.state.queues[q.doctor_id].avgConsultTimeMins = q.avg_consult_time_mins || 12;
          }
        });
      }

      // 3. Hydrate Authoritative Appointments & Queue Tokens (H-01 & Q-04 Resolution)
      try {
        const { data: appts, error: apptErr } = await this.client
          .from('appointments')
          .select('*, users!appointments_patient_id_fkey(full_name, phone)')
          .order('created_at', { ascending: false });

        if (!apptErr && appts) {
          const mappedBookings = appts.map(a => ({
            id: a.id,
            bookingId: a.booking_id || `MED-BK-${a.id.substring(0, 8).toUpperCase()}`,
            patientId: a.patient_id,
            doctorId: a.doctor_id,
            patientName: a.patient_name || a.users?.full_name || 'Registered Patient',
            patientAge: a.patient_age || null,
            patientGender: a.patient_gender || 'Not specified',
            patientPhone: a.patient_phone || a.users?.phone || 'Not specified',
            symptoms: a.symptoms,
            tokenNumber: a.token_number || 0,
            status: a.status,
            currentStage: a.current_stage || 'triage',
            scheduledDate: a.scheduled_date,
            scheduledSlot: a.scheduled_slot,
            checkinToken: a.checkin_token,
            isPriority: !!a.is_priority,
            priorityReason: a.priority_reason || null,
            createdAt: a.created_at,
            startAt: a.start_at,
            endAt: a.end_at
          }));

          // Supabase is authoritative for clinical appointments.
          window.mediarcaStore.state.bookings = mappedBookings;

          // Distribute active tokens into respective doctor queues
          mappedBookings.forEach(b => {
            if (!window.mediarcaStore.state.queues[b.doctorId]) {
              window.mediarcaStore.state.queues[b.doctorId] = {
                doctorId: b.doctorId,
                currentToken: 0,
                status: 'in-session',
                avgConsultTimeMins: 12,
                tokens: []
              };
            }
            const queue = window.mediarcaStore.state.queues[b.doctorId];
            if (!queue.tokens) queue.tokens = [];
            const tokenExists = queue.tokens.some(t => t.bookingId === b.id || (b.tokenNumber > 0 && t.tokenNumber === b.tokenNumber));
            if (!tokenExists) {
              queue.tokens.push({
                tokenNumber: b.tokenNumber,
                patientName: b.patientName,
                patientAge: b.patientAge,
                patientGender: b.patientGender,
                patientPhone: b.patientPhone,
                status: b.status,
                currentStage: b.currentStage,
                scheduledDate: b.scheduledDate,
                scheduledSlot: b.scheduledSlot,
                checkInTime: b.scheduledSlot || (b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM'),
                symptoms: b.symptoms,
                isPriority: b.isPriority,
                priorityReason: b.priorityReason,
                bookingId: b.id
              });
            }
          });
        }
      } catch (apptSyncErr) {
        console.warn('Appointments hydration notice:', apptSyncErr);
      }

        // 4. Authenticated Doctor & Admin Full Hydration (Item 5 & P1-13 Resolution)
        const { data: userProfile } = user
          ? await this.client.from('users').select('role').eq('id', user.id).maybeSingle()
          : { data: null };
        
        if (user && (userProfile?.role === 'doctor' || window.mediarcaStore.state.currentUser?.role === 'doctor')) {
          const { data: myDoc } = await this.client.from('doctors').select('*').eq('user_id', user.id).maybeSingle();
          if (myDoc) {
            const existingIdx = window.mediarcaStore.state.doctors.findIndex(x => x.id === myDoc.id || x.userId === user.id);
            const docObj = {
              id: myDoc.id,
              userId: myDoc.user_id,
              name: myDoc.name,
              email: myDoc.email,
              specialty: myDoc.specialty,
              specialtyId: myDoc.specialty_id || (myDoc.specialty || 'general').toLowerCase().replace(/\s+/g, ''),
              title: myDoc.title || 'Consultant ' + (myDoc.specialty || 'Physician'),
              degrees: myDoc.degrees,
              regNumber: myDoc.reg_number,
              verificationStatus: myDoc.verification_status,
              experienceYears: myDoc.experience_years,
              hospital: myDoc.hospital || 'General Hospital',
              fee: parseFloat(myDoc.fee) || 50,
              rating: parseFloat(myDoc.rating) || 5.0,
              reviewsCount: myDoc.reviews_count || 0,
              avatar: myDoc.avatar,
              bio: myDoc.bio,
              schedule: myDoc.schedule || 'Mon - Fri | 09:00 AM - 02:00 PM',
              mediarcaId: myDoc.mediarca_id,
              currentToken: myDoc.current_token || 0,
              totalTokens: myDoc.total_tokens || 0,
              avgConsultTimeMins: myDoc.avg_consult_time_mins || 12
            };
            if (existingIdx >= 0) {
              window.mediarcaStore.state.doctors[existingIdx] = { ...window.mediarcaStore.state.doctors[existingIdx], ...docObj };
            } else {
              window.mediarcaStore.state.doctors.push(docObj);
            }
          }
        }

        if (user && (userProfile?.role === 'admin' || window.mediarcaStore.state.currentUser?.role === 'admin')) {
          const { data: allDocs } = await this.client.from('doctors').select('*').order('created_at', { ascending: false });
          if (allDocs && allDocs.length > 0) {
            allDocs.forEach(d => {
              const existingIdx = window.mediarcaStore.state.doctors.findIndex(x => x.id === d.id || (d.user_id && x.userId === d.user_id));
              const docObj = {
                id: d.id,
                userId: d.user_id,
                name: d.name,
                email: d.email,
                specialty: d.specialty,
                specialtyId: (d.specialty || 'general').toLowerCase().replace(/\s+/g, ''),
                title: 'Consultant ' + (d.specialty || 'Physician'),
                degrees: d.degrees,
                regNumber: d.reg_number,
                verificationStatus: d.verification_status,
                experienceYears: d.experience_years,
                hospital: d.hospital || 'General Hospital',
                fee: parseFloat(d.fee) || 50,
                rating: parseFloat(d.rating) || 5.0,
                reviewsCount: d.reviews_count || 0,
                avatar: d.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=faces&q=80',
                bio: d.bio,
                schedule: d.schedule || 'Mon - Sat | 09:00 AM - 03:00 PM',
                mediarcaId: d.mediarca_id,
                currentToken: d.current_token || 0,
                totalTokens: d.total_tokens || 0,
                avgConsultTimeMins: d.avg_consult_time_mins || 12
              };
              if (existingIdx >= 0) {
                window.mediarcaStore.state.doctors[existingIdx] = { ...window.mediarcaStore.state.doctors[existingIdx], ...docObj };
              } else {
                window.mediarcaStore.state.doctors.push(docObj);
              }
            });
          }

          // BUG-018: Hydrate users along with clinical demographics from patient_clinical_profiles
          const { data: allUsers } = await this.client.from('users').select('*').order('created_at', { ascending: false });
          const { data: allClinProfiles } = await this.client.from('patient_clinical_profiles').select('*');
          const profMap = new Map((allClinProfiles || []).map(p => [p.user_id, p]));

          if (allUsers && allUsers.length > 0) {
            window.mediarcaStore.state.users = allUsers.map(u => {
              const cp = profMap.get(u.id);
              return {
                id: u.id,
                role: u.role,
                email: u.email,
                name: u.full_name,
                phone: u.phone,
                age: cp ? cp.age : null,
                gender: cp ? cp.gender : null,
                bloodGroup: cp ? cp.blood_group : null
              };
            });
          }
        }

      window.mediarcaStore.notifySubscribers();
    } catch (err) {
      console.warn('Initial cloud hydration notice:', err);
    }
  }

  // --- 4. ATOMIC AUTHORIZED STORED PROCEDURES (C-04 & C-05) ---
  async safeRpc(rpcName, params, timeoutMs = 15000) {
    let authToken = SUPABASE_CONFIG.key;
    try {
      if (this.client) {
        const { data } = await Promise.race([
          this.client.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('session timeout')), 1000))
        ]);
        if (data?.session?.access_token) {
          authToken = data.session.access_token;
        }
      }
    } catch (_) {}

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/${rpcName}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Server request failed (${response.status})`;
        try {
          const errJson = await response.json();
          errorMsg = errJson.message || errJson.error_description || errJson.hint || errJson.details || errorMsg;
        } catch (_) {}
        console.error(`RPC [${rpcName}] Error Response:`, errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Database request timed out (${rpcName}). Please check your connection.`);
      }
      throw err;
    }
  }

  async cloudBookAppointment(bookingObj) {
    const doctorId = typeof bookingObj === 'object' ? bookingObj.doctorId : arguments[0];
    const symptoms = typeof bookingObj === 'object' ? (bookingObj.symptoms || 'General Consultation') : (arguments[1] || 'General Consultation');
    const patientName = typeof bookingObj === 'object' ? bookingObj.patientName : null;
    const patientPhone = typeof bookingObj === 'object' ? bookingObj.patientPhone : null;
    const patientAge = typeof bookingObj === 'object' ? bookingObj.patientAge : null;
    const patientGender = typeof bookingObj === 'object' ? bookingObj.patientGender : null;
    const timezone = typeof bookingObj === 'object' ? (bookingObj.timezone || 'Asia/Kolkata') : 'Asia/Kolkata';

    return this.safeRpc('issue_next_opd_token', {
      p_doctor_id: doctorId,
      p_symptoms: symptoms,
      p_patient_name: patientName || null,
      p_patient_phone: patientPhone || null,
      p_patient_age: patientAge ? parseInt(patientAge) : null,
      p_patient_gender: patientGender || null,
      p_timezone: timezone
    });
  }

  async cloudIssueReceptionWalkinToken(walkinObj) {
    return this.safeRpc('issue_reception_walkin_token', {
      p_doctor_id: walkinObj.doctorId,
      p_patient_name: walkinObj.patientName,
      p_patient_phone: walkinObj.patientPhone || 'Not specified',
      p_patient_age: walkinObj.patientAge ? parseInt(walkinObj.patientAge) : null,
      p_patient_gender: walkinObj.patientGender || null,
      p_symptoms: walkinObj.symptoms || 'General Walk-in Consultation',
      p_is_priority: !!walkinObj.isPriority,
      p_priority_reason: walkinObj.priorityReason || null,
      p_timezone: walkinObj.timezone || 'Asia/Kolkata'
    });
  }

  async cloudAdvanceQueue(doctorId) {
    return this.safeRpc('advance_doctor_queue_atomic', {
      p_doctor_id: doctorId
    });
  }

  async cloudPauseDoctorQueue(doctorId, isPaused, reason = 'Clinic pause state toggled by physician') {
    return this.safeRpc('pause_doctor_queue_atomic', {
      p_doctor_id: doctorId,
      p_is_paused: isPaused,
      p_reason: reason
    });
  }

  async cloudSavePrescription(doctorId, tokenNumber, rxData) {
    return this.safeRpc('complete_consultation_rx_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_diagnosis: rxData.diagnosis || 'Clinical evaluation concluded.',
      p_medications: Array.isArray(rxData.medications) ? rxData.medications : (rxData.medications ? [rxData.medications] : []),
      p_advice: rxData.advice || 'Follow dosage as directed.',
      p_vitals: rxData.vitals || null,
      p_chief_complaint: rxData.symptoms || rxData.chiefComplaint || rxData.chief_complaint || null,
      p_examination_findings: rxData.examinationFindings || rxData.examination_findings || null,
      p_assessment: rxData.assessment || null,
      p_treatment_plan: rxData.treatmentPlan || rxData.treatment_plan || null,
      p_lab_orders: rxData.labOrders || rxData.lab_orders || null,
      p_follow_up_date: rxData.followUpDate || rxData.follow_up_date || null
    });
  }

  async cloudVerifyDoctor(doctorId, approved, reason = 'Medical board credentials review concluded.') {
    return this.safeRpc('verify_doctor_admin_atomic', {
      p_doctor_id: doctorId,
      p_approved: approved,
      p_reason: reason
    });
  }

  async cloudMarkAppointmentStatus(doctorId, tokenNumber, status, reason = 'Doctor clinic queue update.') {
    return this.safeRpc('mark_appointment_status_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_status: status,
      p_reason: reason
    });
  }

  async cloudFlagPriorityAppointment(doctorId, tokenNumber, reason = 'Emergency clinical triage priority requested.') {
    return this.safeRpc('flag_priority_appointment_atomic', {
      p_doctor_id: doctorId,
      p_token_number: parseInt(tokenNumber),
      p_reason: reason
    });
  }

  async cloudCheckInPatientQr(checkinToken) {
    return this.safeRpc('check_in_patient_qr_atomic', {
      p_checkin_token: checkinToken
    });
  }

  async cloudTransferPatientQueue(appointmentId, targetDoctorId, reason = 'Reception queue transfer') {
    return this.safeRpc('transfer_patient_queue_atomic', {
      p_appointment_id: appointmentId,
      p_target_doctor_id: targetDoctorId,
      p_reason: reason
    });
  }

  async cloudRescheduleAppointment(appointmentId, newDate, newSlot) {
    return this.safeRpc('reschedule_appointment_atomic', {
      p_appointment_id: appointmentId,
      p_new_date: newDate,
      p_new_slot: newSlot
    });
  }

  async cloudGetAuditLogs(limit = 50) {
    return this.safeRpc('get_system_audit_logs', {
      p_limit: limit
    });
  }

  async cloudGetAdminAuditLogs(limit = 50) {
    return this.cloudGetAuditLogs(limit);
  }

  // H-21, H-22, H-23: Real Clinical Document Storage Upload & Signed URL Generation
  async uploadClinicalDocument(file, metadata) {
    if (!this.client) throw new Error('Supabase client offline');

    const user = (await this.client.auth.getUser())?.data?.user;
    if (!user) throw new Error('Authentication required to upload medical documents.');

    // H-13 & H-14: Strict MIME Type allowlist and File Size verification
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const mimeType = (file.type || 'application/pdf').toLowerCase();
    if (!allowedMimes.includes(mimeType)) {
      throw new Error(`Invalid file format '${mimeType}'. Only PDF and image records (JPEG, PNG, WebP) are permitted.`);
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds maximum permitted 10MB limit.');
    }

    const fileExt = file.name ? file.name.split('.').pop().toLowerCase() : 'pdf';
    const sanitizedBase = (file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    const docUuid = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const storagePath = `${user.id}/${docUuid}_${sanitizedBase}`;

    // 1. Upload raw bytes to private Supabase Storage bucket
    const { error: uploadError } = await this.client.storage
      .from('clinical_documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType
      });

    if (uploadError) {
      console.error('Storage bucket upload error:', uploadError);
      throw new Error(`Vault storage upload failed: ${uploadError.message}`);
    }

    // 2. Generate time-limited signed URL (valid for 1 hour)
    const { data: signedData, error: signError } = await this.client.storage
      .from('clinical_documents')
      .createSignedUrl(storagePath, 3600);

    if (signError) {
      console.error('Signed URL generation error:', signError);
    }

    const signedUrl = signedData?.signedUrl || null;

    // 3. Insert metadata record into clinical_documents table (C-11: store durable storage_path)
    try {
      const { data: docRecord, error: dbError } = await this.client
        .from('clinical_documents')
        .insert({
          patient_id: user.id,
          doctor_id: metadata.doctorId || null,
          document_name: metadata.title || sanitizedBase,
          document_type: metadata.category || 'lab_report',
          document_url: storagePath,
          storage_path: storagePath,
          file_name: sanitizedBase,
          file_size_bytes: file.size || 0,
          mime_type: file.type || 'application/pdf',
          is_encrypted: false, // Transparent storage-level encryption at rest, not app-layer PKI
          notes: metadata.notes || 'Secured in private authenticated storage vault with server-side encryption at rest'
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      return {
        ...docRecord,
        signedUrl: signedUrl || storagePath
      };
    } catch (insertOrRuntimeErr) {
      console.error('Document metadata insert/runtime error, rolling back storage object:', insertOrRuntimeErr);
      // P0-01 Resolution: Clean up orphaned storage object on ANY database or runtime exception
      try {
        await this.client.storage.from('clinical_documents').remove([storagePath]);
      } catch (cleanupErr) {
        console.warn('Storage cleanup warning:', cleanupErr);
      }
      throw insertOrRuntimeErr;
    }
  }

  async getClinicalDocumentSignedUrl(storagePath) {
    if (!this.client) throw new Error('Supabase client offline');

    const { data, error } = await this.client.storage
      .from('clinical_documents')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }

    return data?.signedUrl;
  }

  async cloudUpdatePatientStage(appointmentId, stage, notes = 'Clinical stage routing transition') {
    return this.safeRpc('update_patient_stage_atomic', {
      p_appointment_id: appointmentId,
      p_stage: stage,
      p_notes: notes
    });
  }

  async cloudRecordPatientConsent(consentType, version = 'v2026.1', termsAccepted = true, metadata = {}) {
    return this.safeRpc('record_patient_consent_atomic', {
      p_consent_type: consentType,
      p_version: version,
      p_terms_accepted: termsAccepted,
      p_metadata: metadata
    });
  }

  async cloudGenerateAndSettleInvoice(appointmentId, paymentMethod = 'Card', insuranceProvider = null, insuranceCoverage = 0, couponCode = null) {
    return this.safeRpc('generate_and_settle_invoice_atomic', {
      p_appointment_id: appointmentId,
      p_payment_method: paymentMethod,
      p_insurance_provider: insuranceProvider,
      p_insurance_coverage: parseFloat(insuranceCoverage) || 0,
      p_coupon_code: couponCode || null
    });
  }

  async cloudCreateTelemedicineRoom(appointmentId, roomName = 'MediArca Virtual Suite') {
    return this.safeRpc('create_telemedicine_room_atomic', {
      p_appointment_id: appointmentId,
      p_room_name: roomName
    });
  }

  async cloudGetHospitalAnalytics() {
    return this.safeRpc('get_hospital_operational_analytics', {});
  }

  async cloudScheduleFutureAppointment(bookingObj) {

    const doctorId = typeof bookingObj === 'object' ? bookingObj.doctorId : arguments[0];
    const scheduledDate = typeof bookingObj === 'object' ? bookingObj.scheduledDate : arguments[1];
    const scheduledSlot = typeof bookingObj === 'object' ? bookingObj.scheduledSlot : arguments[2];
    const symptoms = typeof bookingObj === 'object' ? (bookingObj.symptoms || 'General Consultation') : (arguments[3] || 'General Consultation');
    const patientName = typeof bookingObj === 'object' ? bookingObj.patientName : null;
    const patientPhone = typeof bookingObj === 'object' ? bookingObj.patientPhone : null;
    const patientAge = typeof bookingObj === 'object' ? bookingObj.patientAge : null;
    const patientGender = typeof bookingObj === 'object' ? bookingObj.patientGender : null;
    const timezone = typeof bookingObj === 'object' ? (bookingObj.timezone || 'Asia/Kolkata') : 'Asia/Kolkata';

    return this.safeRpc('schedule_future_appointment_atomic', {
      p_doctor_id: doctorId,
      p_scheduled_date: scheduledDate,
      p_scheduled_slot: scheduledSlot,
      p_symptoms: symptoms,
      p_patient_name: patientName || null,
      p_patient_phone: patientPhone || null,
      p_patient_age: patientAge ? parseInt(patientAge) : null,
      p_patient_gender: patientGender || null,
      p_timezone: timezone
    });
  }

  async cloudUpdateDoctorProfile(doctorId, docData) {
    if (!this.client) throw new Error('Cloud offline');

    const updatePayload = {};
    if (docData.name !== undefined) updatePayload.name = docData.name;
    if (docData.specialty !== undefined) {
      updatePayload.specialty = docData.specialty;
      updatePayload.specialty_id = docData.specialty.toLowerCase().replace(/\s+/g, '');
    }
    if (docData.title !== undefined) updatePayload.title = docData.title;
    if (docData.degrees !== undefined) updatePayload.degrees = docData.degrees;
    if (docData.experienceYears !== undefined) updatePayload.experience_years = parseInt(docData.experienceYears);
    if (docData.fee !== undefined) updatePayload.fee = parseFloat(docData.fee);
    if (docData.hospital !== undefined) updatePayload.hospital = docData.hospital;
    if (docData.schedule !== undefined) updatePayload.schedule = docData.schedule;
    if (docData.bio !== undefined) updatePayload.bio = docData.bio;
    if (docData.avatar !== undefined) updatePayload.avatar = docData.avatar;
    if (docData.avgConsultTimeMins !== undefined) updatePayload.avg_consult_time_mins = parseInt(docData.avgConsultTimeMins);

    const authRes = await this.client.auth.getUser();
    const authUid = authRes?.data?.user?.id;

    let query = this.client.from('doctors').update(updatePayload);
    if (authUid) {
      query = query.or(`id.eq.${doctorId},user_id.eq.${authUid}`);
    } else {
      query = query.eq('id', doctorId);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      console.error('Doctor profile cloud update error:', error);
      throw error;
    }
    return data;
  }
}

// Instantiate Singleton
window.mediarcaSupabase = new MediarcaSupabaseClient();
