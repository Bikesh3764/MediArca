/**
 * Mediarca Supabase Cloud Database & Realtime WebSocket Client
 * Real-time PostgreSQL sync for queues, doctors, bookings, and audit approvals
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
        console.log('✅ Mediarca Cloud DB Connected to Supabase:', SUPABASE_CONFIG.url);
        this.setupRealtimeSubscriptions();
        this.syncInitialDataFromCloud();
      } catch (err) {
        console.warn('⚠️ Supabase connection notice:', err);
      }
    }
  }

  setupRealtimeSubscriptions() {
    if (!this.client) return;

    try {
      // 1. Listen for Realtime Queue updates across all doctor clinics
      this.client
        .channel('public:clinic_queues')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_queues' }, payload => {
          console.log('⚡ Realtime Queue Update Received from Supabase:', payload);
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

      // 2. Listen for Realtime Appointments & Prescriptions
      this.client
        .channel('public:appointments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, payload => {
          console.log('⚡ Realtime Appointment Update Received from Supabase:', payload);
          if (payload.eventType === 'INSERT' && payload.new) {
            const exists = window.mediarcaStore.state.bookings.find(b => b.bookingId === payload.new.booking_id);
            if (!exists) {
              window.mediarcaStore.state.bookings.unshift({
                bookingId: payload.new.booking_id,
                patientId: payload.new.patient_id,
                patientName: payload.new.patient_name,
                patientPhone: payload.new.patient_phone,
                patientAge: payload.new.patient_age,
                doctorId: payload.new.doctor_id,
                doctorName: 'Dr. Aris Thorne',
                specialty: 'Cardiology',
                hospital: 'Metro Heart Institute',
                date: 'Today',
                tokenNumber: payload.new.token_number,
                status: payload.new.status,
                symptoms: payload.new.symptoms,
                prescription: payload.new.diagnosis ? {
                  diagnosis: payload.new.diagnosis,
                  medications: payload.new.medications,
                  advice: payload.new.advice
                } : null
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const b = window.mediarcaStore.state.bookings.find(x => x.bookingId === payload.new.booking_id);
            if (b) {
              b.status = payload.new.status;
              if (payload.new.diagnosis) {
                b.prescription = {
                  diagnosis: payload.new.diagnosis,
                  medications: payload.new.medications,
                  advice: payload.new.advice
                };
              }
            }
          }
          window.mediarcaStore.notifySubscribers();
        })
        .subscribe();

      // 3. Listen for Doctor verification updates (new registrations & approvals)
      this.client
        .channel('public:doctors')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, payload => {
          console.log('⚡ Realtime Doctor Status Update:', payload);
          if (payload.eventType === 'INSERT' && payload.new) {
            const exists = window.mediarcaStore.state.doctors.find(d => d.id === payload.new.id || d.email.toLowerCase() === payload.new.email.toLowerCase());
            if (!exists) {
              window.mediarcaStore.state.doctors.unshift({
                id: payload.new.id,
                name: payload.new.name,
                email: payload.new.email,
                specialty: payload.new.specialty,
                specialtyId: payload.new.specialty_id,
                title: payload.new.title,
                degrees: payload.new.degrees,
                regNumber: payload.new.reg_number,
                mediarcaId: payload.new.mediarca_id,
                verificationStatus: payload.new.verification_status,
                experienceYears: payload.new.experience_years,
                hospital: payload.new.hospital,
                fee: parseFloat(payload.new.fee || 50),
                rating: parseFloat(payload.new.rating || 5.0),
                reviewsCount: payload.new.reviews_count || 0,
                avatar: payload.new.avatar || 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80',
                bio: payload.new.bio || '',
                schedule: payload.new.schedule || 'Mon - Fri | 09:00 AM - 02:00 PM',
                queueActive: payload.new.queue_active,
                currentToken: payload.new.current_token || 0,
                totalTokens: payload.new.total_tokens || 0,
                avgConsultTimeMins: payload.new.avg_consult_time_mins || 12
              });
            }
          } else if (payload.new && payload.new.id) {
            const doc = window.mediarcaStore.state.doctors.find(d => d.id === payload.new.id || d.email.toLowerCase() === payload.new.email.toLowerCase());
            if (doc) {
              doc.verificationStatus = payload.new.verification_status;
              doc.mediarcaId = payload.new.mediarca_id;
            }
          }
          window.mediarcaStore.saveState();
          window.mediarcaStore.notifySubscribers();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription:', e);
    }
  }

  async syncInitialDataFromCloud() {
    if (!this.client) return;
    try {
      // Sync Doctors
      const { data: cloudDocs, error: docErr } = await this.client.from('doctors').select('*');
      if (!docErr && cloudDocs && cloudDocs.length > 0) {
        console.log(`☁️ Synced ${cloudDocs.length} doctors from Supabase`);
        const mappedCloud = cloudDocs.map(cd => ({
          id: cd.id,
          name: cd.name,
          email: cd.email,
          specialty: cd.specialty,
          specialtyId: cd.specialty_id,
          title: cd.title,
          degrees: cd.degrees,
          regNumber: cd.reg_number,
          mediarcaId: cd.mediarca_id,
          verificationStatus: cd.verification_status,
          experienceYears: cd.experience_years,
          hospital: cd.hospital,
          fee: parseFloat(cd.fee || 50),
          rating: parseFloat(cd.rating || 5.0),
          reviewsCount: cd.reviews_count || 0,
          avatar: cd.avatar || 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80',
          bio: cd.bio || '',
          schedule: cd.schedule || 'Mon - Fri | 09:00 AM - 02:00 PM',
          queueActive: cd.queue_active,
          currentToken: cd.current_token || 0,
          totalTokens: cd.total_tokens || 0,
          avgConsultTimeMins: cd.avg_consult_time_mins || 12
        }));

        // Seamlessly merge with local state so newly registered pending doctors are NEVER lost
        const currentLocal = window.mediarcaStore.state.doctors || [];
        const mergedDocs = [...mappedCloud];

        currentLocal.forEach(localDoc => {
          const existsInCloud = mergedDocs.find(cd => cd.email.toLowerCase() === localDoc.email.toLowerCase() || cd.id === localDoc.id);
          if (!existsInCloud) {
            mergedDocs.unshift(localDoc);
            // Also push to Supabase cloud
            this.cloudRegisterDoctor(localDoc);
          }
        });

        window.mediarcaStore.state.doctors = mergedDocs;
      }

      window.mediarcaStore.saveState();
      window.mediarcaStore.notifySubscribers();
    } catch (e) {
      console.warn('Initial cloud sync notice:', e);
    }
  }

  // Cloud Write Methods
  async cloudRegisterDoctor(docObj) {
    if (!this.client) return docObj;
    try {
      // 1. Insert into users
      await this.client
        .from('users')
        .insert({
          role: 'doctor',
          email: docObj.email,
          password_hash: docObj.password || 'doc123',
          full_name: docObj.name,
          phone: '+1 (555) 000-0000',
          age: 40,
          gender: 'Other'
        });

      // 2. Insert into doctors table in Supabase
      const { data: docRes, error: docErr } = await this.client
        .from('doctors')
        .insert({
          name: docObj.name,
          email: docObj.email,
          specialty: docObj.specialty,
          specialty_id: docObj.specialtyId || docObj.specialty.toLowerCase().replace(/\s+/g, ''),
          title: docObj.title || 'Consultant Specialist',
          degrees: docObj.degrees,
          reg_number: docObj.regNumber,
          mediarca_id: null,
          verification_status: 'pending',
          experience_years: parseInt(docObj.experienceYears) || 5,
          hospital: docObj.hospital,
          fee: parseFloat(docObj.fee) || 50.00,
          bio: docObj.bio || ''
        })
        .select()
        .single();

      if (docRes && !docErr) {
        docObj.id = docRes.id;
        console.log('✅ Doctor successfully created in Supabase Cloud:', docRes);
      }
    } catch (e) {
      console.warn('Cloud register doctor notice:', e);
    }
    return docObj;
  }

  async cloudAdvanceQueue(doctorId, nextToken, newStatus = 'in-session') {
    if (!this.client) return;
    try {
      await this.client
        .from('clinic_queues')
        .upsert({
          doctor_id: doctorId,
          current_token: nextToken,
          status: newStatus,
          updated_at: new Date().toISOString()
        }, { onConflict: 'doctor_id, queue_date' });
      
      await this.client
        .from('doctors')
        .update({ current_token: nextToken, queue_active: newStatus === 'in-session' })
        .eq('id', doctorId);
    } catch (e) {
      console.warn('Cloud advance queue error:', e);
    }
  }

  async cloudSavePrescription(bookingId, rxData) {
    if (!this.client) return;
    try {
      await this.client
        .from('appointments')
        .update({
          status: 'completed',
          diagnosis: rxData.diagnosis,
          medications: rxData.medications,
          advice: rxData.advice
        })
        .eq('booking_id', bookingId);
    } catch (e) {
      console.warn('Cloud prescription save error:', e);
    }
  }

  async cloudBookAppointment(bookingObj) {
    if (!this.client) return;
    try {
      await this.client
        .from('appointments')
        .insert({
          booking_id: bookingObj.bookingId,
          doctor_id: bookingObj.doctorId,
          patient_name: bookingObj.patientName,
          patient_phone: bookingObj.patientPhone,
          patient_age: bookingObj.patientAge,
          patient_gender: bookingObj.patientGender,
          token_number: bookingObj.tokenNumber,
          status: bookingObj.status,
          check_in_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          symptoms: bookingObj.symptoms
        });
    } catch (e) {
      console.warn('Cloud booking error:', e);
    }
  }

  async cloudVerifyDoctor(doctorId, approved, mediarcaId) {
    if (!this.client) return;
    try {
      await this.client
        .from('doctors')
        .update({
          verification_status: approved ? 'verified' : 'rejected',
          mediarca_id: approved ? mediarcaId : null,
          verified_at: approved ? new Date().toISOString() : null
        })
        .eq('id', doctorId);
      console.log(`✅ Doctor ${doctorId} verification updated on Supabase to: ${approved ? 'verified' : 'rejected'}`);
    } catch (e) {
      console.warn('Cloud doctor verification error:', e);
    }
  }
}

window.mediarcaSupabase = new MediarcaSupabaseClient();
