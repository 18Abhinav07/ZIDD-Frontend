import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');
const component = read('src/components/school/catalog/SchoolChapterMap.tsx');
const route = read('src/app/school/classes/[classNo]/page.tsx');

test('class page loads the active backend class map and fails closed on mismatch', () => {
  assert.match(route, /getSchoolState/);
  assert.match(route, /getSchoolClassMap/);
  assert.match(route, /school_catalog_profile_mismatch/);
  assert.match(route, /<SchoolMapSkeleton/);
  assert.match(route, /<SchoolChapterMap/);
});

test('chapter map renders every backend chapter on the canonical winding avatar path', () => {
  assert.doesNotMatch(component, /from '@\/components\/learning\/JourneyMap'/);
  assert.doesNotMatch(component, /<JourneyMap/);
  assert.match(component, /Your class journey/);
  assert.match(component, /<SchoolPageHeading/);
  assert.match(component, /SchoolPathMap\.module\.css/);
  assert.match(component, /buildSchoolWindingPath/);
  assert.match(component, /getSchoolPathAvatar/);
  assert.match(component, /schoolPathMetrics/);
  assert.match(component, /<svg/);
  assert.match(component, /schoolClass\.chapters\.map/);
  assert.doesNotMatch(component, /<SchoolDisclosure|function ChapterRow/);
  assert.match(component, /activeChapter/);
  assert.equal((component.match(/<Image\b/g) ?? []).length, 1);
  for (const state of ['complete', 'active', 'ready', 'locked', 'needs_support']) {
    assert.match(component, new RegExp(`'${state}'`));
  }
  assert.match(component, /Change class or subject/);
  assert.match(component, /completed_levels/);
  assert.match(component, /total_levels/);
});

test('chapter map uses deterministic optimized decorative avatars', () => {
  assert.match(component, /getSchoolPathAvatar\(chapter\.chapter_id\)/);
  assert.match(component, /getAvatarScaleClass/);
  assert.match(component, /width=\{250\}/);
  assert.match(component, /height=\{300\}/);
  assert.doesNotMatch(component, /Math\.random|unoptimized/);
  assert.match(component, /const showStateBadge = \['complete', 'locked', 'needs_support'\]\.includes\(chapter\.status\)/);
});

test('class route owns one StrictMode-safe map load at a time', () => {
  assert.match(route, /createSchoolRouteLoadSingleFlight/);
  assert.match(route, /schoolRouteLoadDisposition/);
  assert.match(route, /classMapLoadSingleFlight\.run/);
});

test('chapter statuses are descriptive and only an explicit state-authorized chapter is actionable', () => {
  assert.match(component, /const action = authorizedAction\?\.chapterId === chapter\.chapter_id/);
  assert.match(component, /chapter\.status !== 'locked'/);
  assert.match(component, /\{action \? \(/);
  assert.match(component, /disabled={action\.busy}/);
  assert.match(component, /aria-current=/);
  assert.doesNotMatch(component, /onOpenChapter/);
  assert.doesNotMatch(component, /lucide-react|font-black|gradient/i);
});
