import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { sanitizeSchoolTraceArtifacts } from '../scripts/sanitize-school-traces.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const sanitizerPath = path.join(projectRoot, 'scripts', 'sanitize-school-traces.mjs');

const bearerSecret = 'eyJhbGciOiJIUzI1NiJ9.synthetic-secret.signature';
const sessionSecret = 'nextauth-session-secret-value-1234567890';
const secureSessionSecret = 'secure-nextauth-session-secret-value-0987654321';
const structuredSessionSecret = 'structured-nextauth-session-secret-value-1122334455';
const rawAccessTokenSecret = 'raw-access-token-secret-value-5566778899';
const escapedAccessTokenSecret = 'escaped-access-token-secret-value-9988776655';
const csrfCookieSecret = 'csrf-cookie-secret-value-1029384756';
const rawCsrfTokenSecret = 'raw-csrf-token-secret-value-5647382910';
const escapedCsrfTokenSecret = 'escaped-csrf-token-secret-value-0192837465';
const sourceLiteral = 'headers: { Authorization: `Bearer ${accessToken}` }';
const qaEmail = 'school.qa.private@example.com';
const learnerName = 'Representative Learner Name';
const parentName = 'Representative Parent Name';
const schoolName = 'Representative Private School';
const learnerGoal = 'Read private stories with confidence.';
const parentGoal = 'Build a private weekly learning habit.';
const piiValues = [qaEmail, learnerName, parentName, schoolName, learnerGoal, parentGoal];

async function createSyntheticTraceZip(root) {
  const sourceDir = path.join(root, 'source');
  const resourcesDir = path.join(sourceDir, 'resources');
  const zipPath = path.join(root, 'trace.zip');
  const extensionlessTextName = 'ad3e55c1b48f41a9a62717ab55a4c4f09db3ac25';
  const extensionlessBinaryName = 'bb6e23c1a2dc4a4d8a947472dbd48642874a786f';
  const extensionlessBinary = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('ordinary-binary-payload'),
    Buffer.from([0xff, 0xd9]),
  ]);
  await mkdir(resourcesDir, { recursive: true });
  await writeFile(path.join(sourceDir, 'trace.trace'), [
    JSON.stringify({ authorization: `Bearer ${bearerSecret}` }),
    JSON.stringify({
      cookies: [{ name: 'next-auth.session-token', value: structuredSessionSecret }],
    }),
    JSON.stringify({ source: sourceLiteral }),
  ].join('\n'));
  await writeFile(path.join(sourceDir, 'trace.network'), JSON.stringify({
    request: {
      headers: {
        cookie: [
          'theme=light',
          `next-auth.session-token=${sessionSecret}`,
          `next-auth.csrf-token=${csrfCookieSecret}`,
          'locale=en',
        ].join('; '),
      },
    },
    response: {
      headers: {
        'set-cookie': `__Secure-next-auth.session-token=${secureSessionSecret}; Path=/; HttpOnly`,
      },
    },
  }));
  await writeFile(path.join(resourcesDir, extensionlessTextName), [
    JSON.stringify({
      accessToken: rawAccessTokenSecret,
      csrfToken: rawCsrfTokenSecret,
      user: 'synthetic-user',
    }),
    JSON.stringify({
      encoded: JSON.stringify({
        accessToken: escapedAccessTokenSecret,
        csrfToken: escapedCsrfTokenSecret,
      }),
    }),
    sourceLiteral,
  ].join('\n'));
  await writeFile(path.join(resourcesDir, extensionlessBinaryName), extensionlessBinary);
  await writeFile(path.join(resourcesDir, 'src.txt'), sourceLiteral);
  await writeFile(path.join(resourcesDir, 'payload.bin'), Buffer.from([0, 1, 2, 255]));
  await execFileAsync('zip', ['-q', '-r', zipPath, '.'], { cwd: sourceDir });
  return { extensionlessBinary, extensionlessBinaryName, extensionlessTextName, zipPath };
}

async function unpack(zipPath, destination) {
  await mkdir(destination, { recursive: true });
  await execFileAsync('unzip', ['-q', zipPath, '-d', destination]);
}

test('sanitizes concrete School trace credentials and preserves harmless content', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'zidd-school-trace-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const {
    extensionlessBinary,
    extensionlessBinaryName,
    extensionlessTextName,
    zipPath,
  } = await createSyntheticTraceZip(root);

  const dirtyScan = await execFileAsync(process.execPath, [sanitizerPath, '--check', zipPath])
    .then(() => ({ status: 0, stderr: '' }))
    .catch((error) => ({ status: error.code, stderr: error.stderr }));
  assert.notEqual(dirtyScan.status, 0);
  assert.doesNotMatch(dirtyScan.stderr, new RegExp([
    bearerSecret,
    sessionSecret,
    secureSessionSecret,
    structuredSessionSecret,
    rawAccessTokenSecret,
    escapedAccessTokenSecret,
    csrfCookieSecret,
    rawCsrfTokenSecret,
    escapedCsrfTokenSecret,
  ].join('|')));

  const sanitized = await execFileAsync(process.execPath, [sanitizerPath, zipPath]);
  assert.equal(sanitized.stderr, '');

  const cleanScan = await execFileAsync(process.execPath, [sanitizerPath, '--check', zipPath]);
  assert.equal(cleanScan.stderr, '');

  const unpackedDir = path.join(root, 'unpacked');
  await unpack(zipPath, unpackedDir);
  const traceText = await readFile(path.join(unpackedDir, 'trace.trace'), 'utf8');
  const networkText = await readFile(path.join(unpackedDir, 'trace.network'), 'utf8');
  const sourceText = await readFile(path.join(unpackedDir, 'resources', 'src.txt'), 'utf8');
  const binary = await readFile(path.join(unpackedDir, 'resources', 'payload.bin'));
  const extensionlessText = await readFile(
    path.join(unpackedDir, 'resources', extensionlessTextName),
    'utf8',
  );
  const extensionlessBinaryAfter = await readFile(
    path.join(unpackedDir, 'resources', extensionlessBinaryName),
  );

  const sanitizedText = `${traceText}\n${networkText}\n${extensionlessText}`;
  assert.doesNotMatch(sanitizedText, new RegExp([
    bearerSecret,
    sessionSecret,
    secureSessionSecret,
    structuredSessionSecret,
    rawAccessTokenSecret,
    escapedAccessTokenSecret,
    csrfCookieSecret,
    rawCsrfTokenSecret,
    escapedCsrfTokenSecret,
  ].join('|')));
  assert.match(traceText, /Bearer \[REDACTED\]/);
  assert.match(networkText, /next-auth\.session-token=\[REDACTED\]/);
  assert.match(networkText, /next-auth\.csrf-token=\[REDACTED\]/);
  assert.match(networkText, /__Secure-next-auth\.session-token=\[REDACTED\]/);
  assert.match(extensionlessText, /"accessToken":"\[REDACTED\]"/);
  assert.match(extensionlessText, /\\"accessToken\\":\\"\[REDACTED\]\\"/);
  assert.match(extensionlessText, /"csrfToken":"\[REDACTED\]"/);
  assert.match(extensionlessText, /\\"csrfToken\\":\\"\[REDACTED\]\\"/);
  assert.match(extensionlessText, /Bearer \$\{accessToken\}/);
  assert.match(traceText, /Bearer \$\{accessToken\}/);
  assert.equal(sourceText, sourceLiteral);
  assert.deepEqual(binary, Buffer.from([0, 1, 2, 255]));
  assert.deepEqual(extensionlessBinaryAfter, extensionlessBinary);
});

test('removes unsafe trace archives containing personal data in binary resources', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'zidd-school-binary-trace-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const mode of ['check', 'sanitize']) {
    const sourceDir = path.join(root, `${mode}-source`);
    const resourcesDir = path.join(sourceDir, 'resources');
    const zipPath = path.join(root, `${mode}-trace.zip`);
    const binary = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from(`${qaEmail}; Bearer ${bearerSecret}; next-auth.session-token=${sessionSecret}`),
      Buffer.from([0xff, 0xd9]),
    ]);
    await mkdir(resourcesDir, { recursive: true });
    await writeFile(path.join(sourceDir, 'trace.trace'), '{"event":"synthetic"}');
    await writeFile(path.join(resourcesDir, 'unsafe-binary'), binary);
    await execFileAsync('zip', ['-q', '-r', zipPath, '.'], { cwd: sourceDir });

    const args = mode === 'check' ? ['--check', zipPath] : [zipPath];
    const result = await execFileAsync(process.execPath, [sanitizerPath, ...args])
      .then(() => ({ status: 0, stderr: '' }))
      .catch((error) => ({ status: error.code, stderr: error.stderr }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /binary/);
    assert.doesNotMatch(result.stderr, new RegExp(`${qaEmail}|${bearerSecret}|${sessionSecret}`));
    await assert.rejects(access(zipPath), { code: 'ENOENT' });
  }
});

test('removes an unsafe standalone binary while retaining safe traces and results', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'zidd-school-standalone-binary-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'safe-trace-source');
  const traceDir = path.join(root, 'safe-trace');
  const zipPath = path.join(traceDir, 'trace.zip');
  const resultPath = path.join(root, 'phase-b-results.json');
  const unsafeBinaryPath = path.join(root, 'unsafe-evidence.png');

  await mkdir(sourceDir, { recursive: true });
  await mkdir(traceDir, { recursive: true });
  await writeFile(path.join(sourceDir, 'trace.trace'), '{"event":"safe","passed":true}');
  await execFileAsync('zip', ['-q', '-r', zipPath, '.'], { cwd: sourceDir });
  await writeFile(resultPath, '{"passed":true,"counts":{"tests":2}}');
  await writeFile(unsafeBinaryPath, Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    Buffer.from(qaEmail),
    Buffer.from([0xff, 0xd9]),
  ]));

  await assert.rejects(sanitizeSchoolTraceArtifacts(root), /binary-personal-data/);
  await assert.rejects(access(unsafeBinaryPath), { code: 'ENOENT' });
  await access(zipPath);
  assert.equal(await readFile(resultPath, 'utf8'), '{"passed":true,"counts":{"tests":2}}');
});

test('resolves zip tools through PATH instead of hardcoded system paths', async () => {
  const sanitizerSource = await readFile(sanitizerPath, 'utf8');
  const testSource = await readFile(import.meta.filename, 'utf8');
  assert.doesNotMatch(sanitizerSource, /\/usr\/bin\/(?:zip|unzip)/);
  assert.doesNotMatch(testSource, /\/usr\/bin\/(?:zip|unzip)/);
});

test('sanitizes School PII from trace archives, Playwright JSON results, and attachments', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'zidd-school-pii-artifacts-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const traceSource = path.join(root, 'trace-source');
  const traceResources = path.join(traceSource, 'resources');
  const traceDirectory = path.join(root, 'phase-b', 'initial-context');
  const attachmentDirectory = path.join(root, 'phase-b', 'attachments');
  const zipPath = path.join(traceDirectory, 'trace.zip');
  const profilePayload = {
    display_name: learnerName,
    school_name: schoolName,
    board_id: 'cbse',
    target_class_no: 3,
    learner_goal: learnerGoal,
    parent_goal: parentGoal,
    parent: { name: parentName, email: qaEmail },
  };

  await mkdir(traceResources, { recursive: true });
  await mkdir(traceDirectory, { recursive: true });
  await mkdir(attachmentDirectory, { recursive: true });
  await writeFile(path.join(traceSource, 'trace.trace'), JSON.stringify({
    email: qaEmail,
    request: { postData: JSON.stringify(profilePayload) },
  }));
  await writeFile(path.join(traceResources, 'profile-response'), JSON.stringify({
    user: { name: parentName, email: qaEmail },
    profile: profilePayload,
  }));
  await execFileAsync('zip', ['-q', '-r', zipPath, '.'], { cwd: traceSource });

  const resultPath = path.join(root, 'phase-b-results.json');
  const attachmentPath = path.join(attachmentDirectory, 'phase-b-browser-evidence.json');
  await writeFile(resultPath, JSON.stringify({
    account: qaEmail,
    attachments: [{ path: attachmentPath }],
    profile: profilePayload,
  }, null, 2));
  await writeFile(attachmentPath, JSON.stringify({
    learner_name: learnerName,
    school_name: schoolName,
    learner_goal: learnerGoal,
    parent_goal: parentGoal,
    parent_name: parentName,
    account: qaEmail,
    school_request_payloads: [profilePayload],
  }, null, 2));

  const dirtyScan = await execFileAsync(process.execPath, [sanitizerPath, '--check', zipPath])
    .then(() => ({ status: 0, stderr: '' }))
    .catch((error) => ({ status: error.code, stderr: error.stderr }));
  assert.notEqual(dirtyScan.status, 0);
  assert.doesNotMatch(dirtyScan.stderr, new RegExp(piiValues.join('|')));

  await sanitizeSchoolTraceArtifacts(root);

  const unpacked = path.join(root, 'unpacked-pii-trace');
  await unpack(zipPath, unpacked);
  const persistedText = [
    await readFile(path.join(unpacked, 'trace.trace'), 'utf8'),
    await readFile(path.join(unpacked, 'resources', 'profile-response'), 'utf8'),
    await readFile(resultPath, 'utf8'),
    await readFile(attachmentPath, 'utf8'),
  ].join('\n');
  for (const value of piiValues) {
    assert.doesNotMatch(persistedText, new RegExp(value));
  }
  assert.doesNotMatch(persistedText, /target_class_no|"school_request_payloads":\[|"postData":"\{/);
  assert.match(persistedText, /\[REDACTED\]/);
  await execFileAsync(process.execPath, [sanitizerPath, '--check', zipPath]);
});

test('returns no artifacts when the School browser output root does not exist', async () => {
  const missingRoot = path.join(tmpdir(), `zidd-missing-school-artifacts-${crypto.randomUUID()}`);
  assert.deepEqual(await sanitizeSchoolTraceArtifacts(missingRoot), []);
});

test('keeps Playwright discovery output separate from QA pass evidence', async () => {
  const configSource = await readFile(
    path.join(projectRoot, 'playwright.school-phase-b.config.ts'),
    'utf8',
  );
  const browserSource = await readFile(
    path.join(projectRoot, 'tests', 'browser', 'school-phase-b.spec.ts'),
    'utf8',
  );
  assert.match(configSource, /process\.argv\.includes\(['"]--list['"]\)/);
  assert.match(configSource, /phase-b-discovery-results\.json/);
  assert.match(configSource, /phase-b-results\.json/);
  assert.match(configSource, /screenshot:\s*['"]off['"]/);
  assert.match(
    browserSource,
    /tracing\.start\(\{\s*screenshots:\s*false,\s*snapshots:\s*false,\s*sources:\s*false\s*\}\)/,
  );
  assert.doesNotMatch(browserSource, /\.screenshot\s*\(/);
});
