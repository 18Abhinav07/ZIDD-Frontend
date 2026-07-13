import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/services/schoolRebuild.ts', 'utf8');

test('school catalog client exposes the hierarchy endpoints', () => {
  assert.match(source, /export async function getSchoolCatalog/);
  assert.match(source, /schoolApiFetch\('\/school\/catalog'\)/);
  assert.match(source, /export async function getSchoolClassMap/);
  assert.match(source, /`\/school\/catalog\/\$\{subjectId\}\/classes\/\$\{classNo\}`/);
  assert.match(source, /export async function getSchoolChapterMap/);
  assert.match(source, /`\/school\/catalog\/\$\{subjectId\}\/classes\/\$\{classNo\}\/chapters\/\$\{chapterId\}`/);
});

test('curriculum start is explicit and idempotent', () => {
  assert.equal(source.includes('export function startSchoolCurriculum()'), false);
  assert.match(source, /chapterId: string/);
  assert.match(source, /clientStartId: string/);
  assert.match(source, /chapter_id: chapterId/);
  assert.match(source, /client_start_id: clientStartId/);
});

test('catalog types use only learner-visible progression states', () => {
  assert.match(source, /SchoolMapStatus = 'complete' \| 'active' \| 'ready' \| 'locked' \| 'needs_support'/);
  for (const hiddenField of ['answer_key:', 'accepted_answers:', 'model_answer:', 'rubric:']) {
    assert.equal(source.includes(hiddenField), false, `public service type exposes ${hiddenField}`);
  }
});

test('school state cache is auth-scoped, generation-aware, and shares forced reads', () => {
  assert.match(source, /SchoolStateRequestCache/);
  assert.match(source, /stateRequestCache\.get/);
  assert.match(source, /stateRequestCache\.invalidate\(\)/);
  assert.doesNotMatch(source, /getSchoolPlacementReport[\s\S]{0,180}invalidateSchoolRebuildCache/);
});
