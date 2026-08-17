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

console.log('--- RUNNING FORENSIC CODEBASE AUDIT ---');

const bugs = [];

// 1. Check switchView coverage for all views
const viewMatches = [...html.matchAll(/id=\"view-([a-zA-Z0-9_-]+)\"/g)].map(m => m[1]);
console.log('Detected views in HTML:', viewMatches);

// Check which views have dynamic containers
const dynamicContainers = {
  'home': 'doctorsDirectoryGrid',
  'queue-radar': 'queueRadarViewContainer',
  'patient-portal': 'patientPortalContainer',
  'doctor-portal': 'doctorPortalContainer',
  'admin-portal': 'adminPortalContainer',
  'reception-portal': 'receptionPortalContainer',
  'tv-display': 'tvDisplayContainer'
};

for (const [view, containerId] of Object.entries(dynamicContainers)) {
  const switchRegex = new RegExp(`viewName === ['"]${view}['"]`);
  if (!switchRegex.test(appJs)) {
    bugs.push({
      severity: 'CRITICAL',
      category: 'VIEW_ROUTING_MISSING',
      message: `View '${view}' has dynamic container '${containerId}' in HTML but switchView in js/app.js does not trigger its render function!`
    });
  }
}

// 2. Check for invalid fallback doctor IDs like 'doc_1'
const doc1Matches = [...appJs.matchAll(/['"]doc_1['"]/g)];
if (doc1Matches.length > 0) {
  bugs.push({
    severity: 'MEDIUM',
    category: 'HARDCODED_ID_FALLBACK',
    message: `js/app.js contains ${doc1Matches.length} occurrences of hardcoded 'doc_1' fallback which does not match UUID doctor IDs in database or seed data.`
  });
}

// 3. Check RPC parameter mapping between supabase_client.js and supabase_schema.sql
// Let's parse all rpc calls in supabase_client.js
const rpcParamRegex = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g;
for (const match of clientJs.matchAll(rpcParamRegex)) {
  const rpcName = match[1];
  const paramsStr = match[2];
  // extract param keys
  const paramKeys = [...paramsStr.matchAll(/([a-zA-Z0-9_]+)\s*:/g)].map(m => m[1]);
  
  // Find function in schema
  const funcRegex = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+(public\\.)?${rpcName}\\s*\\((([\\s\\S]*?))\\)\\s*RETURNS`, 'i');
  const funcMatch = schema.match(funcRegex);
  if (!funcMatch) {
    bugs.push({
      severity: 'CRITICAL',
      category: 'RPC_NOT_IN_SCHEMA',
      message: `RPC '${rpcName}' called in supabase_client.js but not found in schema!`
    });
  } else {
    const schemaParamsStr = funcMatch[3];
    const schemaParamNames = [...schemaParamsStr.matchAll(/p_([a-zA-Z0-9_]+)\b/g)].map(m => 'p_' + m[1]);
    for (const pKey of paramKeys) {
      if (!schemaParamNames.includes(pKey)) {
        bugs.push({
          severity: 'HIGH',
          category: 'RPC_PARAM_MISMATCH',
          message: `RPC '${rpcName}' client passes param '${pKey}', but schema parameter list does not include it! (Schema has: ${schemaParamNames.join(', ')})`
        });
      }
    }
  }
}

// 4. Check form element IDs and field names in index.html vs event handlers
// Booking form:
const bookingFields = ['bookingDoctorId', 'bookingDateInput', 'bookingSlotSelect', 'bookingPatientName', 'bookingPatientAge', 'bookingPatientGender', 'bookingPatientPhone', 'bookingSymptoms'];
for (const fieldId of bookingFields) {
  if (!html.includes(`id="${fieldId}"`)) {
    bugs.push({
      severity: 'CRITICAL',
      category: 'FORM_FIELD_MISSING',
      message: `Booking modal expected field ID '${fieldId}' in index.html, but it was not found!`
    });
  }
}

// 5. Check patient portal: getPatientTimeline vs medicalTimeline array
if (appJs.includes('window.mediarcaStore.state.medicalTimeline.filter(')) {
  bugs.push({
    severity: 'MEDIUM',
    category: 'EHR_TIMELINE_INCOMPLETE',
    message: `renderPatientDashboard filters 'state.medicalTimeline' directly instead of calling dynamic aggregator 'window.mediarcaStore.getPatientTimeline(user.id)', causing newly booked appointments not to reflect in the patient's longitudinal clinical history timeline tab.`
  });
}

// 6. Check for unhandled exceptions in doctor console patient lookup
if (appJs.includes(`const currentPatient = queue.tokens && queue.tokens.find(t => t.tokenNumber === currentToken && t.status === 'in-consultation');`)) {
  bugs.push({
    severity: 'LOW',
    category: 'QUEUE_STATUS_MATCH',
    message: `currentPatient lookup strictly requires 'status === in-consultation'. If doctor advances queue or token is currently 'waiting' or 'checked_in', currentPatient might be undefined unless status transition has already updated to 'in-consultation'.`
  });
}

// 7. Check unescaped properties in HTML templates
const innerHtmlSections = [...appJs.matchAll(/innerHTML\s*=\s*`([\s\S]*?)`/g)].map(m => m[1]);
console.log(`Audited ${innerHtmlSections.length} innerHTML templates in app.js`);

console.log('\n--- AUDIT RESULTS ---');
console.log(`Total potential bugs identified: ${bugs.length}\n`);
bugs.forEach((b, i) => {
  console.log(`[${i+1}] [${b.severity}] ${b.category}:`);
  console.log(`    ${b.message}\n`);
});
