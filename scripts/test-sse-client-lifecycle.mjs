#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/sseClient.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'src/services/sseClient.ts',
  reportDiagnostics: true,
});
const compileErrors = (compiled.diagnostics || []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
);
assert.deepEqual(compileErrors, [], 'sseClient.ts must transpile without syntax errors');

const loadedModule = { exports: {} };
new Function('module', 'exports', compiled.outputText)(loadedModule, loadedModule.exports);
const { ZiddSSEClient } = loadedModule.exports;
assert.equal(typeof ZiddSSEClient, 'function', 'compiled module must export ZiddSSEClient');

async function exercise(fetchImplementation) {
  const originalFetch = globalThis.fetch;
  const opened = [];
  const events = [];
  const errors = [];
  const completions = [];

  globalThis.fetch = fetchImplementation;
  try {
    const client = new ZiddSSEClient('/test-stream', {
      onOpen: () => opened.push(true),
      onEvent: (eventName, data) => events.push({ eventName, data }),
      onError: (error) => errors.push(error),
      onComplete: (info) => completions.push(info),
      idleTimeoutMs: 1_000,
      startupTimeoutMs: 1_000,
    });
    await client.connect();
  } finally {
    globalThis.fetch = originalFetch;
  }

  return { opened, events, errors, completions };
}

test('post-open reader failure reports error and completes exactly once without done', async () => {
  const networkError = new Error('reader network failure');
  const result = await exercise(async () => ({
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          throw networkError;
        },
      }),
    },
  }));

  assert.equal(result.opened.length, 1);
  assert.deepEqual(result.errors, [networkError]);
  assert.deepEqual(result.completions, [{ doneSeen: false }]);
});

test('pre-open HTTP 409 reports error without completing the stream', async () => {
  const result = await exercise(async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      detail: {
        code: 'turn_in_progress',
        message: 'That turn is already being processed.',
      },
    }),
  }));

  assert.equal(result.opened.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].status, 409);
  assert.equal(result.errors[0].code, 'turn_in_progress');
  assert.deepEqual(result.completions, []);
});

test('clean EOF after done completes exactly once', async () => {
  const encodedDone = new TextEncoder().encode('event: done\ndata: {"state":"complete"}\n\n');
  let reads = 0;
  const result = await exercise(async () => ({
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          reads += 1;
          return reads === 1
            ? { done: false, value: encodedDone }
            : { done: true, value: undefined };
        },
      }),
    },
  }));

  assert.equal(result.opened.length, 1);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.events, [{ eventName: 'done', data: { state: 'complete' } }]);
  assert.deepEqual(result.completions, [{ doneSeen: true }]);
});
