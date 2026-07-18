import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  SCHOOL_STAGE_ORDER,
  aggregateSchoolStageStatus,
  buildSchoolLevelStages,
} from '../src/components/school/catalog/schoolLevelStages.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const component = read('src/components/school/catalog/SchoolLevelMap.tsx');
const route = read('src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx');

test('chapter page loads its learner-safe map and starts the requested chapter idempotently', () => {
  assert.match(route, /getSchoolChapterMap/);
  assert.match(route, /startSchoolCurriculum/);
  assert.match(route, /clientStartIdRef/);
  assert.match(route, /crypto\.randomUUID\(\)/);
  assert.match(route, /getSchoolState\({ force: true }\)/);
  assert.match(route, /resolveSchoolStateDestination/);
  assert.match(route, /router\.replace\(destination\)/);
  assert.match(route, /<SchoolLevelMapSkeleton/);
  assert.match(route, /<SchoolLevelMap/);
  assert.match(route, /createSchoolRouteLoadSingleFlight/);
  assert.match(route, /schoolRouteLoadDisposition/);
  assert.match(route, /chapterMapLoadSingleFlight\.run/);
});

test('level map presents only the five learner-facing stages', () => {
  for (const label of [
    'Discover',
    'Practise Together',
    'Try It Yourself',
    'Use It Somewhere New',
    'Chapter Challenge',
  ]) {
    assert.match(component, new RegExp(label));
  }
  for (const engineTerm of ['guided_check', 'bridge', 'transfer_check', 'certification', 'EMA']) {
    assert.equal(component.includes(engineTerm), false, `level map exposes ${engineTerm}`);
  }
  assert.doesNotMatch(component, /from '@\/components\/learning\/JourneyMap'/);
  assert.doesNotMatch(component, /<JourneyMap/);
  assert.match(component, /SchoolPathMap\.module\.css/);
  assert.match(component, /buildSchoolWindingPath/);
  assert.match(component, /getSchoolPathAvatar/);
  assert.match(component, /schoolPathMetrics/);
  assert.match(component, /<svg/);
  assert.equal((component.match(/<Image\b/g) ?? []).length, 1);
  assert.match(component, /getSchoolAvatarTheme/);
  assert.match(component, /getAvatarScaleClass/);
  assert.match(component, /width=\{250\}/);
  assert.match(component, /height=\{300\}/);
  assert.doesNotMatch(component, /sm:grid-cols-5|absolute bottom-10 left-\[37px\]/);
  assert.doesNotMatch(component, /Math\.random|unoptimized/);
  assert.match(component, /const showStateBadge = \['complete', 'locked', 'needs_support'\]\.includes\(stage\.status\)/);
  assert.doesNotMatch(component, /lucide-react|font-black|gradient/i);

  const stages = buildSchoolLevelStages(
    [
      { level_id: 'discover', learner_stage: 'Discover', title: 'Meet the idea', status: 'complete' },
      { level_id: 'practise-1', learner_stage: 'Practise Together', title: 'First guided practice', status: 'complete' },
      { level_id: 'practise-2', learner_stage: 'Practise Together', title: 'Current guided practice', status: 'active' },
      { level_id: 'independent', learner_stage: 'Try It Yourself', title: 'Independent practice', status: 'locked' },
      { level_id: 'transfer', learner_stage: 'Use It Somewhere New', title: 'Fresh situation', status: 'locked' },
    ],
    { title: 'Chapter check', status: 'locked' },
    'chapter-1',
  );

  assert.equal(stages.length, 5);
  assert.deepEqual(stages.map((stage) => stage.label), [...SCHOOL_STAGE_ORDER, 'Chapter Challenge']);
  assert.deepEqual(stages[1].authoredLevelIds, ['practise-1', 'practise-2']);
  assert.equal(stages[1].status, 'active');
  assert.equal(stages[1].title, 'Current guided practice');
  assert.equal(stages[2].interactive, false);
  assert.equal(aggregateSchoolStageStatus([{ status: 'active' }, { status: 'needs_support' }]), 'needs_support');
  assert.equal(aggregateSchoolStageStatus([{ status: 'ready' }, { status: 'active' }]), 'active');
  assert.equal(aggregateSchoolStageStatus([{ status: 'complete' }, { status: 'complete' }]), 'complete');
  assert.equal(aggregateSchoolStageStatus([{ status: 'complete' }, { status: 'locked' }]), 'locked');
  assert.equal(aggregateSchoolStageStatus([{ status: 'complete' }, { status: 'ready' }]), 'ready');
});

test('level statuses remain descriptive while actions require explicit state authority', () => {
  assert.match(component, /isCurrent && stage\.status !== 'locked'/);
  assert.match(component, /aria-current=/);
  assert.doesNotMatch(component, /onOpenSupport/);
  assert.match(component, /disabled={busy/);
  assert.match(component, /Starting chapter/);
});

test('direct chapter maps remain browseable while actions retain exact School state authority', () => {
  assert.match(route, /resolveSchoolMapDestination/);
  assert.doesNotMatch(route, /destination !== `\/school\/classes\/\$\{classNo\}\/chapters\/\$\{chapterId\}`/);
  assert.match(route, /snapshot\?\.stateAction\?\.action === 'start_curriculum'/);
  assert.match(route, /snapshot\.chapter\.active_session_id === snapshot\.activeSessionId/);
});
