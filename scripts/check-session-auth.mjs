import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const apiSource = readFileSync(path.join(root, 'src/services/api.ts'), 'utf8');
const hookSource = readFileSync(path.join(root, 'src/hooks/useZiddSession.ts'), 'utf8');

const failures = [];

if (!/export\s+async\s+function\s+getAuthHeaders/.test(apiSource)) {
  failures.push('src/services/api.ts must export getAuthHeaders() as the shared backend-JWT header helper.');
}

if (!/import\s*\{[^}]*getAuthHeaders[^}]*\}\s*from\s*['"](?:\.\.\/services\/api|@\/services\/api)['"]/.test(hookSource)) {
  failures.push('useZiddSession.ts must import getAuthHeaders() from the shared API auth module.');
}

if (/localStorage\.getItem\(\s*['"]zidd_token['"]\s*\)/.test(hookSource)) {
  failures.push('useZiddSession.ts must not read localStorage.zidd_token for session ownership calls.');
}

const authHeaderCalls = hookSource.match(/await\s+getAuthHeaders\(\)/g) ?? [];
if (authHeaderCalls.length < 3) {
  failures.push('useZiddSession.ts must use getAuthHeaders() for stream, transcript bootstrap, and end-session calls.');
}

if (
  !/bootstrappedSessionRef/.test(hookSource) ||
  !/bootstrappedSessionRef\.current\s*===\s*sessionId/.test(hookSource) ||
  !/bootstrappedSessionRef\.current\s*=\s*sessionId/.test(hookSource)
) {
  failures.push('useZiddSession.ts must guard bootstrap per session id to prevent duplicate opening streams.');
}

if (failures.length > 0) {
  console.error('Session auth regression check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Session auth regression check passed.');
