import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(
  process.env.ZIDD_BACKEND_ROOT || path.resolve(TEST_DIR, '../../Zidd-Backend'),
);
const configuredPython = process.env.ZIDD_BACKEND_PYTHON;
const BACKEND_PYTHON = configuredPython
  ? path.resolve(configuredPython)
  : path.join(BACKEND_ROOT, '.venv/bin/python');

function withoutTitles(value) {
  if (Array.isArray(value)) return value.map(withoutTitles);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'title')
      .map(([key, item]) => [key, withoutTitles(item)]),
  );
}

async function backendSchemas() {
  const source = [
    'import json',
    'from app.services.school_rebuild_profile import (',
    '    SchoolRebuildProfileIn,',
    '    SchoolOnboardingDraftPatchIn,',
    '    SchoolOnboardingCompleteIn,',
    ')',
    'print(json.dumps({',
    '    "profile": SchoolRebuildProfileIn.model_json_schema(),',
    '    "draft": SchoolOnboardingDraftPatchIn.model_json_schema(),',
    '    "complete": SchoolOnboardingCompleteIn.model_json_schema(),',
    '}, sort_keys=True))',
  ].join('\n');
  const { stdout } = await execFileAsync(BACKEND_PYTHON, ['-c', source], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, PYTHONPATH: BACKEND_ROOT },
  });
  return withoutTitles(JSON.parse(stdout));
}

const profileProperties = {
  display_name: { type: 'string', minLength: 2, maxLength: 120 },
  school_name: { type: 'string', minLength: 2, maxLength: 160 },
  board_id: { type: 'string', enum: ['cbse', 'ncert'], default: 'cbse' },
  target_class_no: { type: 'integer', minimum: 2, maximum: 5 },
  subject_ids: {
    type: 'array',
    minItems: 1,
    maxItems: 1,
    items: { type: 'string', const: 'english' },
  },
  preferred_teaching_language: { type: 'string', enum: ['en', 'hi', 'hi_en'] },
  english_comfort: { type: 'string', enum: ['low', 'medium', 'high'] },
  learner_goal: { type: 'string', maxLength: 360, default: '' },
  parent_goal: { type: 'string', maxLength: 360, default: '' },
  prior_difficulty_signals: {
    type: 'array',
    maxItems: 5,
    items: {
      type: 'string',
      enum: ['reading', 'vocabulary', 'grammar', 'writing', 'chapter_answers'],
    },
  },
};

const nullable = (schema) => ({
  anyOf: [schema, { type: 'null' }],
  default: null,
});

test('frontend School request contract matches complete backend Pydantic JSON schemas', async () => {
  const schemas = await backendSchemas();

  assert.deepEqual(schemas.profile, {
    type: 'object',
    additionalProperties: false,
    required: [
      'display_name',
      'school_name',
      'target_class_no',
      'preferred_teaching_language',
      'english_comfort',
    ],
    properties: profileProperties,
  });

  assert.deepEqual(schemas.draft, {
    type: 'object',
    additionalProperties: false,
    required: ['current_step', 'request_id'],
    properties: {
      display_name: nullable({ type: 'string', maxLength: 120 }),
      school_name: nullable({ type: 'string', maxLength: 160 }),
      board_id: nullable({ type: 'string', enum: ['cbse', 'ncert'] }),
      target_class_no: nullable({ type: 'integer', minimum: 2, maximum: 5 }),
      subject_ids: nullable({
        type: 'array',
        maxItems: 1,
        items: { type: 'string', const: 'english' },
      }),
      preferred_teaching_language: nullable({
        type: 'string',
        enum: ['en', 'hi', 'hi_en'],
      }),
      english_comfort: nullable({
        type: 'string',
        enum: ['low', 'medium', 'high'],
      }),
      learner_goal: nullable({ type: 'string', maxLength: 360 }),
      parent_goal: nullable({ type: 'string', maxLength: 360 }),
      prior_difficulty_signals: nullable({
        type: 'array',
        maxItems: 5,
        items: {
          type: 'string',
          enum: ['reading', 'vocabulary', 'grammar', 'writing', 'chapter_answers'],
        },
      }),
      current_step: { type: 'integer', minimum: 0, maximum: 4 },
      request_id: { type: 'string', format: 'uuid' },
      profile_version_id: nullable({ type: 'string', format: 'uuid' }),
      expected_revision: nullable({ type: 'integer', minimum: 1 }),
    },
  });

  assert.deepEqual(schemas.complete, {
    type: 'object',
    additionalProperties: false,
    required: ['profile_version_id', 'expected_revision', 'request_id'],
    properties: {
      profile_version_id: { type: 'string', format: 'uuid' },
      expected_revision: { type: 'integer', minimum: 1 },
      request_id: { type: 'string', format: 'uuid' },
    },
  });
});
