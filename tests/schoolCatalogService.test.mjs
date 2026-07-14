import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/services/schoolRebuild.ts', 'utf8');

test('school catalog client exposes the hierarchy endpoints', () => {
  assert.match(source, /export async function getSchoolCatalog/);
  assert.match(source, /schoolReadFetch\('\/school\/catalog'\)/);
  assert.match(source, /export async function getSchoolClassMap/);
  assert.match(source, /`\/school\/catalog\/\$\{subjectId\}\/classes\/\$\{classNo\}`/);
  assert.match(source, /export async function getSchoolChapterMap/);
  assert.match(source, /`\/school\/catalog\/\$\{subjectId\}\/classes\/\$\{classNo\}\/chapters\/\$\{chapterId\}`/);
});

test('only evaluator answer requests can become unbounded in local School mode', () => {
  assert.match(source, /const schoolReadFetch[\s\S]*?timeoutMs: SCHOOL_READ_TIMEOUT_MS/);
  assert.match(source, /const schoolControlFetch[\s\S]*?timeoutMs: SCHOOL_CONTROL_TIMEOUT_MS/);
  assert.match(
    source,
    /const schoolEvaluatorFetch[\s\S]*?SCHOOL_LOCAL_EVALUATOR_UNBOUNDED[\s\S]*?null[\s\S]*?SCHOOL_CLOUD_EVALUATOR_TIMEOUT_MS/,
  );

  for (const answerFunction of [
    'answerSchoolPlacement',
    'answerSchoolRecap',
    'answerSchoolCurriculum',
    'answerSchoolMasterclass',
  ]) {
    assert.match(
      source,
      new RegExp(`export async function ${answerFunction}[\\s\\S]*?schoolEvaluatorFetch\\(`),
      `${answerFunction} must use the evaluator-only timeout policy`,
    );
  }

  for (const controlFunction of [
    'saveSchoolOnboarding',
    'activateSchoolOnboarding',
    'startSchoolPlacement',
    'abandonSchoolPlacement',
    'startSchoolRecap',
    'startSchoolCurriculum',
    'startSchoolCurriculumMasterclass',
    'resumeSchoolCurriculumMasterclass',
    'abandonSchoolCurriculumMasterclass',
  ]) {
    assert.match(
      source,
      new RegExp(`export async function ${controlFunction}[\\s\\S]*?schoolControlFetch\\(`),
      `${controlFunction} must have a finite control deadline`,
    );
  }

  assert.doesNotMatch(source, /const schoolApiFetch/);
});

test('disabled School state is separated from the complete state consumed by routes', () => {
  assert.match(source, /export interface SchoolUnavailableState/);
  assert.match(source, /export type SchoolStateResponse = SchoolState \| SchoolUnavailableState/);
  assert.match(source, /export async function getSchoolStateResponse/);
  assert.match(source, /if \(state\.available === false\) throw new Error\('school_unavailable'\)/);
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
