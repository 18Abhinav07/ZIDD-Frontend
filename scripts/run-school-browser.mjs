import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { sanitizeSchoolTraceArtifacts } from './sanitize-school-traces.mjs';

const require = createRequire(import.meta.url);
const PLAYWRIGHT_CLI = require.resolve('@playwright/test/cli');
const DEFAULT_CONFIG = 'playwright.school.config.ts';
const ALLOWED_CONFIGS = new Set([
  DEFAULT_CONFIG,
  'playwright.school-phase-b.config.ts',
]);

function runPlaywrightProcess(configPath = DEFAULT_CONFIG) {
  if (!ALLOWED_CONFIGS.has(configPath)) {
    throw new Error(`Unsupported School Playwright config: ${configPath}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', `--config=${configPath}`],
      { cwd: process.cwd(), stdio: 'inherit' },
    );

    child.once('error', reject);
    child.once('exit', (exitCode, signal) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      const failure = new Error(
        signal
          ? `School Playwright exited from signal ${signal}`
          : `School Playwright exited with code ${exitCode ?? 1}`,
      );
      failure.exitCode = exitCode ?? 1;
      failure.signal = signal;
      reject(failure);
    });
  });
}

function reportAdditionalSanitizerFailure(error) {
  process.stderr.write(`School trace sanitization also failed: ${error.message}\n`);
}

export async function runSchoolBrowser({
  runPlaywright = runPlaywrightProcess,
  sanitizeTraces = sanitizeSchoolTraceArtifacts,
  reportSanitizerFailure = reportAdditionalSanitizerFailure,
  configPath = DEFAULT_CONFIG,
} = {}) {
  let playwrightFailure = null;
  let sanitizerFailure = null;
  let sanitizedTraceZips = [];

  try {
    await runPlaywright(configPath);
  } catch (error) {
    playwrightFailure = error;
  } finally {
    try {
      const results = await sanitizeTraces();
      sanitizedTraceZips = results.map((result) => result.zipPath ?? result);
    } catch (error) {
      sanitizerFailure = error;
      if (playwrightFailure) reportSanitizerFailure(error);
    }
  }

  if (playwrightFailure) throw playwrightFailure;
  if (sanitizerFailure) throw sanitizerFailure;
  if (sanitizedTraceZips.length === 0) {
    const missingTraceFailure = new Error(
      'School Playwright produced no required trace.zip artifact',
    );
    missingTraceFailure.exitCode = 1;
    throw missingTraceFailure;
  }
  return { sanitizedTraceZips };
}

function failureExitCode(error) {
  return Number.isInteger(error.exitCode) && error.exitCode > 0
    ? error.exitCode
    : 1;
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const configArgument = process.argv.slice(2).find((argument) => argument.startsWith('--config='));
  const configPath = configArgument?.slice('--config='.length) || DEFAULT_CONFIG;
  runSchoolBrowser({ configPath }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = failureExitCode(error);
  });
}
