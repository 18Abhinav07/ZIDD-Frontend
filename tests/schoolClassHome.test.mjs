import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  shouldRenderUnlockedSchoolHome,
  schoolHomeActionLabel,
} from '../src/lib/schoolHomePolicy.mjs';

const home = fs.readFileSync('src/components/school/catalog/SchoolClassHome.tsx', 'utf8');
const skeletons = fs.readFileSync('src/components/learning/LearningSkeletons.tsx', 'utf8');
const chapterMap = fs.readFileSync('src/components/school/catalog/SchoolChapterMap.tsx', 'utf8');
const levelMap = fs.readFileSync('src/components/school/catalog/SchoolLevelMap.tsx', 'utf8');
const journeyMap = fs.readFileSync('src/components/learning/JourneyMap.tsx', 'utf8');
const schoolHomePage = fs.readFileSync('src/app/school/page.tsx', 'utf8');
const classPage = fs.readFileSync('src/app/school/classes/[classNo]/page.tsx', 'utf8');
const chapterPage = fs.readFileSync('src/app/school/classes/[classNo]/chapters/[chapterId]/page.tsx', 'utf8');

test('unlocked learners keep a real Home surface with an authorized continuation', () => {
  assert.equal(shouldRenderUnlockedSchoolHome({
    unlock_state: 'target_unlocked',
    subject_id: 'english',
    active_learning_class_no: 5,
    target_class_no: 5,
  }), true);
  assert.equal(shouldRenderUnlockedSchoolHome({
    unlock_state: 'recap_required',
    subject_id: 'english',
    active_learning_class_no: 4,
    target_class_no: 5,
  }), false);
  assert.equal(schoolHomeActionLabel('resume_curriculum'), 'Continue my chapter');
  assert.equal(schoolHomeActionLabel('resume_support'), 'Continue focused support');
  assert.match(schoolHomePage, /shouldRenderUnlockedSchoolHome/);
  assert.match(schoolHomePage, /schoolHomeActionLabel/);
  assert.doesNotMatch(schoolHomePage, /primaryAction=\{undefined\}/);
});

test('active class home uses the shared editorial system and real class context', () => {
  for (const token of ['Your English class', 'primaryAction.label', 'View class journey', 'Change class or subject', 'Recent growth', 'recent_growth']) {
    assert.match(home, new RegExp(token));
  }
  assert.match(home, /<SchoolPageHeading/);
  assert.match(home, /SchoolPathMap\.module\.css/);
  assert.match(home, /styles\.homeHero/);
  assert.doesNotMatch(home, /styles\.homeCoach/);
  assert.doesNotMatch(home, /Your coach|Ready when you are/);
  assert.match(home, /styles\.homeThread/);
  assert.match(home, /schoolPrimaryActionClass/);
  assert.match(home, /styles\.homeLinkAction/);
  assert.match(home, /styles\.homeSetup/);
  assert.doesNotMatch(home, /rounded-lg|sm:grid-cols-3/);
  for (const stale of ['Meet your coach', 'Readiness adventure', 'Build your bridge']) {
    assert.equal(home.includes(stale), false);
  }
});

test('class home reserves coach identity for teaching and journey maps', () => {
  assert.doesNotMatch(home, /getSchoolAvatarTheme\(schoolClass\.coach_avatar_id, schoolClass\.coach_palette_id\)/);
  assert.doesNotMatch(home, /coach_seed|getAvatarForSeed/);
  assert.doesNotMatch(home, /style={theme\.style}/);
  assert.equal((home.match(/<Image\b/g) ?? []).length, 0);
  assert.doesNotMatch(home, /SchoolCoachPanel/);
  assert.doesNotMatch(home, /lucide-react|font-black|gradient/i);
});

test('map surfaces handle empty content and dimension-stable pending starts', () => {
  assert.match(chapterMap, /No approved chapters are available/);
  assert.match(levelMap, /Starting chapter/);
});

test('canonical class and chapter actions are explicit state-authorized inputs', () => {
  assert.match(home, /primaryAction/);
  assert.match(chapterMap, /authorizedAction/);
  assert.match(levelMap, /authorizedAction/);

  assert.doesNotMatch(home, /\['active', 'ready', 'needs_support'\]/);
  assert.doesNotMatch(chapterMap, /const interactive = chapter\.status/);
  assert.doesNotMatch(chapterMap, /chapterActionLabel/);
  assert.doesNotMatch(levelMap, /stage\.status === 'active' \|\| stage\.status === 'ready'/);
  assert.doesNotMatch(levelMap, /stageActionLabel/);
});

test('direct class and chapter loads use the exact state destination before rendering actions', () => {
  for (const route of [classPage, chapterPage]) {
    assert.match(route, /resolveSchoolStateDestination/);
    assert.match(route, /nextAction: state\.next_action/);
    assert.match(route, /allowedNextActions: state\.allowed_next_actions/);
    assert.match(route, /nextActionUrl: state\.next_action_url/);
    assert.match(route, /router\.replace\(result\.href\)/);
  }
  assert.match(schoolHomePage, /primaryAction=/);
});

test('shared loading and motion contracts cover each route shape', () => {
  for (const exported of ['SchoolClassHomeSkeleton', 'SchoolMapSkeleton', 'SchoolLevelMapSkeleton', 'SchoolTutorSkeleton', 'SchoolReportSkeleton']) {
    assert.match(skeletons, new RegExp(`export function ${exported}`));
  }
  assert.match(skeletons, /motion-reduce:animate-none/);
  assert.match(journeyMap, /Math\.min\(index, 5\)/);
});
