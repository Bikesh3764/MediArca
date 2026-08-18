const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');
const clientJs = fs.readFileSync(path.join(__dirname, '../js/supabase_client.js'), 'utf8');
const queueJs = fs.readFileSync(path.join(__dirname, '../js/queue.js'), 'utf8');
const audioJs = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const schema = fs.readFileSync(path.join(__dirname, '../supabase_schema.sql'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/mediarca.css'), 'utf8');

console.log('====================================================');
console.log('🔍 MEDIARCA DEEP CODEBASE & BUG AUDIT INVESTIGATION');
console.log('====================================================\n');

const findings = [];

// 1. Check window.mediarcaApp methods called across codebase vs defined
const appCalls = new Set();
const allContent = html + appJs + queueJs + storeJs;
for (const m of allContent.matchAll(/window\.mediarcaApp\.([a-zA-Z0-9_]+)\s*\(/g)) {
  appCalls.add(m[1]);
}

for (const method of appCalls) {
  const regex = new RegExp('(async\\s+)?' + method + '\\s*\\(');
  if (!regex.test(appJs)) {
    findings.push({
      severity: 'CRITICAL',
      category: 'RUNTIME_METHOD_MISSING',
      message: `window.mediarcaApp.${method}() is invoked in code but not defined in js/app.js`
    });
  }
}

// 2. Check window.mediarcaStore methods called across codebase vs defined
const storeCalls = new Set();
for (const m of allContent.matchAll(/window\.mediarcaStore\.([a-zA-Z0-9_]+)\s*\(/g)) {
  storeCalls.add(m[1]);
}
for (const method of storeCalls) {
  const regex = new RegExp('(async\\s+)?' + method + '\\s*\\(');
  if (!regex.test(storeJs)) {
    findings.push({
      severity: 'CRITICAL',
      category: 'STORE_METHOD_MISSING',
      message: `window.mediarcaStore.${method}() is invoked in code but not defined in js/store.js`
    });
  }
}

// 3. Check window.mediarcaSupabase methods called across codebase vs defined
const clientCalls = new Set();
for (const m of allContent.matchAll(/window\.mediarcaSupabase\.([a-zA-Z0-9_]+)\s*\(/g)) {
  clientCalls.add(m[1]);
}
for (const method of clientCalls) {
  const regex = new RegExp('(async\\s+)?' + method + '\\s*\\(');
  if (!regex.test(clientJs)) {
    findings.push({
      severity: 'CRITICAL',
      category: 'SUPABASE_METHOD_MISSING',
      message: `window.mediarcaSupabase.${method}() is invoked in code but not defined in js/supabase_client.js`
    });
  }
}

// 4. Check RPC methods called by clientJs vs defined in supabase_schema.sql
const rpcCalls = new Set();
for (const m of clientJs.matchAll(/\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
  rpcCalls.add(m[1]);
}
for (const rpc of rpcCalls) {
  const regex = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+(public\\.)?${rpc}\\b`, 'i');
  if (!regex.test(schema)) {
    findings.push({
      severity: 'CRITICAL',
      category: 'SQL_RPC_MISSING',
      message: `Supabase RPC '${rpc}' is called in js/supabase_client.js but not defined in supabase_schema.sql`
    });
  }
}

// 5. Check DOM Elements accessed via document.getElementById in static views
const domGetElementByIds = new Set();
for (const m of (appJs + queueJs + storeJs).matchAll(/document\.getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g)) {
  domGetElementByIds.add(m[1]);
}

// Dynamic IDs created in render methods vs Static IDs in index.html
const dynamicIdPatterns = [
  'bookingModalDoctorName', 'bookingModalSpecialty', 'bookingModalDoctorId',
  'bookingModalEstimatedToken', 'bookingModalFee', 'bookingDoctorId',
  'bookingDateInput', 'bookingSlotSelect', 'bookingPatientName',
  'bookingPatientAge', 'bookingPatientGender', 'bookingPatientPhone', 'bookingSymptoms',
  'patientPortalContainer', 'doctorPortalContainer', 'adminPortalContainer',
  'receptionPortalContainer', 'tvDisplayContainer', 'queueRadarViewContainer',
  'doctorsDirectoryGrid', 'specialtyPillsContainer', 'mainNavLinks', 'navActionsContainer',
  'quickLookupInput', 'radarSearchInput', 'toastContainer', 'bookingModal',
  'uploadDocModal', 'telemedModal', 'consentModal', 'billingModal',
  'patientAuthTitle', 'patientAuthDesc', 'patientTabLoginBtn', 'patientTabRegisterBtn',
  'patientLoginForm', 'patientRegisterForm', 'patientLoginEmail', 'patientLoginPassword',
  'doctorLoginEmail', 'doctorLoginPassword', 'adminLoginEmail', 'adminLoginPassword',
  'receptionLoginEmail', 'receptionLoginPassword', 'directorySection'
];

console.log(`Audited ${appCalls.size} App methods`);
console.log(`Audited ${storeCalls.size} Store methods`);
console.log(`Audited ${clientCalls.size} Supabase Client methods`);
console.log(`Audited ${rpcCalls.size} RPC definitions`);
console.log(`Audited ${domGetElementByIds.size} DOM getElementById references`);

console.log('\nFindings count so far:', findings.length);
if (findings.length > 0) {
  console.log(JSON.stringify(findings, null, 2));
}
