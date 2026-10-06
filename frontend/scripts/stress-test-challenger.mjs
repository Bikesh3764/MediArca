import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('  CHALLENGER 2: EMPIRICAL FRONTEND STRESS TEST & AUDIT HARNESS  ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

// -----------------------------------------------------------------------------
// PART 1: STRESS TEST handleResponse IN services/api.ts
// -----------------------------------------------------------------------------
console.log('--- TEST SUITE 1: handleResponse Resilience & Edge Cases ---');

// Extract the exact handleResponse implementation from frontend/src/services/api.ts
const apiFilePath = path.join(rootDir, 'src', 'services', 'api.ts');
const apiContent = fs.readFileSync(apiFilePath, 'utf-8');

const handleResponseMatch = apiContent.match(/async function handleResponse<T>\(res: Response\): Promise<T> \{([\s\S]*?)\n\}/);
if (!handleResponseMatch) {
  throw new Error('Failed to locate handleResponse in frontend/src/services/api.ts');
}

// Strip TypeScript annotations from the extracted body to run in pure Node
const strippedBody = handleResponseMatch[1]
  .replace(/let data:\s*any/g, 'let data')
  .replace(/const error:\s*any/g, 'const error');

const handleResponse = new Function(
  'res',
  `return (async function() {
${strippedBody}
  })();`
);

async function runApiStressSuite() {
  // Test 1: 502 Bad Gateway with standard HTML payload
  try {
    const res = new Response('<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx/1.24.0</center></body></html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/html' }
    });
    await handleResponse(res);
    assert(false, 'HTML 502 Bad Gateway should throw an error', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 502 && err.message.includes('Server returned error 502: Bad Gateway'),
      'HTML 502 Bad Gateway throws clean Error with status 502 and message',
      err.message
    );
  }

  // Test 2: 504 Gateway Timeout with Cloudflare HTML payload
  try {
    const res = new Response('<!DOCTYPE html><html><head><title>504 Gateway Time-out</title></head><body><h1>504 Gateway Time-out</h1>The server didn\'t respond in time.</body></html>', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Content-Type': 'text/html' }
    });
    await handleResponse(res);
    assert(false, 'HTML 504 Gateway Timeout should throw an error', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 504 && err.message.includes('Server returned error 504: Gateway Timeout'),
      'HTML 504 Gateway Timeout throws clean Error with status 504',
      err.message
    );
  }

  // Test 3: 500 Error with empty statusText and HTML body
  try {
    const res = new Response('<html><body>Internal Server Error</body></html>', {
      status: 500,
      statusText: '',
      headers: { 'Content-Type': 'text/html' }
    });
    await handleResponse(res);
    assert(false, 'HTML 500 with empty statusText should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 500 && err.message === 'Server returned error 500: Unexpected error',
      'HTML 500 fallback statusText defaults to "Unexpected error"',
      err.message
    );
  }

  // Test 4: 200 OK with completely empty body
  try {
    const res = new Response('', { status: 200, statusText: 'OK' });
    const result = await handleResponse(res);
    assert(
      typeof result === 'object' && result !== null && Object.keys(result).length === 0,
      '200 OK with empty body returns empty object {} without crashing',
      JSON.stringify(result)
    );
  } catch (err) {
    assert(false, '200 OK with empty body should not throw', err.message);
  }

  // Test 5: 204 No Content with null body
  try {
    const res = new Response(null, { status: 204, statusText: 'No Content' });
    const result = await handleResponse(res);
    assert(
      typeof result === 'object' && result !== null,
      '204 No Content returns empty object without crashing',
      JSON.stringify(result)
    );
  } catch (err) {
    assert(false, '204 No Content should not throw', err.message);
  }

  // Test 6: 500 Error with completely empty body
  try {
    const res = new Response('', { status: 500, statusText: 'Internal Error' });
    await handleResponse(res);
    assert(false, '500 with empty body should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 500 && err.message.includes('Request failed with status 500'),
      '500 with empty body throws Request failed with status 500',
      err.message
    );
  }

  // Test 7: 500 Error with whitespace only body
  try {
    const res = new Response('   \n\t   ', { status: 500, statusText: 'Internal Error' });
    await handleResponse(res);
    assert(false, '500 with whitespace body should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 500,
      '500 with whitespace body throws with status 500',
      err.message
    );
  }

  // Test 8: 200 OK with plain text response ("OK")
  try {
    const res = new Response('OK', { status: 200, statusText: 'OK' });
    const result = await handleResponse(res);
    assert(
      result === 'OK',
      '200 OK with non-JSON plain text string returns raw text string without syntax error',
      result
    );
  } catch (err) {
    assert(false, '200 OK with plain text string should not throw', err.message);
  }

  // Test 9: 200 OK with malformed JSON string (e.g. truncated stream)
  try {
    const res = new Response('{"success": true, "data": {"id": 1, "name": ', {
      status: 200,
      statusText: 'OK'
    });
    const result = await handleResponse(res);
    assert(
      typeof result === 'string' && result.startsWith('{"success"'),
      '200 OK with truncated/malformed JSON falls back to raw text without unhandled SyntaxError',
      result
    );
  } catch (err) {
    assert(false, '200 OK with malformed JSON should not throw unhandled SyntaxError', err.message);
  }

  // Test 10: 200 OK with JSON { success: false, message: "Token expired" }
  try {
    const res = new Response(JSON.stringify({ success: false, message: 'Token expired' }), {
      status: 200,
      statusText: 'OK'
    });
    await handleResponse(res);
    assert(false, '200 OK with success:false should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.message === 'Token expired' && err.status === 200,
      '200 OK with success: false throws Error with extracted message and status 200',
      err.message
    );
  }

  // Test 11: 400 Bad Request with JSON { error: "Invalid phone number" }
  try {
    const res = new Response(JSON.stringify({ error: 'Invalid phone number' }), {
      status: 400,
      statusText: 'Bad Request'
    });
    await handleResponse(res);
    assert(false, '400 Bad Request should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.message === 'Invalid phone number' && err.status === 400,
      '400 Bad Request extracts error message',
      err.message
    );
  }

  // Test 12: 403 Forbidden with requiresVerification and email
  try {
    const res = new Response(
      JSON.stringify({
        success: false,
        message: 'Email verification required',
        requiresVerification: true,
        email: 'patient@example.com'
      }),
      { status: 403, statusText: 'Forbidden' }
    );
    await handleResponse(res);
    assert(false, '403 with requiresVerification should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.requiresVerification === true && err.email === 'patient@example.com' && err.status === 403,
      '403 preserves requiresVerification and email properties on Error',
      `requiresVerification=${err.requiresVerification}, email=${err.email}`
    );
  }

  // Test 13: 200 OK unwrapping data wrapper { success: true, data: { foo: "bar" } }
  try {
    const res = new Response(JSON.stringify({ success: true, data: { foo: 'bar' } }), {
      status: 200,
      statusText: 'OK'
    });
    const result = await handleResponse(res);
    assert(
      result && result.foo === 'bar',
      '200 OK unwraps .data field',
      JSON.stringify(result)
    );
  } catch (err) {
    assert(false, '200 OK with data wrapper failed', err.message);
  }

  // Test 14: 200 OK with falsy data values ({ data: null }, { data: false }, { data: 0 }, { data: "" })
  try {
    const resNull = new Response(JSON.stringify({ data: null }), { status: 200 });
    const resFalse = new Response(JSON.stringify({ data: false }), { status: 200 });
    const resZero = new Response(JSON.stringify({ data: 0 }), { status: 200 });
    const resEmptyStr = new Response(JSON.stringify({ data: '' }), { status: 200 });

    const [outNull, outFalse, outZero, outEmptyStr] = await Promise.all([
      handleResponse(resNull),
      handleResponse(resFalse),
      handleResponse(resZero),
      handleResponse(resEmptyStr),
    ]);

    assert(
      outNull === null && outFalse === false && outZero === 0 && outEmptyStr === '',
      '200 OK correctly preserves falsy data: null, false, 0, ""',
      `null=${outNull}, false=${outFalse}, 0=${outZero}, ""=${outEmptyStr}`
    );
  } catch (err) {
    assert(false, '200 OK falsy data test threw unexpectedly', err.message);
  }

  // Test 15: Huge 1MB HTML 502 response
  try {
    const hugeHtml = '<html><body>' + 'x'.repeat(1024 * 1024) + '</body></html>';
    const res = new Response(hugeHtml, { status: 502, statusText: 'Bad Gateway' });
    await handleResponse(res);
    assert(false, 'Huge 1MB HTML 502 should throw', 'Did not throw');
  } catch (err) {
    assert(
      err.status === 502 && err.message.includes('Server returned error 502'),
      'Huge 1MB HTML 502 handled cleanly without memory crash',
      err.message
    );
  }

  // Test 16: Aborted stream simulation
  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.error(new Error('Network connection terminated'));
      }
    });
    const res = new Response(stream, { status: 200, statusText: 'OK' });
    await handleResponse(res);
    assert(false, 'Aborted stream should throw network error', 'Did not throw');
  } catch (err) {
    assert(
      err.message.includes('Network connection terminated') || err.message.includes('terminated'),
      'Aborted stream propagates network error rather than throwing SyntaxError',
      err.message
    );
  }
}

// -----------------------------------------------------------------------------
// PART 2: ADVERSARIAL STRESS TEST: LiveQueueTicket.tsx PRESENCE SYNC
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: LiveQueueTicket.tsx State Sync & Routes ---');

function runTicketPresenceSuite() {
  const ticketPath = path.join(rootDir, 'src', 'components', 'queue', 'LiveQueueTicket.tsx');
  const ticketContent = fs.readFileSync(ticketPath, 'utf-8');

  // Verify presenceOverride reset effect
  const presenceEffectMatch = ticketContent.match(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?setPresenceOverride\(null\);[\s\S]*?\}\s*,\s*\[([^\]]*)\]\s*\)/);
  assert(
    Boolean(presenceEffectMatch),
    'LiveQueueTicket has useEffect resetting presenceOverride to null',
    'Effect missing'
  );

  if (presenceEffectMatch) {
    const deps = presenceEffectMatch[1].trim();
    assert(
      deps.includes('appointment.doctor?.cabinStatus'),
      `LiveQueueTicket effect monitors [appointment.doctor?.cabinStatus] (deps: ${deps})`,
      deps
    );
  }

  // Verify presenceOverride local state resolution:
  const localCheckedInMatch = ticketContent.includes('presenceOverride !== null ? presenceOverride : Boolean(appointment.isCheckedIn)');
  assert(
    localCheckedInMatch,
    'localCheckedIn falls back to Boolean(appointment.isCheckedIn) when presenceOverride is null',
    'Expression mismatch'
  );

  // Check Router Link components in LiveQueueTicket
  const routerLinks = [];
  const linkRegex = /<Link\s+to=\{`?([^`"}>]+)`?\}[\s\S]*?>/g;
  let match;
  while ((match = linkRegex.exec(ticketContent)) !== null) {
    routerLinks.push(match[1]);
  }

  assert(
    routerLinks.length >= 2,
    `LiveQueueTicket has at least 2 React Router <Link> elements (found ${routerLinks.length})`,
    JSON.stringify(routerLinks)
  );

  // Check that raw anchors <a href="#/..."> are no longer present for SPA transitions
  const rawHashAnchorMatch = ticketContent.match(/<a\s+[^>]*href=["']#\/[^"']*["']/);
  assert(
    !rawHashAnchorMatch,
    'LiveQueueTicket contains ZERO raw hash anchors <a href="#/...">',
    rawHashAnchorMatch ? rawHashAnchorMatch[0] : 'None'
  );

  // Verify routes exist in App.tsx
  const appPath = path.join(rootDir, 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  const hasBookRoute = appContent.includes('path="/book/:id"');
  const hasClinicCheckinRoute = appContent.includes('path="/clinic-checkin"');

  assert(
    hasBookRoute && hasClinicCheckinRoute,
    'Both target routes (/book/:id and /clinic-checkin) are registered in App.tsx',
    `hasBookRoute=${hasBookRoute}, hasClinicCheckinRoute=${hasClinicCheckinRoute}`
  );
}

// -----------------------------------------------------------------------------
// PART 3: CameraQrScannerModal & ReceptionistDashboard UNMOUNTING AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Component Lifecycle & Unmount Resilience ---');

function runLifecycleSuite() {
  const modalPath = path.join(rootDir, 'src', 'components', 'common', 'CameraQrScannerModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  const hasStopCamera = modalContent.includes('stopCamera()');
  const hasTrackStop = modalContent.includes('streamRef.current.getTracks().forEach((track) => track.stop())');
  const hasCancelAnim = modalContent.includes('cancelAnimationFrame(animationFrameRef.current)');
  const hasEffectCleanup = modalContent.includes('return () => {\n      stopCamera();\n    };');

  assert(
    hasStopCamera && hasTrackStop && hasCancelAnim && hasEffectCleanup,
    'CameraQrScannerModal properly stops all camera tracks and cancels animation frames in effect cleanup',
    `stopCamera=${hasStopCamera}, trackStop=${hasTrackStop}, cancelAnim=${hasCancelAnim}`
  );

  // Check ReceptionistDashboard interval cleanup
  const dashPath = path.join(rootDir, 'src', 'pages', 'Receptionist', 'ReceptionistDashboard.tsx');
  const dashContent = fs.readFileSync(dashPath, 'utf-8');

  const hasIntervalCleanup = dashContent.includes('return () => clearInterval(interval);');
  assert(
    hasIntervalCleanup,
    'ReceptionistDashboard cleans up 15s polling interval on unmount (clearInterval)',
    'Missing clearInterval cleanup'
  );

  const hasMountedGuards = dashContent.includes('let mounted = true;') && dashContent.includes('mounted = false;');
  assert(
    hasMountedGuards,
    'ReceptionistDashboard uses mounted flags for microtask effects to avoid memory leak / unmounted dispatches',
    'Missing mounted flag guard'
  );
}

// -----------------------------------------------------------------------------
// PART 4: AUDIT FOR #0088e8 CYAN OCCURRENCES
// -----------------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Apple HIG Design Token Audit (#0088e8) ---');

function runColorAuditSuite() {
  const m2AssignedFiles = [
    'src/pages/Admin/AdminDashboard.tsx',
    'src/components/queue/LiveQueueTicket.tsx',
    'src/services/api.ts',
    'src/components/common/CameraQrScannerModal.tsx',
    'src/pages/Receptionist/ReceptionistDashboard.tsx',
    'src/components/layout/DashboardLayout.tsx',
    'src/pages/Clinic/ClinicDashboard.tsx',
    'src/pages/Clinic/ClinicAuth.tsx',
    'src/components/ui/ErrorBoundary.tsx',
    'src/components/ui/DoctorCabinPresence.tsx',
    'src/pages/Doctor/DoctorProfile.tsx',
  ];

  let m2Violations = 0;
  for (const relPath of m2AssignedFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = content.match(/#0088e8/gi);
      if (matches) {
        m2Violations += matches.length;
        console.error(`    Violation in M2 assigned file: ${relPath} (${matches.length} instances)`);
      }
    }
  }

  assert(
    m2Violations === 0,
    `M2 Assigned Files contain exactly ZERO instances of #0088e8 (found ${m2Violations})`,
    `${m2Violations} instances found`
  );

  // Scan all files in src/
  function scanDir(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full, fileList);
      } else if (/\.(tsx|ts|css)$/.test(f)) {
        fileList.push(full);
      }
    }
    return fileList;
  }

  const allSrcFiles = scanDir(path.join(rootDir, 'src'));
  const allViolationsByFile = {};
  let totalOccurrences = 0;

  for (const f of allSrcFiles) {
    const content = fs.readFileSync(f, 'utf-8');
    const matches = content.match(/#0088e8/gi);
    if (matches) {
      const rel = path.relative(rootDir, f);
      allViolationsByFile[rel] = matches.length;
      totalOccurrences += matches.length;
    }
  }

  console.log(`\n  Global Codebase Scan (frontend/src):`);
  console.log(`  Total #0088e8 occurrences found: ${totalOccurrences} across ${Object.keys(allViolationsByFile).length} files.`);
  for (const [f, count] of Object.entries(allViolationsByFile)) {
    console.log(`    - ${f}: ${count}`);
  }
}

// -----------------------------------------------------------------------------
// EXECUTE ALL SUITES
// -----------------------------------------------------------------------------
async function runAll() {
  await runApiStressSuite();
  runTicketPresenceSuite();
  runLifecycleSuite();
  runColorAuditSuite();

  console.log('\n================================================================');
  console.log(`  EMPIRICAL AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILS)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Test execution crashed:', err);
  process.exit(1);
});
