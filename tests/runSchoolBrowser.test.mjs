import assert from 'node:assert/strict';
import test from 'node:test';

import { runSchoolBrowser } from '../scripts/run-school-browser.mjs';

test('sanitizes produced traces after Playwright fails and preserves its failure', async () => {
  const playwrightFailure = Object.assign(new Error('synthetic Playwright failure'), {
    exitCode: 7,
  });
  let sanitizerCalled = false;

  await assert.rejects(
    runSchoolBrowser({
      runPlaywright: async () => {
        throw playwrightFailure;
      },
      sanitizeTraces: async () => {
        sanitizerCalled = true;
        return ['trace.zip'];
      },
    }),
    (error) => error === playwrightFailure,
  );
  assert.equal(sanitizerCalled, true);
});

test('preserves Playwright failure when sanitization also fails', async () => {
  const playwrightFailure = Object.assign(new Error('synthetic Playwright failure'), {
    exitCode: 9,
  });
  const sanitizerFailure = new Error('synthetic sanitizer failure');
  const reportedFailures = [];

  await assert.rejects(
    runSchoolBrowser({
      runPlaywright: async () => {
        throw playwrightFailure;
      },
      sanitizeTraces: async () => {
        throw sanitizerFailure;
      },
      reportSanitizerFailure: (error) => reportedFailures.push(error),
    }),
    (error) => error === playwrightFailure,
  );
  assert.deepEqual(reportedFailures, [sanitizerFailure]);
});

test('fails with the sanitizer result when Playwright succeeds', async () => {
  const sanitizerFailure = Object.assign(new Error('synthetic sanitizer failure'), {
    exitCode: 1,
  });

  await assert.rejects(
    runSchoolBrowser({
      runPlaywright: async () => {},
      sanitizeTraces: async () => {
        throw sanitizerFailure;
      },
    }),
    (error) => error === sanitizerFailure,
  );
});

test('fails when Playwright succeeds without producing a required trace', async () => {
  await assert.rejects(
    runSchoolBrowser({
      runPlaywright: async () => {},
      sanitizeTraces: async () => [],
    }),
    /School Playwright produced no required trace\.zip artifact/,
  );
});

test('preserves Playwright failure when no trace artifact was produced', async () => {
  const playwrightFailure = Object.assign(new Error('synthetic Playwright failure'), {
    exitCode: 11,
  });

  await assert.rejects(
    runSchoolBrowser({
      runPlaywright: async () => {
        throw playwrightFailure;
      },
      sanitizeTraces: async () => [],
    }),
    (error) => error === playwrightFailure,
  );
});
