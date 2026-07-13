import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify, TextDecoder } from 'node:util';

const execFileAsync = promisify(execFile);
const ZIP = process.env.ZIDD_ZIP_BIN || 'zip';
const UNZIP = process.env.ZIDD_UNZIP_BIN || 'unzip';
const REDACTED = '[REDACTED]';
const DEFAULT_TRACE_ROOT = path.resolve('test-results/school-browser');
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const BINARY_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000E-\u001F\u007F]/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PERSONAL_DATA_KEYS = new Set([
  'account',
  'body',
  'displayname',
  'email',
  'error',
  'errors',
  'learnergoal',
  'learnername',
  'message',
  'name',
  'parentgoal',
  'parentname',
  'payload',
  'postdata',
  'profile',
  'requestbody',
  'responsebody',
  'schoolrequestpayloads',
  'schoolname',
  'snippet',
  'stack',
  'stderr',
  'stdout',
  'value',
]);

class SensitiveSchoolArtifactError extends Error {}
class UnsafeSchoolArtifactError extends SensitiveSchoolArtifactError {}

const CREDENTIAL_PATTERNS = [
  {
    type: 'bearer',
    pattern: /(\bBearer[ \t]+)([A-Za-z0-9][A-Za-z0-9._~+\/-]{15,}={0,2})(?=[^A-Za-z0-9._~+\/-]|$)/g,
    preserveSuffix: false,
  },
  {
    type: 'next-auth-cookie',
    pattern: /((?:__Secure-|__Host-)?(?:next-auth|authjs)\.(?:session-token(?:\.\d+)?|csrf-token)=)([A-Za-z0-9][A-Za-z0-9._~+\/%|=-]{15,})(?=[^A-Za-z0-9._~+\/%|=-]|$)/g,
    preserveSuffix: false,
  },
  {
    type: 'next-auth-cookie',
    pattern: /("name"\s*:\s*"(?:__Secure-|__Host-)?(?:next-auth|authjs)\.(?:session-token(?:\.\d+)?|csrf-token)"\s*,\s*"value"\s*:\s*")([A-Za-z0-9][A-Za-z0-9._~+\/%|=-]{15,})(")/g,
    preserveSuffix: true,
  },
  {
    type: 'access-token',
    pattern: /((?:\\*)"accessToken(?:\\*)"\s*:\s*(?:\\*)")([A-Za-z0-9][A-Za-z0-9._~+\/%=-]{15,})((?:\\*)")/g,
    preserveSuffix: true,
  },
  {
    type: 'csrf-token',
    pattern: /((?:\\*)"csrfToken(?:\\*)"\s*:\s*(?:\\*)")([A-Za-z0-9][A-Za-z0-9._~+\/%|=-]{15,})((?:\\*)")/g,
    preserveSuffix: true,
  },
];

function decodeTextCandidate(buffer) {
  try {
    const text = UTF8_DECODER.decode(buffer);
    return BINARY_CONTROL_CHARACTERS.test(text) ? null : text;
  } catch {
    return null;
  }
}

function redactCredentials(text) {
  let redacted = text;
  let count = 0;
  for (const { pattern, preserveSuffix } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, (_match, prefix, _credential, suffix) => {
      count += 1;
      return `${prefix}${REDACTED}${preserveSuffix ? suffix : ''}`;
    });
  }
  return { text: redacted, count };
}

function credentialLeakSummary(text) {
  const leaks = [];
  for (const { type, pattern } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches?.length) leaks.push({ type, count: matches.length });
  }
  return leaks;
}

function normalizedKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function redactPersonalDataValue(value, key = '') {
  if (PERSONAL_DATA_KEYS.has(normalizedKey(key))) {
    if (value === REDACTED) return { value, count: 0 };
    return { value: REDACTED, count: 1 };
  }
  if (Array.isArray(value)) {
    let count = 0;
    const redacted = value.map((entry) => {
      const result = redactPersonalDataValue(entry);
      count += result.count;
      return result.value;
    });
    return { value: redacted, count };
  }
  if (value && typeof value === 'object') {
    let count = 0;
    const redacted = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const result = redactPersonalDataValue(entryValue, entryKey);
      redacted[entryKey] = result.value;
      count += result.count;
    }
    return { value: redacted, count };
  }
  if (typeof value !== 'string') return { value, count: 0 };

  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const nested = redactPersonalDataValue(JSON.parse(value));
      if (nested.count > 0) {
        return { value: JSON.stringify(nested.value), count: nested.count };
      }
    } catch {
      // Some trace strings resemble JSON but are ordinary log text.
    }
  }
  EMAIL_PATTERN.lastIndex = 0;
  let count = 0;
  const redacted = value.replace(EMAIL_PATTERN, () => {
    count += 1;
    return REDACTED;
  });
  return { value: redacted, count };
}

function redactPersonalData(text) {
  try {
    const document = redactPersonalDataValue(JSON.parse(text));
    if (document.count > 0) {
      return { text: JSON.stringify(document.value), count: document.count };
    }
    return { text, count: 0 };
  } catch {
    // Playwright traces are commonly JSONL rather than one JSON document.
  }

  const lines = text.split('\n');
  let count = 0;
  const redactedLines = lines.map((line) => {
    try {
      const result = redactPersonalDataValue(JSON.parse(line));
      count += result.count;
      return result.count > 0 ? JSON.stringify(result.value) : line;
    } catch {
      EMAIL_PATTERN.lastIndex = 0;
      return line.replace(EMAIL_PATTERN, () => {
        count += 1;
        return REDACTED;
      });
    }
  });
  return { text: redactedLines.join('\n'), count };
}

function personalDataLeakSummary(text) {
  const { count } = redactPersonalData(text);
  return count > 0 ? [{ type: 'personal-data', count }] : [];
}

function sanitizeText(text) {
  const personalData = redactPersonalData(text);
  const credentials = redactCredentials(personalData.text);
  return {
    text: credentials.text,
    count: personalData.count + credentials.count,
  };
}

async function walkRegularFiles(root) {
  const files = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkRegularFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function archiveFiles(root) {
  const files = await walkRegularFiles(root);
  const candidates = [];
  for (const filePath of files) {
    const buffer = await readFile(filePath);
    candidates.push({ filePath, buffer, text: decodeTextCandidate(buffer) });
  }
  return candidates;
}

function fileSensitiveLeaks({ buffer, text }, filePath, root) {
  const binary = text === null;
  const candidate = binary ? buffer.toString('latin1') : text;
  const leaks = [
    ...credentialLeakSummary(candidate),
    ...personalDataLeakSummary(candidate),
  ];
  return leaks.map((leak) => ({
    file: path.relative(root, filePath),
    type: binary ? `binary-${leak.type}` : leak.type,
    count: leak.count,
  }));
}

async function validateArchiveEntries(zipPath) {
  const { stdout } = await execFileAsync(UNZIP, ['-Z1', zipPath]);
  for (const entry of stdout.split('\n').filter(Boolean)) {
    const normalized = path.posix.normalize(entry.replaceAll('\\', '/'));
    if (
      path.posix.isAbsolute(normalized)
      || normalized === '..'
      || normalized.startsWith('../')
    ) {
      throw new UnsafeSchoolArtifactError(`Unsafe archive entry in ${path.basename(zipPath)}`);
    }
  }
}

async function extractTraceZip(zipPath) {
  await validateArchiveEntries(zipPath);
  const extractionDir = await mkdtemp(path.join(tmpdir(), 'zidd-school-trace-'));
  try {
    await execFileAsync(UNZIP, ['-q', zipPath, '-d', extractionDir]);
    return extractionDir;
  } catch (error) {
    await rm(extractionDir, { recursive: true, force: true });
    throw error;
  }
}

async function scanExtractedTrace(root) {
  const leaks = [];
  for (const file of await archiveFiles(root)) {
    leaks.push(...fileSensitiveLeaks(file, file.filePath, root));
  }
  return leaks;
}

function assertNoSensitiveLeaks(leaks, artifactPath) {
  if (!leaks.length) return;
  const summary = leaks
    .map(({ file, type, count }) => `${file}: ${type} (${count})`)
    .join(', ');
  const ErrorType = leaks.some(({ type }) => type.startsWith('binary-'))
    ? UnsafeSchoolArtifactError
    : SensitiveSchoolArtifactError;
  throw new ErrorType(
    `Sensitive data scan failed for ${path.basename(artifactPath)}: ${summary}`,
  );
}

async function unlinkIfPresent(filePath) {
  await unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

export async function scanTraceZip(zipPath) {
  const resolvedZipPath = path.resolve(zipPath);
  const extractionDir = await extractTraceZip(resolvedZipPath);
  try {
    return await scanExtractedTrace(extractionDir);
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
}

export async function sanitizeTraceZip(zipPath) {
  const resolvedZipPath = path.resolve(zipPath);
  const zipStat = await stat(resolvedZipPath);
  if (!zipStat.isFile()) throw new Error(`Trace zip is not a file: ${resolvedZipPath}`);

  let extractionDir = null;
  const temporaryZip = path.join(
    path.dirname(resolvedZipPath),
    `.${path.basename(resolvedZipPath)}.${process.pid}.${Date.now()}.tmp.zip`,
  );

  try {
    extractionDir = await extractTraceZip(resolvedZipPath);
    const files = await archiveFiles(extractionDir);
    const binaryLeaks = files
      .filter(({ text }) => text === null)
      .flatMap((file) => fileSensitiveLeaks(file, file.filePath, extractionDir));
    assertNoSensitiveLeaks(binaryLeaks, resolvedZipPath);

    let redactionCount = 0;
    for (const { filePath, text } of files) {
      if (text === null) continue;
      const sanitized = sanitizeText(text);
      if (sanitized.count > 0) {
        await writeFile(filePath, sanitized.text);
        redactionCount += sanitized.count;
      }
    }

    assertNoSensitiveLeaks(await scanExtractedTrace(extractionDir), resolvedZipPath);
    await execFileAsync(ZIP, ['-q', '-r', temporaryZip, '.'], { cwd: extractionDir });
    assertNoSensitiveLeaks(await scanTraceZip(temporaryZip), resolvedZipPath);
    await rename(temporaryZip, resolvedZipPath);
    return { zipPath: resolvedZipPath, redactionCount };
  } catch (error) {
    if (error instanceof UnsafeSchoolArtifactError) {
      await unlinkIfPresent(resolvedZipPath);
    }
    throw error;
  } finally {
    if (extractionDir) await rm(extractionDir, { recursive: true, force: true });
    await unlinkIfPresent(temporaryZip);
  }
}

async function findTraceZips(root) {
  const rootStat = await stat(root).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!rootStat) return [];
  const files = await walkRegularFiles(root);
  return files.filter((filePath) => path.basename(filePath) === 'trace.zip').sort();
}

export async function sanitizeSchoolTraceArtifacts(root = DEFAULT_TRACE_ROOT) {
  const resolvedRoot = path.resolve(root);
  const rootStat = await stat(resolvedRoot).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!rootStat) return [];
  if (!rootStat.isDirectory()) throw new Error(`School artifact root is not a directory: ${resolvedRoot}`);

  const results = [];
  for (const zipPath of await findTraceZips(resolvedRoot)) {
    results.push(await sanitizeTraceZip(zipPath));
  }
  for (const filePath of await walkRegularFiles(resolvedRoot)) {
    if (path.basename(filePath) === 'trace.zip') continue;
    const buffer = await readFile(filePath);
    const text = decodeTextCandidate(buffer);
    if (text === null) {
      try {
        assertNoSensitiveLeaks(
          fileSensitiveLeaks({ buffer, text }, filePath, resolvedRoot),
          filePath,
        );
      } catch (error) {
        if (error instanceof UnsafeSchoolArtifactError) await unlinkIfPresent(filePath);
        throw error;
      }
      continue;
    }
    const sanitized = sanitizeText(text);
    if (sanitized.count > 0) await writeFile(filePath, sanitized.text);
    assertNoSensitiveLeaks(
      fileSensitiveLeaks({ buffer: Buffer.from(sanitized.text), text: sanitized.text }, filePath, resolvedRoot),
      filePath,
    );
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === '--check';
  const requestedPaths = checkOnly ? args.slice(1) : args;
  const zipPaths = requestedPaths.length
    ? requestedPaths.map((zipPath) => path.resolve(zipPath))
    : await findTraceZips(DEFAULT_TRACE_ROOT);

  if (!zipPaths.length) throw new Error(`No School trace.zip artifacts found under ${DEFAULT_TRACE_ROOT}`);

  for (const zipPath of zipPaths) {
    if (checkOnly) {
      try {
        assertNoSensitiveLeaks(await scanTraceZip(zipPath), zipPath);
      } catch (error) {
        if (error instanceof UnsafeSchoolArtifactError) await unlinkIfPresent(zipPath);
        throw error;
      }
      process.stdout.write(`Sensitive data scan passed: ${zipPath}\n`);
    } else {
      const result = await sanitizeTraceZip(zipPath);
      process.stdout.write(
        `Sanitized ${result.zipPath}: ${result.redactionCount} sensitive value(s) redacted; scan passed\n`,
      );
    }
  }
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
