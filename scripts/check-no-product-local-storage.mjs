import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'src');
const allowed = new Set([
  'src/services/api.ts',
]);
const activationRecoveryUsage = {
  file: 'src/components/school/onboarding/SchoolOnboardingWizard.tsx',
  line: 'recoveryStore: createSchoolActivationRecoveryStore(window.sessionStorage),',
};
let activationRecoveryUsageCount = 0;

const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(name)) continue;
    const rel = relative(process.cwd(), path);
    if (allowed.has(rel)) continue;
    const text = readFileSync(path, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/\b(localStorage|sessionStorage)\b|zidd_/.test(line)) {
        if (rel === activationRecoveryUsage.file && line.trim() === activationRecoveryUsage.line) {
          activationRecoveryUsageCount += 1;
          return;
        }
        hits.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(root);

if (activationRecoveryUsageCount !== 1) {
  hits.push(`Expected exactly one School activation recovery storage usage; found ${activationRecoveryUsageCount}`);
}

if (hits.length) {
  console.error('Product state must not use browser storage or zidd_* keys:');
  console.error(hits.join('\n'));
  process.exit(1);
}
