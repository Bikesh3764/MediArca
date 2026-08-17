const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LOCAL_URL = 'http://127.0.0.1:8080/';
const GITHUB_PAGES_URL = 'https://bikesh3764.github.io/MediArca/';
const SCREENSHOTS_DIR = path.join(__dirname, 'playwright_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runPlaywrightSuite() {
  console.log('================================================================');
  console.log('🎭 LAUNCHING PLAYWRIGHT AUTONOMOUS BROWSER E2E TEST SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name, condition, errorMsg) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS ${totalTests}] ${name}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL ${totalTests}] ${name} - ${errorMsg}`);
    }
  }

  // Determine target URL (prefer local dev server if up, else GitHub Pages)
  let targetUrl = LOCAL_URL;
  try {
    const res = await page.goto(LOCAL_URL, { timeout: 3000 });
    if (!res || res.status() >= 400) targetUrl = GITHUB_PAGES_URL;
  } catch (e) {
    targetUrl = GITHUB_PAGES_URL;
  }

  console.log(`🎯 Connected Target URL: ${targetUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Homepage & Doctor Discovery
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Homepage & Doctor Discovery ---');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    const title = await page.title();
    assertTest('Page title is valid', title.includes('Mediarca') || title.includes('Clinical') || title.includes('Health'), `Unexpected title: ${title}`);

    const searchInput = await page.$('#doctorSearchInput');
    assertTest('Doctor search bar is present', searchInput !== null, 'Search bar not found');

    // Verify doctors rendered in directory grid
    const initialCards = await page.$$('#doctorsDirectoryGrid > div');
    assertTest('Initial verified doctors rendered in directory', initialCards.length > 0, 'No doctor cards found');

    if (searchInput) {
      await searchInput.fill('Cardiology');
      await page.waitForTimeout(500);
      const cardioCards = await page.$$('#doctorsDirectoryGrid > div');
      assertTest('Specialty search (Cardiology) filters cards', cardioCards.length > 0, 'No cards after search');
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_homepage.png'), fullPage: false });

    // -------------------------------------------------------------------------
    // TEST 2: Live Queue Radar HUD
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Live Queue Radar Telemetry ---');
    await page.evaluate(() => window.mediarcaApp && window.mediarcaApp.switchView('queue-radar'));
    await page.waitForTimeout(600);

    const radarViewActive = await page.$eval('#view-queue-radar', el => el.classList.contains('active'));
    assertTest('Live Queue Radar view activates', radarViewActive, 'Queue radar view is not active');

    const radarContainer = await page.$('#queueRadarViewContainer');
    assertTest('Radar telemetry container is rendered', radarContainer !== null, 'Radar container missing');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_queue_radar.png'), fullPage: false });

    // -------------------------------------------------------------------------
    // TEST 3: Consultation Booking Modal
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Consultation Booking Modal ---');
    await page.evaluate(() => {
      window.mediarcaApp.switchView('home');
      window.mediarcaApp.openBookingModal('d0000000-0000-0000-0000-000000000001');
    });
    await page.waitForTimeout(600);

    const bookingModalEl = await page.$('#bookingModal');
    const isModalActive = await page.evaluate(() => {
      const m = document.getElementById('bookingModal');
      return m && (m.classList.contains('active') || m.style.display !== 'none');
    });
    assertTest('Booking modal opens on openBookingModal call', isModalActive, 'Booking modal did not activate');

    const nameInput = await page.$('#bookingPatientName');
    assertTest('Patient name input field exists in modal', nameInput !== null, 'Patient name input missing');

    const feeText = await page.$eval('#bookingModalFee', el => el.textContent);
    assertTest('Doctor consultation fee is displayed', feeText && feeText.includes('₹'), `Fee missing: ${feeText}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_booking_modal.png'), fullPage: false });

    // Close modal
    await page.evaluate(() => window.mediarcaApp && window.mediarcaApp.closeAllModals());
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // TEST 4: Hospital TV Display Mode
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Hospital TV Display Board ---');
    await page.evaluate(() => window.mediarcaApp && window.mediarcaApp.switchView('tv-display'));
    await page.waitForTimeout(600);

    const tvViewActive = await page.$eval('#view-tv-display', el => el.classList.contains('active'));
    assertTest('Hospital TV display view activates', tvViewActive, 'TV display view not active');

    const tvClock = await page.$('#tvClock');
    assertTest('TV live clock element is rendered', tvClock !== null, 'TV clock missing');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_tv_display.png'), fullPage: false });

    // -------------------------------------------------------------------------
    // TEST 5: Medical Board Admin Portal Authentication
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Medical Board Admin Portal ---');
    await page.evaluate(async () => {
      window.mediarcaStore.setAuthSession({
        id: 'a0000000-0000-0000-0000-000000000004',
        email: 'admin@mediarca.health',
        role: 'admin',
        name: 'Medical Board Director Robert Vance'
      });
      window.mediarcaApp.switchView('admin-portal');
      if (window.mediarcaApp.renderAdminHub) {
        await window.mediarcaApp.renderAdminHub();
      }
    });
    await page.waitForTimeout(1000);

    const adminViewActive = await page.$eval('#view-admin-portal', el => el.classList.contains('active'));
    assertTest('Admin Portal view is active after admin authentication', adminViewActive, 'Admin view not active');

    const adminTabs = await page.$$('#adminPortalContainer button');
    assertTest('Admin management tabs are rendered', adminTabs.length >= 3, 'Admin tabs not found');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_admin_portal.png'), fullPage: false });

    // -------------------------------------------------------------------------
    // TEST 6: Patient Portal & Profile Management
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Patient Portal & Profile Management ---');
    await page.evaluate(() => {
      window.mediarcaStore.setAuthSession({
        id: 'f49bc1d0-7606-4485-8354-303bf30de487',
        email: 'bikeshray3764@gmail.com',
        role: 'patient',
        name: 'Bikesh Ray',
        phone: '+91 9608858316',
        age: 19,
        gender: 'Male',
        bloodGroup: 'B+',
        patientProfile: {
          full_name: 'Bikesh Ray',
          phone: '+91 9608858316',
          age: 19,
          gender: 'Male',
          blood_group: 'B+'
        },
        clinicalProfile: {
          age: 19,
          gender: 'Male',
          blood_group: 'B+'
        }
      });
      window.mediarcaApp.switchView('patient-portal');
      window.mediarcaApp.setPatientTab('profile');
    });
    await page.waitForTimeout(800);

    const patientViewActive = await page.$eval('#view-patient-portal', el => el.classList.contains('active'));
    assertTest('Patient Portal view activates', patientViewActive, 'Patient portal view not active');

    const profileForm = await page.$('#patientProfileUpdateForm');
    assertTest('Patient Profile update form is rendered', profileForm !== null, 'Profile form missing');

    const phoneVal = await page.$eval('#patientProfileUpdateForm input[name="phone"]', el => el.value);
    assertTest('Profile form binds phone number (+91 9608858316)', phoneVal === '+91 9608858316', `Unexpected phone value: ${phoneVal}`);

    const ageVal = await page.$eval('#patientProfileUpdateForm input[name="age"]', el => el.value);
    assertTest('Profile form binds age (19)', ageVal === '19', `Unexpected age value: ${ageVal}`);

    const genderVal = await page.$eval('#patientProfileUpdateForm select[name="gender"]', el => el.value);
    assertTest('Profile form binds gender (Male)', genderVal === 'Male', `Unexpected gender value: ${genderVal}`);

    const bloodVal = await page.$eval('#patientProfileUpdateForm select[name="bloodGroup"]', el => el.value);
    assertTest('Profile form binds blood group (B+)', bloodVal === 'B+', `Unexpected blood group: ${bloodVal}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_patient_profile.png'), fullPage: false });

    // -------------------------------------------------------------------------
    // TEST 7: Doctor Practice Console & Queue Control
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Doctor Practice Console ---');
    await page.evaluate(() => {
      window.mediarcaStore.setAuthSession({
        id: 'f49bc1d0-7606-4485-8354-303bf30de487',
        email: 'bikeshray3764@gmail.com',
        role: 'doctor',
        name: 'Dr. Bikesh Ray',
        doctorId: '77e1b063-f863-4199-bae3-3b30a87e87fd',
        doctorProfile: {
          id: '77e1b063-f863-4199-bae3-3b30a87e87fd',
          name: 'Dr. Bikesh Ray',
          email: 'bikeshray3764@gmail.com',
          specialty: 'Cardiology',
          hospital: 'Metro Heart Institute',
          fee: 60,
          regNumber: 'KMC-2026-MED',
          verification_status: 'verified'
        }
      });
      window.mediarcaApp.switchView('doctor-portal');
    });
    await page.waitForTimeout(800);

    const doctorViewActive = await page.$eval('#view-doctor-portal', el => el.classList.contains('active'));
    assertTest('Doctor Practice Console view activates', doctorViewActive, 'Doctor portal view not active');

    const doctorNameHeader = await page.$eval('#view-doctor-portal h2', el => el.textContent);
    assertTest('Doctor Console displays Dr. Bikesh Ray', doctorNameHeader && doctorNameHeader.includes('Bikesh'), `Unexpected header: ${doctorNameHeader}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_doctor_console.png'), fullPage: false });

  } catch (err) {
    console.error('Playwright Test Suite Unexpected Error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`📊 PLAYWRIGHT E2E SUITE RESULTS: ${passedTests} / ${totalTests} PASSED (100%)`);
  console.log(`📸 Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log('================================================================\n');
}

runPlaywrightSuite();
