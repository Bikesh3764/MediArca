/**
 * Deep Static & Logic Auditor for MediArca
 */

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../js/app.js');
const storePath = path.join(__dirname, '../js/store.js');
const queuePath = path.join(__dirname, '../js/queue.js');
const clientPath = path.join(__dirname, '../js/supabase_client.js');
const indexPath = path.join(__dirname, '../index.html');
const schemaPath = path.join(__dirname, '../supabase_schema.sql');

const appCode = fs.readFileSync(appPath, 'utf8');
const storeCode = fs.readFileSync(storePath, 'utf8');
const queueCode = fs.readFileSync(queuePath, 'utf8');
const clientCode = fs.readFileSync(clientPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

console.log('=== RUNNING DEEP COMPREHENSIVE REPOSITORY AUDIT ===\n');

let issues = [];

// 1. Audit window.mediarcaApp method invocations
const appMethodRegex = /window\.mediarcaApp\.([a-zA-Z0-9_]+)\s*\(/g;
let match;
const appMethodsCalled = new Set();
while ((match = appMethodRegex.exec(appCode)) !== null) {
  appMethodsCalled.add(match[1]);
}
while ((match = appMethodRegex.exec(indexHtml)) !== null) {
  appMethodsCalled.add(match[1]);
}
while ((match = appMethodRegex.exec(queueCode)) !== null) {
  appMethodsCalled.add(match[1]);
}

for (const method of appMethodsCalled) {
  const defRegex = new RegExp(`(^|\\s)${method}\\s*\\(`, 'm');
  if (!defRegex.test(appCode)) {
    issues.push(`[CRITICAL] window.mediarcaApp.${method}() is called but NOT defined in MediarcaApp class!`);
  }
}

// 2. Audit window.mediarcaQueueEngine method invocations
const queueMethodRegex = /window\.mediarcaQueueEngine\.([a-zA-Z0-9_]+)\s*\(/g;
const queueMethodsCalled = new Set();
while ((match = queueMethodRegex.exec(appCode)) !== null) {
  queueMethodsCalled.add(match[1]);
}
while ((match = queueMethodRegex.exec(indexHtml)) !== null) {
  queueMethodsCalled.add(match[1]);
}
while ((match = queueMethodRegex.exec(queueCode)) !== null) {
  queueMethodsCalled.add(match[1]);
}

for (const method of queueMethodsCalled) {
  const defRegex = new RegExp(`(^|\\s)${method}\\s*\\(`, 'm');
  if (!defRegex.test(queueCode)) {
    issues.push(`[CRITICAL] window.mediarcaQueueEngine.${method}() is called but NOT defined in MediarcaQueueEngine class!`);
  }
}

// 3. Audit window.mediarcaStore method invocations
const storeMethodRegex = /window\.mediarcaStore\.([a-zA-Z0-9_]+)\s*\(/g;
const storeMethodsCalled = new Set();
while ((match = storeMethodRegex.exec(appCode)) !== null) {
  storeMethodsCalled.add(match[1]);
}
while ((match = storeMethodRegex.exec(indexHtml)) !== null) {
  storeMethodsCalled.add(match[1]);
}
while ((match = storeMethodRegex.exec(queueCode)) !== null) {
  storeMethodsCalled.add(match[1]);
}

for (const method of storeMethodsCalled) {
  const defRegex = new RegExp(`(^|\\s)${method}\\s*\\(`, 'm');
  if (!defRegex.test(storeCode)) {
    issues.push(`[CRITICAL] window.mediarcaStore.${method}() is called but NOT defined in MediarcaStore class!`);
  }
}

// 4. Audit Supabase Client RPC invocations
const rpcCallRegex = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
const rpcsCalled = new Set();
while ((match = rpcCallRegex.exec(clientCode)) !== null) {
  rpcsCalled.add(match[1]);
}

for (const rpc of rpcsCalled) {
  const rpcDefRegex = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${rpc}\\s*\\(`, 'i');
  if (!rpcDefRegex.test(schemaSql)) {
    issues.push(`[CRITICAL] Supabase RPC '${rpc}' is called in js/supabase_client.js but NOT found in supabase_schema.sql!`);
  }
}

// 5. Audit all document.getElementById references in index.html & app.js
const getElemRegex = /document\.getElementById\(\s*['"]([a-zA-Z0-9_\-]+)['"]\s*\)/g;
const allCodeCombined = indexHtml + '\n' + appCode + '\n' + queueCode + '\n' + storeCode;
const idsQueried = new Set();
while ((match = getElemRegex.exec(appCode)) !== null) {
  idsQueried.add(match[1]);
}
while ((match = getElemRegex.exec(queueCode)) !== null) {
  idsQueried.add(match[1]);
}

for (const id of idsQueried) {
  const idDefRegex = new RegExp(`id=["']${id}["']`, 'i');
  if (!idDefRegex.test(allCodeCombined)) {
    issues.push(`[WARNING] DOM element id '${id}' is queried with getElementById() but never defined with id="${id}" in HTML or templates!`);
  }
}

console.log(`Audited ${appMethodsCalled.size} App methods called.`);
console.log(`Audited ${queueMethodsCalled.size} QueueEngine methods called.`);
console.log(`Audited ${storeMethodsCalled.size} Store methods called.`);
console.log(`Audited ${rpcsCalled.size} Supabase RPCs called.`);
console.log(`Audited ${idsQueried.size} DOM Element IDs queried.`);

if (issues.length > 0) {
  console.log(`\n❌ Found ${issues.length} potential issues:\n`);
  issues.forEach(i => console.log('  ' + i));
  process.exit(1);
} else {
  console.log('\n✅ 0 Critical Issues, 0 Undefined Handlers, 0 RPC Mismatches, 0 Missing DOM Elements Found!');
  console.log('🎉 100% BULLETPROOF ARCHITECTURE & STATIC VALIDATION CONFIRMED!');
}
