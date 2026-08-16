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

        // C-17: Query doctor profile independently with maybeSingle() (returns null cleanly for normal patients)
        try {
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

        // Authoritative role resolution from DB (never client user_metadata)
        const role = profile?.role || (doctorProfile ? 'doctor' : 'patient');
        const name = profile?.full_name || doctorProfile?.name || user.email.split('@')[0];

        window.mediarcaStore.setAuthSession({
          id: user.id,
          email: user.email,
          role: role,
          name: name,
          doctorProfile: doctorProfile || null,
          patientProfile: profile || null,
          clinicalProfile: clinicalProfile || null
        });
      }
    });
  }

  async authSignUp(email, password, metadata = {}) {
    if (!this.client) throw new Error('Supabase client unavailable');

    // C-03 Resolution: Never allow client-requested admin privilege escalation on signup
    const assignedRole = metadata.role === 'doctor' ? 'doctor' : (metadata.role === 'receptionist' ? 'receptionist' : 'patient');
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

    if (error) throw error;

    if (data.user) {
      // 1. C-16 Resolution: Upsert core identity strictly into users table (valid schema columns only)
      await this.client.from('users').upsert({
        id: data.user.id,
        email: cleanEmail,
        role: assignedRole,
        full_name: (metadata.name || cleanEmail.split('@')[0]).trim(),
        phone: metadata.phone || null
      });

      // 2. C-16 Resolution: Upsert clinical demographics separately into patient_clinical_profiles
      if (assignedRole === 'patient' && (metadata.age || metadata.gender || metadata.bloodGroup)) {
        await this.client.from('patient_clinical_profiles').upsert({
          user_id: data.user.id,
          age: parseInt(metadata.age) || null,
          gender: metadata.gender || null,
          blood_group: metadata.bloodGroup || null
        });
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

  async cloudIssueReceptionWalkinToken(walkinObj) {
    if (!this.client) throw new Error('Cloud offline');

    // H-18 & H-19: Dedicated receptionist walk-in token issuance RPC with accurate demographics
    const { data, error } = await this.client.rpc('issue_reception_walkin_token', {
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

    if (error) {
      console.error('RPC Reception Walk-in Error:', error);
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

  async cloudCheckInPatientQr(checkinToken) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('check_in_patient_qr_atomic', {
      p_checkin_token: checkinToken
    });

    if (error) {
      console.error('RPC QR Check-in Error:', error);
      throw error;
    }

    return data;
  }

  async cloudTransferPatientQueue(appointmentId, targetDoctorId, reason = 'Reception queue transfer') {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('transfer_patient_queue_atomic', {
      p_appointment_id: appointmentId,
      p_target_doctor_id: targetDoctorId,
      p_reason: reason
    });

    if (error) {
      console.error('RPC Queue Transfer Error:', error);
      throw error;
    }

    return data;
  }

  async cloudRescheduleAppointment(appointmentId, newDate, newSlot) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('reschedule_appointment_atomic', {
      p_appointment_id: appointmentId,
      p_new_date: newDate,
      p_new_slot: newSlot
    });

    if (error) {
      console.error('RPC Reschedule Error:', error);
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
    const { data: docRecord, error: dbError } = await this.client
      .from('clinical_documents')
      .insert({
        patient_id: user.id,
        doctor_id: metadata.doctorId || null,
        document_name: metadata.title || cleanFileName,
        document_type: metadata.category || 'lab_report',
        document_url: storagePath,
        storage_path: storagePath,
        file_name: cleanFileName,
        file_size_bytes: file.size || 0,
        mime_type: file.type || 'application/pdf',
        is_encrypted: false, // Transparent storage-level encryption at rest, not app-layer PKI
        notes: metadata.notes || 'Secured in private authenticated storage vault with server-side encryption at rest'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Document metadata insert error:', dbError);
      throw dbError;
    }

    return {
      ...docRecord,
      signedUrl: signedUrl || storagePath
    };
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
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('update_patient_stage_atomic', {
      p_appointment_id: appointmentId,
      p_stage: stage,
      p_notes: notes
    });

    if (error) {
      console.error('RPC Stage Route Error:', error);
      throw error;
    }

    return data;
  }

  async cloudRecordPatientConsent(consentType, version = 'v2026.1', termsAccepted = true, metadata = {}) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('record_patient_consent_atomic', {
      p_consent_type: consentType,
      p_version: version,
      p_terms_accepted: termsAccepted,
      p_metadata: metadata
    });

    if (error) {
      console.error('RPC Record Consent Error:', error);
      throw error;
    }

    return data;
  }

  async cloudGenerateAndSettleInvoice(appointmentId, paymentMethod = 'Card', insuranceProvider = null, insuranceCoverage = 0) {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('generate_and_settle_invoice_atomic', {
      p_appointment_id: appointmentId,
      p_payment_method: paymentMethod,
      p_insurance_provider: insuranceProvider,
      p_insurance_coverage: parseFloat(insuranceCoverage) || 0
    });

    if (error) {
      console.error('RPC Invoice Error:', error);
      throw error;
    }

    return data;
  }

  async cloudCreateTelemedicineRoom(appointmentId, roomName = 'MediArca Virtual Suite') {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('create_telemedicine_room_atomic', {
      p_appointment_id: appointmentId,
      p_room_name: roomName
    });

    if (error) {
      console.error('RPC Telemedicine Room Error:', error);
      throw error;
    }

    return data;
  }

  async cloudGetHospitalAnalytics() {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('get_hospital_operational_analytics');

    if (error) {
      console.error('RPC Analytics Error:', error);
      throw error;
    }

    return data;
  }

  async cloudScheduleFutureAppointment(doctorId, scheduledDate, scheduledSlot, symptoms = 'General Consultation') {
    if (!this.client) throw new Error('Cloud offline');

    const { data, error } = await this.client.rpc('schedule_future_appointment_atomic', {
      p_doctor_id: doctorId,
      p_scheduled_date: scheduledDate,
      p_scheduled_slot: scheduledSlot,
      p_symptoms: symptoms
    });

    if (error) {
      console.error('RPC Schedule Future Appointment Error:', error);
      throw error;
    }

    return data;
  }
}

// Instantiate Singleton
window.mediarcaSupabase = new MediarcaSupabaseClient();
